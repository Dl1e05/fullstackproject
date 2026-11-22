from conftest import PASSWORD, register


def test_register_and_me(client):
    data = register(client)
    assert data["user"]["email"] == "user@example.com"
    assert data["user"]["purchases"] == []
    r = client.get("/users/me", headers={"Authorization": f"Bearer {data['accessToken']}"})
    assert r.status_code == 200
    assert r.json()["name"] == "Иван"


def test_register_duplicate_email_conflicts(client):
    register(client, email="Dup@Example.com")
    r = client.post(
        "/auth/register", json={"name": "Иван", "email": "dup@example.com", "password": PASSWORD}
    )
    assert r.status_code == 409


def test_register_validates_input(client):
    r = client.post("/auth/register", json={"name": "И", "email": "bad", "password": "1"})
    assert r.status_code == 422


def test_login_ok_and_wrong_password(client):
    register(client)
    ok = client.post("/auth/login", json={"email": "user@example.com", "password": PASSWORD})
    assert ok.status_code == 200 and ok.json()["accessToken"]
    bad = client.post("/auth/login", json={"email": "user@example.com", "password": "wrong-pass"})
    assert bad.status_code == 401


def test_me_requires_valid_token(client):
    assert client.get("/users/me").status_code == 401
    assert client.get("/users/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_logout_revokes_token(client, auth):
    assert client.post("/auth/logout", headers=auth).status_code == 204
    assert client.get("/users/me", headers=auth).status_code == 401


def test_update_name(client, auth):
    r = client.patch("/users/me", json={"name": "Пётр"}, headers=auth)
    assert r.status_code == 200 and r.json()["name"] == "Пётр"


def test_password_reset_flow(client, monkeypatch):
    from app.main import app
    from app.services.email import get_email_sender

    sent: list[tuple[str, str]] = []

    class Recorder:
        def send_password_reset(self, email: str, token: str) -> None:
            sent.append((email, token))

    app.dependency_overrides[get_email_sender] = Recorder
    try:
        register(client)
        # неизвестная почта отвечает так же, письмо не уходит
        assert (
            client.post("/auth/forgot-password", json={"email": "no@example.com"}).status_code
            == 202
        )
        assert sent == []
        assert (
            client.post("/auth/forgot-password", json={"email": "user@example.com"}).status_code
            == 202
        )
        token = sent[0][1]
    finally:
        app.dependency_overrides.pop(get_email_sender, None)

    new = "BrandNewPass456"
    assert (
        client.post("/auth/reset-password", json={"token": token, "password": new}).status_code
        == 204
    )
    # токен одноразовый
    assert (
        client.post("/auth/reset-password", json={"token": token, "password": new}).status_code
        == 400
    )
    assert (
        client.post("/auth/login", json={"email": "user@example.com", "password": new}).status_code
        == 200
    )
    assert (
        client.post(
            "/auth/login", json={"email": "user@example.com", "password": PASSWORD}
        ).status_code
        == 401
    )
