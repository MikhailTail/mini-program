"""答题判分路由：POST /api/v1/quiz/submit"""
from fastapi import APIRouter

from app.api.v1.routes import answer_service
from app.models.answer import SubmitRequest, SubmitResponse

router = APIRouter(prefix="/api/v1/quiz", tags=["quiz"])


@router.post("/submit", response_model=SubmitResponse)
async def submit(req: SubmitRequest) -> SubmitResponse:
    """提交答题并判分（方案 B：无登录，device_id 区分）。"""
    return await answer_service.submit(req)
