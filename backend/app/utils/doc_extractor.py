"""文档文本提取：支持 txt/md/doc/docx/pdf/wps + 图片/扫描件（OCR 旁路）

- txt/md 等纯文本：utf-8 / gb18030 自动探测
- docx（含新版 .wps zip 格式）：解析 word/document.xml；文本过少时提取内嵌图片走 OCR
- pdf：pypdf 逐页提取；文本层缺失（扫描版）时自动走 PaddleOCR 逐页识别
- doc / 老式 .wps（OLE 复合文档）：读取 WordDocument 流启发式提取 UTF-16LE 文本
- jpg/png/bmp/webp 等图片：直接 PaddleOCR 识别
"""
import io
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

TEXT_EXT = {".txt", ".md", ".text", ".log", ".csv"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# docx 正文文本低于该值时，认为文档以图为主，尝试提取内嵌图片 OCR
DOCX_IMAGE_FALLBACK_MIN = 50
# pypdf 提取文本低于该字符数时，判定为扫描版 PDF，走 OCR
PDF_SCAN_FALLBACK_MIN = 20


def _decode_text(data: bytes) -> str:
    for enc in ("utf-8", "gb18030", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _extract_docx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        try:
            xml = zf.read("word/document.xml")
        except KeyError:
            raise ValueError("docx 文件缺少 word/document.xml，可能已损坏")
        root = ET.fromstring(xml)
        ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        lines = []
        for p in root.iter(f"{ns}p"):
            text = "".join((t.text or "") for t in p.iter(f"{ns}t"))
            if text.strip():
                lines.append(text.strip())
        text = "\n".join(lines).strip()
        # 正文极少 → 文档以图片为主：提取 word/media 下图片 OCR
        if len(text) < DOCX_IMAGE_FALLBACK_MIN:
            from app.utils import ocr

            media = [
                n
                for n in zf.namelist()
                if n.startswith("word/media/")
                and Path(n).suffix.lower() in IMAGE_EXT
            ]
            ocr_parts = []
            for name in media:
                try:
                    ocr_text = ocr.ocr_image_bytes(zf.read(name))
                except (ValueError, ocr.OcrUnavailableError):
                    continue
                if ocr_text:
                    ocr_parts.append(ocr_text)
            if ocr_parts:
                return "\n\n".join(ocr_parts).strip()
        return text


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ValueError("服务端缺少 pypdf 库，无法解析 PDF")
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception:
        raise ValueError("PDF 解析失败：文件可能已加密或损坏")
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(p for p in pages if p.strip()).strip()
    # 文本层缺失或极少 → 扫描版 / 纯图片 PDF，走 OCR 旁路
    if len(text) < PDF_SCAN_FALLBACK_MIN:
        from app.utils import ocr

        try:
            return ocr.ocr_pdf_bytes(data)
        except ocr.OcrUnavailableError as e:
            raise ValueError(f"该 PDF 是扫描版（无文本层），需要 OCR 识别，但{str(e)}")
    return text


def _extract_image(data: bytes) -> str:
    from app.utils import ocr

    try:
        return ocr.ocr_image_bytes(data)
    except ocr.OcrUnavailableError as e:
        raise ValueError(f"图片需要 OCR 识别文字，但{str(e)}")


def _extract_ole_doc(data: bytes) -> str:
    """老式 .doc / .wps（OLE 复合文档）启发式提取 UTF-16LE 文本。"""
    try:
        import olefile
    except ImportError:
        raise ValueError("服务端缺少 olefile 库，无法解析老式 doc/wps")
    ole = olefile.OleFileIO(io.BytesIO(data))
    try:
        if not ole.exists("WordDocument"):
            raise ValueError("不是有效的 Word 文档（缺少 WordDocument 流）")
        raw = ole.openstream("WordDocument").read()
    finally:
        ole.close()
    # Word 正文以 UTF-16LE 存储，过滤控制字符保留可打印文本
    chars = []
    for i in range(0, len(raw) - 1, 2):
        code = raw[i] | (raw[i + 1] << 8)
        if code == 0x20 or 0x21 <= code <= 0x7E or 0x4E00 <= code <= 0x9FFF:
            chars.append(chr(code))
        else:
            chars.append(" ")
    text = "".join(chars)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text(filename: str, data: bytes, max_chars: int = 100_000) -> str:
    """按扩展名提取文档文本；图片/扫描件自动 OCR；超长截断。"""
    ext = Path(filename).suffix.lower()
    if ext in TEXT_EXT:
        text = _decode_text(data)
    elif ext in IMAGE_EXT:
        text = _extract_image(data)
    elif ext == ".docx":
        text = _extract_docx(data)
    elif ext == ".pdf":
        text = _extract_pdf(data)
    elif ext == ".doc":
        text = _extract_ole_doc(data)
    elif ext == ".wps":
        # 新版 WPS 保存的 .wps 实为 zip(docx)，老版为 OLE
        text = _extract_docx(data) if data[:2] == b"PK" else _extract_ole_doc(data)
    else:
        raise ValueError(
            f"暂不支持的文件类型：{ext or '未知扩展名'}（支持 txt/md/doc/docx/pdf/wps/图片）"
        )
    text = text.strip()
    if not text:
        raise ValueError("未能从文档中提取到文本，请确认文件不是加密/损坏文件")
    if len(text) > max_chars:
        text = text[:max_chars]
    return text
