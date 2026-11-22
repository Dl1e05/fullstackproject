from conftest import FREE_COURSE, PAID_COURSE


def test_topics(client):
    r = client.get("/topics")
    assert r.status_code == 200
    assert len(r.json()) == 7


def test_courses_filters(client):
    all_courses = client.get("/courses").json()
    assert len(all_courses) == 11
    free = client.get("/courses", params={"price": "free"}).json()
    paid = client.get("/courses", params={"price": "paid"}).json()
    assert len(free) + len(paid) == len(all_courses)
    assert all(c["price"] == 0 for c in free) and all(c["price"] > 0 for c in paid)
    by_topic = client.get("/courses", params={"topic": "security"}).json()
    assert by_topic and all(c["topicId"] == "security" for c in by_topic)


def test_courses_search_and_empty_result(client):
    assert any(
        c["id"] == FREE_COURSE for c in client.get("/courses", params={"q": "пароль"}).json()
    )
    assert client.get("/courses", params={"q": "zzzнетТакого"}).json() == []


def test_course_detail_for_guest(client):
    free = client.get(f"/courses/{FREE_COURSE}").json()
    assert free["hasAccess"] is True
    assert free["lessonsCount"] == len(free["lessons"]) > 0
    assert all(not lesson["locked"] for lesson in free["lessons"])

    paid = client.get(f"/courses/{PAID_COURSE}").json()
    assert paid["hasAccess"] is False
    first, *rest = paid["lessons"]
    assert first["preview"] and not first["locked"]
    assert rest and all(lesson["locked"] for lesson in rest)


def test_course_not_found(client):
    assert client.get("/courses/nope").status_code == 404
