DEMO_PASSWORD = "DemoPass123"

DEMO_ACCOUNTS = (
    {
        "email": "demo@example.com",
        "name": "Seed Demo Learner",
        "purchases": (),
        "progress": (
            {"course_id": "security", "saved": False, "last_lesson_id": "sec-3"},
            {"course_id": "english", "saved": True, "last_lesson_id": None},
        ),
        "completed": ("sec-1", "sec-2"),
        "quizzes": ({"course_id": "security", "score": 3},),
    },
    {
        "email": "demo.paid@example.com",
        "name": "Seed Demo Buyer",
        "purchases": ("ai",),
        "progress": (
            {"course_id": "ai", "saved": True, "last_lesson_id": "ai-2"},
            {"course_id": "excel", "saved": False, "last_lesson_id": None},
        ),
        "completed": ("ai-1",),
        "quizzes": ({"course_id": "ai", "score": 3},),
    },
)
