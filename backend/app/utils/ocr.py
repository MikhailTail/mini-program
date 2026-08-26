"""本地 OCR 服务（PaddleOCR 旁路）：让纯文本 LLM 也能"读"图片 / 扫描件。

设计要点：
- 懒加载单例：首次调用才初始化 PaddleOCR 模型，避免拖慢服务启动与无 OCR 场景。
- 引擎不可用（未安装 / 初始化失败 / 显式关闭）时抛 OcrUnavailableError，由上层给出友好提示。
- 兼容 PaddleOCR 2.x（.ocr）与 3.x（.predict）两种 API。
- 环境变量：
    OCR_ENABLED   = "0" 强制关闭 OCR（默认 "1" 开启）
    OCR_PDF_DPI   = 扫描 PDF 渲染 DPI（默认 200）
    OCR_PAGE_LIMIT= 单文件扫描件页数上限（默认 30，防超大文件卡死）
"""
import os
import threading
import logging

logger = logging.getLogger(__name__)

OCR_ENABLED = os.getenv("OCR_ENABLED", "1") == "1"
OCR_PDF_DPI = int(os.getenv("OCR_PDF_DPI", "200"))
OCR_PAGE_LIMIT = int(os.getenv("OCR_PAGE_LIMIT", "30"))

_engine = None
_engine_lock = threading.Lock()
_run_lock = threading.Lock()  # PaddleOCR 引擎非线程安全，串行化调用


class OcrUnavailableError(RuntimeError):
    """OCR 引擎不可用（未安装 / 未启用 / 初始化失败）。"""


def _load_engine():
    """加载 PaddleOCR 引擎（全局单例）。"""
    global _engine
    if _engine is not None:
        return _engine
    with _engine_lock:
        if _engine is not None:
            return _engine
        try:
            from paddleocr import PaddleOCR
        except ImportError as e:
            raise OcrUnavailableError(
                "OCR 引擎未安装：请在服务端执行 pip install paddlepaddle paddleocr pymupdf"
            ) from e
        try:
            _engine = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        except TypeError:
            # 部分 3.x 版本移除 use_angle_cls 参数
            _engine = PaddleOCR(lang="ch")
        except Exception as e:
            raise OcrUnavailableError(f"PaddleOCR 初始化失败：{e}") from e
        logger.info("PaddleOCR 引擎加载完成（%s）", type(_engine).__name__)
        return _engine


def _extract_lines(result) -> list[str]:
    """解析 PaddleOCR 2.x(.ocr) / 3.x(.predict) 的返回结构为文本行列表。"""
    lines: list[str] = []
    if result is None:
        return lines
    pages = result if isinstance(result, (list, tuple)) else [result]
    for page in pages:
        if page is None:
            continue
        if hasattr(page, "json"):  # 3.x OCRResult.json
            page = page.json
        if isinstance(page, dict):  # 3.x {"rec_texts": [...]}
            lines.extend(page.get("rec_texts") or [])
            continue
        # 2.x: [ [box, (text, score)], ... ]（可能有双层嵌套）
        if isinstance(page, (list, tuple)):
            for item in page:
                if isinstance(item, (list, tuple)) and len(item) == 2:
                    if isinstance(item[1], (list, tuple)) and item[1]:
                        lines.append(str(item[1][0]))
    return [t.strip() for t in lines if t and str(t).strip()]


def _run_ocr(img_array):
    """对 BGR ndarray 执行 OCR，返回引擎原始结果。"""
    engine = _load_engine()
    with _run_lock:
        if hasattr(engine, "ocr"):
            return engine.ocr(img_array, cls=True)
        if hasattr(engine, "predict"):
            return engine.predict(input=img_array)
        raise OcrUnavailableError("PaddleOCR 版本过旧，请升级到 2.7+")
    return None


def ocr_image_bytes(data: bytes) -> str:
    """识别单张图片（jpg/png/bmp/webp 等）中的文字，按行返回。"""
    if not OCR_ENABLED:
        raise OcrUnavailableError("OCR 已通过环境变量 OCR_ENABLED=false 关闭")
    try:
        import cv2
        import numpy as np
    except ImportError:
        raise OcrUnavailableError("缺少 opencv-python / numpy，请随 paddleocr 一起安装")
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("无法解码图片，文件可能已损坏或不是有效图片")
    lines = _extract_lines(_run_ocr(img))
    text = "\n".join(lines).strip()
    if not text:
        raise ValueError("图片中未识别到文字（可能为空白图或纯图形）")
    return text


def ocr_pdf_bytes(data: bytes) -> str:
    """识别扫描版 / 纯图片 PDF：渲染每页为图片后逐页 OCR。"""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise OcrUnavailableError("缺少 pymupdf 库：pip install pymupdf")
    if not OCR_ENABLED:
        raise OcrUnavailableError("OCR 已通过环境变量 OCR_ENABLED=false 关闭")
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        if doc.page_count > OCR_PAGE_LIMIT:
            raise ValueError(
                f"扫描件共 {doc.page_count} 页，超过单文件上限 {OCR_PAGE_LIMIT} 页，请拆分后上传"
            )
        parts = []
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=OCR_PDF_DPI)
            try:
                text = ocr_image_bytes(pix.tobytes("png"))
            except ValueError:
                continue  # 该页无文字，跳过
            if text:
                parts.append(f"--- 第 {i + 1} 页 ---\n{text}")
    finally:
        doc.close()
    if not parts:
        raise ValueError("扫描件中未识别到文字")
    return "\n\n".join(parts).strip()
