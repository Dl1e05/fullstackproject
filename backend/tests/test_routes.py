from app.main import app


def test_api_contract_routes():
    paths = app.openapi()["paths"]
    routes = {(method.upper(), path) for path, ops in paths.items() for method in ops}
    assert {
        ("GET", "/topics"),
        ("GET", "/courses"),
        ("GET", "/courses/{course_id}"),
        ("GET", "/courses/{course_id}/lessons/{lesson_id}"),
        ("GET", "/courses/{course_id}/quiz"),
        ("POST", "/courses/{course_id}/purchase"),
        ("POST", "/exercises/{exercise_id}/attempts"),
        ("POST", "/auth/login"),
        ("GET", "/users/me"),
    } <= routes
