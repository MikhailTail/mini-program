"""应用配置"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env 位于 backend/ 目录（本文件在 app/core/，向上两级）
_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # skip_empty=True: 环境变量为空串时不覆盖 .env 中的值
    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH), env_file_encoding="utf-8", skip_empty=True
    )

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"

    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: str = "*"

    # RAG 知识库：本地 bge embedding（DeepSeek 无 embedding 接口，向量化走本地模型）
    rag_embedding_model: str = "BAAI/bge-small-zh-v1.5"
    rag_embedding_cache_dir: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
