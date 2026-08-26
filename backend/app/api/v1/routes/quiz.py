"""出题路由：POST /api/v1/quiz/generate"""
from fastapi import APIRouter

from app.api.v1.routes import quiz_service
from app.models.quiz import GenerateRequest, GenerateResponse

router = APIRouter(prefix="/api/v1/quiz", tags=["quiz"])


@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest) -> GenerateResponse:
    """根据资料文本生成结构化题库（方案 B：无登录，按 corp_code 逻辑隔离）。"""
    return await quiz_service.generate(req)
