"""RAG 问答链路：检索到的资料 + 用户问题 → DeepSeek 生成回答。

与 quiz_chain 并列：quiz_chain 出题，本链路回答知识库问题。
"""
from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from app.llm.langchain_factory import build_chat

ANSWER_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "你是企业内部知识库问答助手。请严格依据提供的资料回答用户问题，"
            "回答简洁、准确、分点清晰。资料中没有的内容，明确说明“资料中未找到”，"
            "不要编造或套用外部知识。",
        ),
        (
            "human",
            "资料内容：\n'''\n{context}\n'''\n\n用户问题：{query}",
        ),
    ]
)


def generate_answer(query: str, context: str) -> str:
    """根据检索资料回答用户问题。"""
    chain = ANSWER_PROMPT | build_chat(temperature=0.2)
    resp = chain.invoke({"query": query, "context": context})
    return resp.content
