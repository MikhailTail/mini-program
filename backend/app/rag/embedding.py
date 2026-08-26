"""本地 embedding：BAAI/bge-small-zh-v1.5（免费离线，中文效果好）。

背景：DeepSeek 官方 API 不提供 embedding 接口，故向量化走本地模型，
与 PaddleOCR 的"免费离线"路线保持一致。首次运行会从 HuggingFace
自动下载模型（约 100MB，可设 RAG_EMBEDDING_MODEL 换模型名）。
国内网络可在环境变量设置 HF_ENDPOINT=https://hf-mirror.com 加速下载。
"""
from __future__ import annotations

from app.core.config import settings

_model = None
_model_name: str | None = None
_cache_dir: str | None = None

# bge 官方建议：query 端加短指令、两端都归一化，可提升检索效果
QUERY_INSTRUCTION = "为这个句子生成表示以用于检索相关文章："


def _get_model():
    """懒加载，避免在 import 时就拉起 100MB 模型（与 ocr.py 同思路）。"""
    global _model, _model_name, _cache_dir
    if _model is None or _model_name != settings.rag_embedding_model:
        from sentence_transformers import SentenceTransformer
        _model_name = settings.rag_embedding_model or "BAAI/bge-small-zh-v1.5"
        _cache_dir = settings.rag_embedding_cache_dir or None
        kwargs = {"cache_folder": _cache_dir} if _cache_dir else {}
        _model = SentenceTransformer(_model_name, **kwargs)
    return _model


def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """文档文本向量化：归一化后返回 list[list[float]]。"""
    texts = [t for t in texts]  # 防止生成器
    if not texts:
        return []
    model = _get_model()
    vecs = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
        batch_size=batch_size,
    )
    return [v.tolist() for v in vecs]


def embed_query(query: str) -> list[float]:
    """查询向量化：加 bge 检索指令前缀。"""
    return embed_texts([QUERY_INSTRUCTION + query])[0]
