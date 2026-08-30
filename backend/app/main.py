"""FastAPI 入口：AI闯关答题小程序（企业版）后端"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.routes import quiz, answer, report, upload, rag
from app.api.v1.routes.upload import UPLOAD_DIR
from app.core.config import settings

app = FastAPI(title="AI闯关答题小程序(企业版) 后端", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quiz.router)
app.include_router(answer.router)
app.include_router(report.router)
app.include_router(upload.router)
app.include_router(rag.router)


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.deepseek_model}


# 题目配图静态目录（必须先于 "/" 挂载，否则会被前端静态资源拦截）
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# H5 前端静态资源（生产构建产物）：页面与 API 同源，规避浏览器跨域问题。
# 构建：cd frontend && npx taro build --type h5
_DIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "dist",
)
if os.path.isdir(_DIST_DIR):
    app.mount("/", StaticFiles(directory=_DIST_DIR, html=True), name="h5")
