"""LangChain 工厂：通过 OpenAI 兼容协议接入 DeepSeek"""
from langchain_openai import ChatOpenAI

from app.core.config import settings


def build_chat(temperature: float = 0.3) -> ChatOpenAI:
    """构建接入 DeepSeek 的 ChatModel（兼容 OpenAI 接口）。"""
    if not settings.deepseek_api_key:
        raise RuntimeError(
            "未配置 DEEPSEEK_API_KEY，请在 backend/.env 中填写（参考 .env.example）"
        )
    return ChatOpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        model=settings.deepseek_model,
        temperature=temperature,
    )
