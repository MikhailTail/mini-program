"""答题判分服务层（方案 B：无登录，device_id 区分）"""
from app.llm.output_schemas import QuestionType
from app.models.answer import AnswerItem, ResultItem, SubmitRequest, SubmitResponse
from app.utils.id_generator import gen_id


def _norm_keys(s: str) -> set[str]:
    """把选项答案串规范为去重、排序的 key 集合，如 'ABD' -> {'A','B','D'}。"""
    return {c for c in s.upper() if c.isalpha()}


def _norm_blank(s: str) -> str:
    """填空归一化：去所有空白，统一中英文标点（；; ，, ：:）。"""
    import re

    s = s.replace(" ", "").replace(" ", "")
    s = s.replace("；", ";").replace("，", ",").replace("：", ":")
    s = re.sub(r"\s+", "", s)
    return s.strip()


def score_one(item: AnswerItem) -> ResultItem:
    ua, ca = item.user_answer.strip(), item.correct_answer.strip()

    if item.q_type in (QuestionType.single, QuestionType.judge):
        correct = ua == ca
    elif item.q_type == QuestionType.multiple:
        # 多选：集合完全相等才算对（少选/多选均错）
        correct = _norm_keys(ua) == _norm_keys(ca) and len(_norm_keys(ca)) > 0
    elif item.q_type == QuestionType.blank:
        # 填空：归一化（去空白+统一中英文标点）后相等即算对
        correct = _norm_blank(ua) == _norm_blank(ca)
    else:
        # 简答：MVP 阶段标记需复核，暂不计分（正确性交由前端/二期 AI 判分）
        return ResultItem(
            q_type=item.q_type,
            user_answer=ua,
            correct_answer=ca,
            correct=False,
            point=item.point,
            analysis=item.analysis,
            need_review=True,
        )

    return ResultItem(
        q_type=item.q_type,
        user_answer=ua,
        correct_answer=ca,
        correct=correct,
        point=item.point,
        analysis=item.analysis,
    )


async def submit(req: SubmitRequest) -> SubmitResponse:
    results = [score_one(a) for a in req.answers]
    total = len(results)
    # 简答(need_review)不计入有效判分分母
    scorable = [r for r in results if not r.need_review]
    correct_count = sum(1 for r in scorable if r.correct)
    score = round(correct_count / len(scorable) * 100) if scorable else 0

    return SubmitResponse(
        task_id=req.task_id,
        device_id=req.device_id,
        total=total,
        correct_count=correct_count,
        score=score,
        results=results,
    )
