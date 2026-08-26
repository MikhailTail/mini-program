"""RAG 服务层：离线建库（文档 → 解析/分块/向量化 → Chroma）与检索。

解析复用现有 app.utils.doc_extractor（doc/docx/pdf/md/txt/wps + OCR 扫描件），
保证与 upload-doc 的解析能力完全一致。
"""
from __future__ import annotations

from app.rag import chunker, store
from app.utils.doc_extractor import extract_text


def index_document(corp_code: str, filename: str, data: bytes) -> dict:
    """离线建库：解析文档 → 分块 → 向量化 → 写入 Chroma。

    返回 {chars, chunks, total}；文本为空时抛 ValueError。
    """
    if not data:
        raise ValueError("上传的文件内容为空")
    text = extract_text(filename, data)
    if not text or not text.strip():
        raise ValueError("未能从文档中提取到文本，请确认文件非扫描损坏或格式支持")

    chunks = chunker.chunk_text(text)
    if not chunks:
        raise ValueError("文档文本过短或分块后为空，无法建库")

    added = store.add_chunks(corp_code, filename, chunks)
    return {
        "chars": len(text),
        "chunks": added,
        "total": store.count(corp_code),
    }


def retrieve(corp_code: str, query: str, top_k: int = 5) -> list[dict]:
    """检索 top_k 相关块。库为空或未命中时返回 []。"""
    if not query or not query.strip():
        return []
    return store.search(corp_code, query.strip(), top_k=top_k)


def build_context(hits: list[dict]) -> str:
    """把检索结果拼成给 LLM 的上下文（带来源标记，便于回答引用）。"""
    return "\n\n".join(
        f"[来源:{h['source']}] {h['content']}" for h in hits
    )
