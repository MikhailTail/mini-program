"""报告生成相关模型（方案 B：无登录）"""
from pydantic import BaseModel, Field

from app.llm.output_schemas import QuestionType


class ReportAnswerItem(BaseModel):
    q_type: QuestionType
    user_answer: str = ""
    correct_answer: str
    correct: bool
    point: str | None = None
    analysis: str | None = None
    need_review: bool = False


class ReportRequest(BaseModel):
    task_id: str
    device_id: str = Field(min_length=1)
    corp_code: str | None = None
    score: int = Field(ge=0, le=100)
    total: int = Field(ge=1)
    correct_count: int = Field(ge=0)
    results: list[ReportAnswerItem] = Field(min_length=1)


class ReportResponse(BaseModel):
    task_id: str
    device_id: str
    summary: str
    weak_points: list[str]
    suggestions: list[str]
    degraded: bool = Field(default=False, description="是否为本地降级报告（AI 不可用）")
