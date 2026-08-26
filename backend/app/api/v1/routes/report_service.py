"""报告生成服务层（方案 B：无登录）"""
from app.llm.output_schemas import Report as LLMReport
from app.models.report import ReportRequest, ReportResponse


async def generate(req: ReportRequest) -> ReportResponse:
    wrong_items = [
        {
            "point": r.point,
            "analysis": r.analysis or "",
        }
        for r in req.results
        if not r.correct and not r.need_review
    ]

    # 懒导入，避免未配置 Key 时启动失败
    from app.llm.report_chain import generate_report

    llm_report: LLMReport
    llm_report, degraded = generate_report(
        score=req.score,
        total=req.total,
        correct_count=req.correct_count,
        wrong_items=wrong_items,
    )

    return ReportResponse(
        task_id=req.task_id,
        device_id=req.device_id,
        summary=llm_report.summary,
        weak_points=llm_report.weak_points,
        suggestions=llm_report.suggestions,
        degraded=degraded,
    )
