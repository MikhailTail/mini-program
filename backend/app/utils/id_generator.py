"""简易 ID 生成（无需数据库依赖）"""
import uuid


def gen_id(prefix: str = "task") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"
