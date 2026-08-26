"""出题链路：输入资料文本 -> 结构化题目"""
from langchain_core.prompts import ChatPromptTemplate

from app.llm.langchain_factory import build_chat
from app.llm.output_schemas import Quiz

QUIZ_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "你是一个企业培训考核出题专家。根据给定资料，生成用于员工闯关答题的考题。"
            "要求：\n"
            "1. 题目贴合企业培训/考核场景，语言严谨但不晦涩。\n"
            "2. 题型可混合 单选(single)/多选(multiple)/判断(judge)/填空(blank)/简答(short)。\n"
            "3. 每题必须给出 answer、analysis（解析）与 point（考点）。\n"
            "4. 选择题提供 2-4 个 options；单选 answer 为单个正确选项 key（如 B）；"
            "多选(multiple) answer 为所有正确选项 key 按 A-Z 顺序连写（如 AB 或 BCD），且至少有 2 个正确项。\n"
            "5. 判断题 answer 为 '正确' 或 '错误'。\n"
            "6. 不要编造资料中没有的知识点。",
        ),
        (
            "human",
            "资料内容如下：\n'''{content}'''\n\n请生成 {n} 道题目。",
        ),
    ]
)


MAX_CONTENT_CHARS = 30_000  # 出题内容上限：防止超长资料超出模型上下文


def generate_quiz(content: str, n: int = 10, retries: int = 2) -> Quiz:
    """调用 DeepSeek 生成结构化题库；结构化解析失败时自动重试。"""
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS]
        print(f"[quiz_chain] 资料超长（{len(content)} 字符），已截取前 {MAX_CONTENT_CHARS} 字出题")
    chain = QUIZ_PROMPT | build_chat(temperature=0.3).with_structured_output(Quiz)
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return chain.invoke({"content": content, "n": n})
        except Exception as e:  # 含 pydantic ValidationError 等非确定性解析失败
            last_err = e
            print(f"[quiz_chain] 第 {attempt} 次生成结构化解析失败，重试… ({e})")
    raise RuntimeError(f"AI 出题重试 {retries} 次仍失败：{last_err}")
