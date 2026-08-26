"""文本分块：按段落贪心合并到目标长度，超长段落硬切并带 overlap。

规则：
- 以空行分隔段落，优先按段落粒度组合，保持语义完整；
- 单段超过 chunk_size 时硬切，块间保留 overlap 避免切断关键信息；
- 过滤过短噪音（<8 字符的碎片）。
"""
from __future__ import annotations

import re

CHUNK_SIZE = 400          # 每块目标字符数（bge 支持 512 token，400 汉字约 1KB 安全）
CHUNK_OVERLAP = 80        # 块间重叠字符数
MIN_CHUNK = 8             # 低于此长度视为噪音丢弃


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buf = ""

    for para in paragraphs:
        if len(para) > chunk_size:
            # 超长段落：先落盘已缓存块，再硬切
            if buf:
                chunks.append(buf)
                buf = ""
            start = 0
            while start < len(para):
                chunks.append(para[start:start + chunk_size])
                start += chunk_size - overlap
        else:
            if buf and len(buf) + len(para) + 1 > chunk_size:
                chunks.append(buf)
                buf = buf[-overlap:] if overlap else ""
                buf = f"{buf}\n{para}" if buf else para
            else:
                buf = f"{buf}\n{para}" if buf else para

    if buf:
        chunks.append(buf)

    # 合并相邻过短碎片（例如被空行拆散的单句标题），避免向量化噪音
    merged: list[str] = []
    for c in chunks:
        if len(c) < MIN_CHUNK and merged:
            merged[-1] += "\n" + c
        else:
            merged.append(c)
    return merged
