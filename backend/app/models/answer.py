"""答题提交与判分相关模型（方案 B：无登录，device_id 区分）"""
from pydantic import BaseModel, Field

from app.llm.output_schemas import QuestionType


class AnswerItem(BaseModel):
    q_type: QuestionType
    user_answer: str = Field(default="", description="用户作答；选项题为 key 串(如 B / ABD)，填空/简答为文本")
    correct_answer: str = Field(description="该题标准答案（来自出题结果），用于服务端二次校验判分")
    point: str | None = Field(default=None, description="考点（来自出题结果，透传给报告用）")
    analysis: str | None = Field(default=None, description="解析（来自出题结果，透传给报告用）")


class SubmitRequest(BaseModel):
    task_id: str = Field(description="生成题库时返回的 task_id")
    device_id: str = Field(min_length=1, description="设备标识，替代登录做数据隔离")
    corp_code: str | None = Field(default=None, description="企业邀请码（可选）")
    answers: list[AnswerItem] = Field(min_length=1, description="逐题作答列表")


class ResultItem(BaseModel):
    q_type: QuestionType
    user_answer: str
    correct_answer: str
    correct: bool
    point: str | None = Field(default=None, description="考点（简答需复核时给出）")
    analysis: str | None = Field(default=None, description="解析（简答需复核时给出）")
    need_review: bool = Field(default=False, description="简答等需人工/AI 复核")


class SubmitResponse(BaseModel):
    task_id: str
    device_id: str
    total: int
    correct_count: int
    score: int = Field(description="百分制得分")
    results: list[ResultItem]
