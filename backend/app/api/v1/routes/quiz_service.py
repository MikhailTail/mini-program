"""出题服务层（方案 B：先内存态/轻量存储，不依赖用户系统）"""
from app.llm.output_schemas import Option, Quiz
from app.models.quiz import GenerateRequest, GenerateResponse, OptionOut, QuestionOut
from app.utils.id_generator import gen_id


async def generate(req: GenerateRequest) -> GenerateResponse:
    # 懒导入，避免在未配置 API Key 时启动失败
    from app.llm.quiz_chain import generate_quiz

    quiz: Quiz = generate_quiz(req.content, req.n)

    questions = [
        QuestionOut(
            q_type=q.q_type,
            content=q.content,
            options=(
                [OptionOut(key=o.key, text=o.text) for o in q.options]
                if q.options
                else None
            ),
            answer=q.answer,
            analysis=q.analysis,
            point=q.point,
        )
        for q in quiz.questions
    ]

    return GenerateResponse(
        task_id=gen_id("task"),
        corp_code=req.corp_code,
        questions=questions,
    )
