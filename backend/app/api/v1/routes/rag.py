"""RAG 知识库接口：离线建库 + 检索出题/问答。

- POST /api/v1/rag/index   上传文档 → 解析/分块/向量化 → 存 Chroma（离线建库）
- POST /api/v1/rag/ask     用户问题 → 检索 top_k → 拼 Prompt → 生成题目或回答
"""
from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
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
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="上传的文件为空")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail=f"文件超过 {MAX_FILE_BYTES // 1024 // 1024}MB 大小限制")

    filename = file.filename or "upload"
    try:
        result = rag_service.index_document(corp_code, filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return IndexResponse(filename=filename, **result)


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
