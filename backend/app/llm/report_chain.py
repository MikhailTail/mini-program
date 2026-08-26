"""报告生成链路：答题结果 -> AI 结构化分析报告。

含降级：当未配置 Key 或 AI 调用失败，返回基于错题库点的本地聚合报告。
"""
from langchain_core.prompts import ChatPromptTemplate

from app.llm.langchain_factory import build_chat
from app.llm.output_schemas import Report

REPORT_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "你是一个企业培训考核的分析专家。根据员工的答题情况，生成一份复盘报告。"
            "要求：\n"
            "1. summary：1-2 句话总体评价，语气鼓励但不粉饰。\n"
            "2. weak_points：薄弱知识点列表，必须来自答错题目的考点。\n"
            "3. suggestions：针对性学习建议，每条具体可执行。\n"
            "4. 全部使用中文。",
        ),
        (
            "human",
            "员工得分：{score} 分（共 {total} 题，答对 {correct_count} 题）。\n"
            "答错题目的考点与解析如下：\n{wrong_detail}\n\n请生成复盘报告。",
        ),
    ]
)


def generate_report(score: int, total: int, correct_count: int, wrong_items: list[dict]) -> tuple[Report, bool]:
    """调用 DeepSeek 生成结构化报告；失败则降级为本地聚合。返回 (Report, degraded)。"""
    wrong_detail = "\n".join(
        f"- 考点【{w.get('point','未知')}】：{w.get('analysis','')}" for w in wrong_items
    ) or "（无错题）"

    try:
        chain = REPORT_PROMPT | build_chat(temperature=0.4).with_structured_output(Report)
        return chain.invoke(
            {
                "score": score,
                "total": total,
                "correct_count": correct_count,
                "wrong_detail": wrong_detail,
            }
        ), False
    except Exception as e:  # 网络/Key/解析失败 -> 降级
        print(f"[report_chain] AI 报告生成失败，降级本地聚合：{e}")
        weak = [w.get("point", "未知") for w in wrong_items] or ["暂无明显薄弱点"]
        degraded_report = Report(
            summary=f"本次得分 {score} 分，共 {total} 题答对 {correct_count} 题。"
            + ("整体掌握较好，继续保持。" if correct_count == total else "有提升空间，建议针对薄弱点复习。"),
            weak_points=weak,
            suggestions=[f"重点复习「{p}」相关概念与例题。" for p in weak],
        )
        return degraded_report, True
