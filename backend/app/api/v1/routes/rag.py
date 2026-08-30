"""RAG 知识库接口：离线建库 + 检索出题/问答。

- POST /api/v1/rag/index   上传文档 → 解析/分块/向量化 → 存 Chroma（离线建库）
- POST /api/v1/rag/ask     用户问题 → 检索 top_k → 拼 Prompt → 生成题目或回答
"""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.llm.answer_chain import generate_answer
from app.llm.quiz_chain import generate_quiz
from app.models.quiz import OptionOut, QuestionOut
from app.rag import service as rag_service
from app.utils.id_generator import gen_id

router = APIRouter(prefix="/api/v1/rag", tags=["rag"])

MAX_FILE_BYTES = 10 * 1024 * 1024  # 与 upload-doc 一致：10MB


# ---------- 1) 离线建库 ----------
class IndexResponse(BaseModel):
    filename: str
    chars: int
    chunks: int
    total: int


@router.post("/index", response_model=IndexResponse, summary="离线建库")
async def rag_index(
    corp_code: str = Form("default", description="企业码，用于隔离知识库"),
    file: UploadFile = File(..., description="PDF/MD/Word 等文档"),
    filename: str | None = Form(
        None, description="原始文件名（小程序端 Taro.uploadFile 不带文件名，需前端显式传入）"
    ),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传的文件为空")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail=f"文件超过 {MAX_FILE_BYTES // 1024 // 1024}MB 大小限制")

    # 入库文件名优先取前端显式传入的原始名，H5 浏览器自动带文件名时退化为 file.filename
    name = (filename or "").strip() or (file.filename or "").strip() or "upload"
    try:
        result = rag_service.index_document(corp_code, name, data)
    except rag_service.DuplicateDocumentError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return IndexResponse(filename=name, **result)


# ---------- 1.2) 企业码验证（隔离门禁） ----------
class CorpResponse(BaseModel):
    corp_code: str
    exists: bool
    documents: int


@router.get("/corp/{corp_code}", response_model=CorpResponse, summary="验证企业码是否存在知识库")
async def rag_corp(corp_code: str):
    """返回该企业码下是否已有知识库及文档数。前端门禁：只有输入对应企业码才能进入知识库页。"""
    exists = rag_service.exists_corp(corp_code)
    docs = rag_service.list_documents(corp_code)
    return CorpResponse(corp_code=corp_code, exists=exists, documents=len(docs))


# ---------- 1.5) 查看已入库文档 ----------
class DocItem(BaseModel):
    source: str
    chunks: int
    chars: int


class DocListResponse(BaseModel):
    total_chunks: int
    total_chars: int
    documents: list[DocItem]


@router.get("/documents", response_model=DocListResponse, summary="查看已入库文档列表")
async def rag_documents(corp_code: str = "default"):
    """列出当前企业码知识库里已入库的文档（文件名/块数/字数），用于避免重复上传。"""
    docs = rag_service.list_documents(corp_code)
    return DocListResponse(
        total_chunks=sum(d["chunks"] for d in docs),
        total_chars=sum(d["chars"] for d in docs),
        documents=[DocItem(**d) for d in docs],
    )


# ---------- 1.6) 删除单个已入库文档 ----------
class DeleteResponse(BaseModel):
    source: str
    removed: int


@router.delete("/documents", response_model=DeleteResponse, summary="删除单个已入库文档")
async def rag_delete_document(
    corp_code: str = "default",
    source: str = Query(..., description="要删除的文档原始文件名"),
):
    """删除该企业知识库中指定文件名的文档，删除后同名文件可重新上传入库。"""
    removed = rag_service.delete_document(corp_code, source)
    if removed == 0:
        raise HTTPException(status_code=404, detail=f"《{source}》不在该企业知识库中，无需删除")
    return DeleteResponse(source=source, removed=removed)


# ---------- 2) 用户问答 / 检索出题 ----------
class AskRequest(BaseModel):
    corp_code: str = Field(default="default", description="企业码")
    query: str = Field(min_length=2, max_length=1000, description="用户问题或出题指令")
    mode: str = Field(default="quiz", pattern="^(quiz|answer)$", description="quiz=检索出题, answer=检索回答")
    n: int = Field(default=5, ge=1, le=30, description="出题数量（mode=quiz）")
    top_k: int = Field(default=5, ge=1, le=10, description="检索的文档块数量")


class SourceItem(BaseModel):
    content: str
    source: str


class AskResponse(BaseModel):
    mode: str
    task_id: str | None = None
    questions: list[QuestionOut] | None = None
    answer: str | None = None
    sources: list[SourceItem]


@router.post("/ask", response_model=AskResponse, summary="检索出题 / 知识问答")
async def rag_ask(req: AskRequest):
    hits = rag_service.retrieve(req.corp_code, req.query, req.top_k)
    if not hits:
        raise HTTPException(
            status_code=404,
            detail="知识库为空或未检索到相关资料，请先通过 /api/v1/rag/index 建库",
        )

    context = rag_service.build_context(hits)
    sources = [SourceItem(content=h["content"], source=h["source"]) for h in hits]

    if req.mode == "answer":
        answer = generate_answer(req.query, context)
        return AskResponse(mode="answer", answer=answer, sources=sources)

    # mode=quiz：复用出题链路，上下文替换为检索到的资料
    quiz = generate_quiz(context, req.n)
    questions = [
        QuestionOut(
            q_type=q.q_type,
            content=q.content,
            options=[OptionOut(key=o.key, text=o.text) for o in q.options]
            if q.options
            else None,
            answer=q.answer,
            analysis=q.analysis,
            point=q.point,
        )
        for q in quiz.questions
    ]
    return AskResponse(
        mode="quiz",
        task_id=gen_id("task"),
        questions=questions,
        sources=sources,
    )
