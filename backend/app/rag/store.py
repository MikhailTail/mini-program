"""Chroma 向量库持久化封装：按 corp_code 隔离 collection。

数据目录：backend/rag_data/（PersistentClient 落盘，重启不丢）。
collection 命名：corp_{corp_code}（Chroma 仅允许 [a-zA-Z0-9_-]）。
embeddings 由本模块显式编码并传入，避免 Chroma 默认 MiniLM 与 bge
向量空间不一致导致检索失效。
"""
from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path

import chromadb  # noqa: E402
from chromadb.config import Settings as ChromaSettings  # noqa: E402

RAG_DATA_DIR = Path(__file__).resolve().parents[2] / "rag_data"
COLLECTION_PREFIX = "corp_"
_COLLECTION_NAME_RE = re.compile(r"[^a-zA-Z0-9_-]")

_client = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        RAG_DATA_DIR.mkdir(parents=True, exist_ok=True)
        # 企业内网部署关闭匿名遥测，避免 posthog 兼容性报错刷屏
        _client = chromadb.PersistentClient(
            path=str(RAG_DATA_DIR),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def _collection_name(corp_code: str) -> str:
    name = _COLLECTION_NAME_RE.sub("_", (corp_code or "default").strip() or "default")
    return COLLECTION_PREFIX + name


def _get_collection(corp_code: str, create: bool = True):
    name = _collection_name(corp_code)
    client = _get_client()
    try:
        return client.get_collection(name)
    except Exception:
        if create:
            return client.create_collection(name)
        return None


def _doc_id(source: str, index: int) -> str:
    """基于文件名+块号的稳定 id：同一文档重复建库时按 id 覆盖，不重复堆积。"""
    h = hashlib.md5((source or "upload").encode("utf-8")).hexdigest()[:12]
    return f"{h}-{index}"


def add_chunks(corp_code: str, source: str, chunks: list[str]) -> int:
    """向量化并写入 Chroma（upsert）。返回写入块数。"""
    if not chunks:
        return 0
    from app.rag.embedding import embed_texts

    embeddings = embed_texts(chunks)
    col = _get_collection(corp_code)
    col.upsert(
        ids=[_doc_id(source, i) for i in range(len(chunks))],
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"source": source, "chunk_index": i} for i in range(len(chunks))],
    )
    return len(chunks)


def search(corp_code: str, query: str, top_k: int = 5) -> list[dict]:
    """检索 top_k 相关块，返回 [{content, source, distance}]，库空时返回 []。"""
    col = _get_collection(corp_code, create=False)
    if col is None or col.count() == 0:
        return []

    from app.rag.embedding import embed_query

    qv = embed_query(query)
    res = col.query(
        query_embeddings=[qv],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    documents = res.get("documents") or [[]]
    metadatas = res.get("metadatas") or [[]]
    distances = res.get("distances") or [[]]
    hits = []
    for content, meta, dist in zip(
        documents[0], metadatas[0], distances[0]
    ):
        hits.append(
            {
                "content": content,
                "source": (meta or {}).get("source", "unknown"),
                "distance": round(float(dist), 4),
            }
        )
    return hits


def count(corp_code: str) -> int:
    col = _get_collection(corp_code, create=False)
    return col.count() if col is not None else 0


def exists_corp(corp_code: str) -> bool:
    """判断该企业码下是否已有知识库（collection 存在且有数据）。"""
    col = _get_collection(corp_code, create=False)
    return col is not None and col.count() > 0


def exists_document(corp_code: str, source: str) -> bool:
    """判断该企业知识库是否已入库同名文档（按 source 元数据精确匹配）。"""
    if not source:
        return False
    col = _get_collection(corp_code, create=False)
    if col is None or col.count() == 0:
        return False
    res = col.get(where={"source": {"$eq": source}}, include=["metadatas"])
    return bool(res.get("ids"))


def list_documents(corp_code: str) -> list[dict]:
    """聚合返回已入库文档列表：[{source, chunks, chars}]，按字符数降序。

    用于知识库页面展示"已有哪些题库"，避免重复上传同名文档。
    """
    col = _get_collection(corp_code, create=False)
    if col is None or col.count() == 0:
        return []
    res = col.get(include=["metadatas", "documents"])
    metas = res.get("metadatas") or []
    docs = res.get("documents") or []
    agg: dict[str, dict] = {}
    for meta, doc in zip(metas, docs):
        src = (meta or {}).get("source", "unknown")
        item = agg.setdefault(src, {"source": src, "chunks": 0, "chars": 0})
        item["chunks"] += 1
        item["chars"] += len(doc or "")
    return sorted(agg.values(), key=lambda x: -x["chars"])


def delete_document(corp_code: str, source: str) -> int:
    """删除该企业知识库中指定文件名的全部块。返回删除块数；文档不存在返回 0。"""
    if not source:
        return 0
    col = _get_collection(corp_code, create=False)
    if col is None or col.count() == 0:
        return 0
    res = col.get(where={"source": {"$eq": source}}, include=["metadatas"])
    ids = res.get("ids") or []
    if not ids:
        return 0
    col.delete(ids=ids)
    return len(ids)


def delete_corp(corp_code: str) -> None:
    """清空某个企业码的知识库（用于测试与重建）。"""
    name = _collection_name(corp_code)
    client = _get_client()
    try:
        client.delete_collection(name)
    except Exception:
        pass


def list_collections() -> list[str]:
    return [c.name for c in _get_client().list_collections()]
