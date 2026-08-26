"""报告生成路由：POST /api/v1/report/generate"""
from fastapi import APIRouter

from app.api.v1.routes import report_service
from app.models.report import ReportRequest, ReportResponse

router = APIRouter(prefix="/api/v1/report", tags=["report"])


@router.post("/generate", response_model=ReportResponse)
async def generate(req: ReportRequest) -> ReportResponse:
    """根据答题结果生成 AI 复盘报告（方案 B：无登录）。"""
    return await report_service.generate(req)
