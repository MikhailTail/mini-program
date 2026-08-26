"""题库相关 Pydantic 模型（API 进出参）"""
from pydantic import BaseModel, Field

from app.llm.output_schemas import QuestionType


class GenerateRequest(BaseModel):
    content: str = Field(min_length=10, max_length=100_000, description="输入的资料文本")
    n: int = Field(default=10, ge=1, le=30, description="生成题目数量")
    corp_code: str | None = Field(default=None, description="企业邀请码（逻辑隔离，非必填）")


class OptionOut(BaseModel):
    key: str
    text: str


class QuestionOut(BaseModel):
    q_type: QuestionType
    content: str
    options: list[OptionOut] | None = None
    answer: str
    analysis: str
    point: str
    image: str | None = None  # 可选配图 URL（答题页展示，如题目截图/图表）


class GenerateResponse(BaseModel):
    task_id: str
    corp_code: str | None = None
    questions: list[QuestionOut]
