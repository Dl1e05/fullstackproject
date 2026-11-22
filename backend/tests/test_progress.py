from conftest import FREE_COURSE, PAID_COURSE


def _answers(client, course_id, *, correct: bool):
    quiz = client.get(f"/courses/{course_id}/quiz").json()
    answers = []
    for q in quiz:
        right = client.post(f"/exercises/{q['id']}/attempts", json={"optionId": "a"}).json()[
            "correctId"
        ]
        wrong = next(o["id"] for o in q["options"] if o["id"] != right)
        answers.append({"exerciseId": q["id"], "optionId": right if correct else wrong})
    return answers


def test_progress_requires_auth(client):
    assert client.get("/users/me/progress").status_code == 401
    assert client.put(f"/courses/{FREE_COURSE}/lessons/sec-1/completion").status_code == 401


def test_complete_lesson_and_stats(client, auth):
    path = f"/courses/{FREE_COURSE}/lessons/sec-1/completion"
    assert client.put(path, headers=auth).status_code == 204
    assert client.put(path, headers=auth).status_code == 204  # идемпотентно
    progress = client.get("/users/me/progress", headers=auth).json()
    assert progress["completed"][FREE_COURSE] == ["sec-1"]
    stats = client.get("/users/me/stats", headers=auth).json()
    assert stats == {"lessonsDone": 1, "coursesDone": 0, "saved": 0}


def test_cannot_complete_locked_lesson(client, auth):
    r = client.put(f"/courses/{PAID_COURSE}/lessons/ai-2/completion", headers=auth)
    assert r.status_code == 402


def test_visit_and_saved_courses(client, auth):
    assert (
        client.put(f"/courses/{FREE_COURSE}/lessons/sec-2/visit", headers=auth).status_code == 204
    )
    assert client.put(f"/users/me/saved/{FREE_COURSE}", headers=auth).status_code == 204
    progress = client.get("/users/me/progress", headers=auth).json()
    assert progress["last"][FREE_COURSE]["lessonId"] == "sec-2"
    assert progress["saved"] == [FREE_COURSE]
    assert client.delete(f"/users/me/saved/{FREE_COURSE}", headers=auth).status_code == 204
    assert client.get("/users/me/progress", headers=auth).json()["saved"] == []


def test_quiz_attempt_pass_and_fail(client, auth):
    fail = client.post(
        f"/courses/{FREE_COURSE}/quiz/attempts",
        json={"answers": _answers(client, FREE_COURSE, correct=False)},
        headers=auth,
    )
    assert fail.status_code == 201 and fail.json()["passed"] is False

    ok = client.post(
        f"/courses/{FREE_COURSE}/quiz/attempts",
        json={"answers": _answers(client, FREE_COURSE, correct=True)},
        headers=auth,
    )
    body = ok.json()
    assert ok.status_code == 201 and body["passed"] is True and body["score"] == body["total"]

    history = client.get(f"/courses/{FREE_COURSE}/quiz/attempts", headers=auth).json()
    assert history["total"] == 2
    # passed остаётся true, если успешной была любая попытка
    assert (
        client.get("/users/me/progress", headers=auth).json()["quiz"][FREE_COURSE]["passed"] is True
    )


def test_quiz_attempt_is_idempotent_with_client_id(client, auth):
    payload = {
        "answers": _answers(client, FREE_COURSE, correct=True),
        "clientAttemptId": "11111111-1111-4111-8111-111111111111",
    }
    first = client.post(f"/courses/{FREE_COURSE}/quiz/attempts", json=payload, headers=auth)
    again = client.post(f"/courses/{FREE_COURSE}/quiz/attempts", json=payload, headers=auth)
    assert first.status_code == 201 and again.status_code == 200
    assert first.json()["id"] == again.json()["id"]
    changed = {**payload, "answers": _answers(client, FREE_COURSE, correct=False)}
    conflict = client.post(f"/courses/{FREE_COURSE}/quiz/attempts", json=changed, headers=auth)
    assert conflict.status_code == 409


def test_guest_quiz_result_is_not_saved(client):
    r = client.post(
        f"/courses/{FREE_COURSE}/quiz/attempts",
        json={"answers": _answers(client, FREE_COURSE, correct=True)},
    )
    assert r.status_code == 200 and r.json()["id"] is None


def test_quiz_attempt_rejects_incomplete_answers(client, auth):
    answers = _answers(client, FREE_COURSE, correct=True)[:-1]
    r = client.post(
        f"/courses/{FREE_COURSE}/quiz/attempts", json={"answers": answers}, headers=auth
    )
    assert r.status_code == 422


def test_reset_progress_keeps_purchases(client, auth):
    client.post(f"/courses/{PAID_COURSE}/purchase", headers=auth)
    client.put(f"/courses/{FREE_COURSE}/lessons/sec-1/completion", headers=auth)
    assert client.delete("/users/me/progress", headers=auth).status_code == 204
    assert client.get("/users/me/progress", headers=auth).json()["completed"] == {}
    assert client.get("/users/me", headers=auth).json()["purchases"] == [PAID_COURSE]
