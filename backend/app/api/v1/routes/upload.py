"""文档上传解析：POST /api/v1/quiz/upload-doc（支持 doc/docx/pdf/txt/md/wps/图片/扫描件）
图片配图上传：POST /api/v1/quiz/upload-image（返回可访问 URL，答题页展示用）
"""
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from app.utils import doc_extractor
from app.utils.doc_extractor import extract_text

router = APIRouter(prefix="/api/v1/quiz", tags=["quiz"])

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TEXT_CHARS = 100_000

# 配图存储目录：backend/uploads（由 main.py 静态挂载为 /uploads）
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"


class UploadDocResponse(BaseModel):
    filename: str
    chars: int
    truncated: bool
    text: str


@router.post("/upload-doc", response_model=UploadDocResponse)
async def upload_doc(file: UploadFile = File(...)) -> UploadDocResponse:
    data = await file.read()
    if not data:
        raise HTTPException(400, "上传的文件为空")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(400, "文件超过 10MB 大小限制")
    try:
        text = extract_text(file.filename or "upload", data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    truncated = len(text) > MAX_TEXT_CHARS
    text = text[:MAX_TEXT_CHARS]
    return UploadDocResponse(
        filename=file.filename or "",
        chars=len(text),
        truncated=truncated,
        text=text,
    )


class UploadImageResponse(BaseModel):
    url: str


@router.post("/upload-image", response_model=UploadImageResponse)
async def upload_image(file: UploadFile = File(...)) -> UploadImageResponse:
    """上传题目配图，返回可访问 URL（供答题页 image 字段使用）。"""
    data = await file.read()
    if not data:
        raise HTTPException(400, "上传的文件为空")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(400, "文件超过 10MB 大小限制")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in doc_extractor.IMAGE_EXT:
        raise HTTPException(400, f"仅支持图片格式：{' / '.join(sorted(doc_extractor.IMAGE_EXT))}")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return UploadImageResponse(url=f"/uploads/{name}")
