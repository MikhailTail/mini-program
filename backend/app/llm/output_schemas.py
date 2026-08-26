"""AI 结构化输出 Schema（Pydantic）"""
from enum import Enum
from pydantic import BaseModel, Field, model_validator


class QuestionType(str, Enum):
    single = "single"     # 单选
    multiple = "multiple" # 多选
    judge = "judge"     # 判断
    blank = "blank"     # 填空
    short = "short"     # 简答


class Option(BaseModel):
    key: str = Field(description="选项标识，如 A/B/C/D")
    text: str = Field(description="选项内容")


class Question(BaseModel):
    q_type: QuestionType = Field(description="题型")
    content: str = Field(description="题干")
    options: list[Option] | None = Field(default=None, description="选择题选项，非选择题型为 null")
    answer: str = Field(description="标准答案；单选/多选题为正确选项 key（单选如 B，多选多个 key 连写如 AB）；判断题为 正确/错误；填空/简答为要点文本")
    analysis: str = Field(description="解析说明，点明考点与思路")
    point: str = Field(description="考点标签，如 闭包 / 原型链")


class Quiz(BaseModel):
    questions: list[Question] = Field(description="题目列表")


class Report(BaseModel):
    summary: str = Field(description="总体评价，1-2 句话，点明掌握情况")
    weak_points: list[str] = Field(description="薄弱知识点列表，来自答错题目的考点")
    suggestions: list[str] = Field(description="针对性学习建议，每条可执行")

    @model_validator(mode="before")
    @classmethod
    def _coerce_lists(cls, data: dict) -> dict:
        """兼容 DeepSeek 偶发将 list 字段返回为 JSON 字符串的情况。"""
        import json

        if not isinstance(data, dict):
            return data
        for key in ("weak_points", "suggestions"):
            v = data.get(key)
            if isinstance(v, str):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        data[key] = parsed
                except (json.JSONDecodeError, TypeError):
                    # 单个字符串包成列表
                    data[key] = [v]
        return data
