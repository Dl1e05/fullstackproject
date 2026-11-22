from conftest import FREE_COURSE, PAID_COURSE


def test_free_lesson_open_for_guest(client):
    r = client.get(f"/courses/{FREE_COURSE}/lessons/sec-2")
    assert r.status_code == 200
    body = r.json()
    assert body["locked"] is False and body["summary"] and body["keyPoints"]
    assert body["prevId"] == "sec-1" and body["nextId"] == "sec-3"
    assert "correctId" not in (body["practice"] or {})


def test_paid_course_gates_guest(client):
    preview = client.get(f"/courses/{PAID_COURSE}/lessons/ai-1").json()
    assert preview["locked"] is False and preview["summary"]
    locked = client.get(f"/courses/{PAID_COURSE}/lessons/ai-2").json()
    assert locked["locked"] is True and locked["summary"] is None and locked["practice"] is None
    assert client.get(f"/courses/{PAID_COURSE}/quiz").status_code == 402


def test_lesson_not_found(client):
    assert client.get(f"/courses/{FREE_COURSE}/lessons/nope").status_code == 404


def test_purchase_requires_auth_and_paid_course(client, auth):
    assert client.post(f"/courses/{PAID_COURSE}/purchase").status_code == 401
    assert client.post(f"/courses/{FREE_COURSE}/purchase", headers=auth).status_code == 400
    assert client.post("/courses/nope/purchase", headers=auth).status_code == 404


def test_purchase_unlocks_course(client, auth):
    r = client.post(f"/courses/{PAID_COURSE}/purchase", headers=auth)
    assert r.status_code == 200 and r.json()["purchases"] == [PAID_COURSE]
    # повторная покупка ничего не ломает
    again = client.post(f"/courses/{PAID_COURSE}/purchase", headers=auth)
    assert again.status_code == 200 and again.json()["purchases"] == [PAID_COURSE]

    assert client.get(f"/courses/{PAID_COURSE}", headers=auth).json()["hasAccess"] is True
    lesson = client.get(f"/courses/{PAID_COURSE}/lessons/ai-2", headers=auth).json()
    assert lesson["locked"] is False and lesson["summary"]
    assert client.get(f"/courses/{PAID_COURSE}/quiz", headers=auth).status_code == 200
    # без токена доступа по-прежнему нет
    assert client.get(f"/courses/{PAID_COURSE}/quiz").status_code == 402


def test_practice_attempt_checks_answer(client):
    ok = client.post("/exercises/ex-sec-1/attempts", json={"optionId": "c"})
    assert ok.status_code == 200
    assert ok.json() == {"correct": True, "correctId": "c", "explanation": ok.json()["explanation"]}
    wrong = client.post("/exercises/ex-sec-1/attempts", json={"optionId": "a"}).json()
    assert wrong["correct"] is False and wrong["correctId"] == "c"
    assert client.post("/exercises/nope/attempts", json={"optionId": "a"}).status_code == 404


def test_paid_practice_attempt_is_gated(client):
    assert client.post("/exercises/ex-ai-2/attempts", json={"optionId": "a"}).status_code == 402
