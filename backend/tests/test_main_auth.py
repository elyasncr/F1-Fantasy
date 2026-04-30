from services.auth_service import verify_password


def test_register_stores_bcrypt_hash_not_plaintext(client, db_session):
    import models

    response = client.post("/register", json={"username": "alice", "password": "senha123"})
    assert response.status_code == 200

    user = db_session.query(models.User).filter_by(username="alice").first()
    assert user is not None
    assert user.password_hash != "senha123"
    assert verify_password("senha123", user.password_hash) is True


def test_register_rejects_duplicate_username(client):
    client.post("/register", json={"username": "bob", "password": "x"})
    second = client.post("/register", json={"username": "bob", "password": "y"})
    assert second.status_code == 400


def test_login_accepts_correct_password(client):
    client.post("/register", json={"username": "carol", "password": "p4ss"})
    response = client.post("/login", json={"username": "carol", "password": "p4ss"})
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "carol"
    assert "user_id" in body


def test_login_rejects_wrong_password(client):
    client.post("/register", json={"username": "dave", "password": "right"})
    response = client.post("/login", json={"username": "dave", "password": "wrong"})
    assert response.status_code == 401


def test_login_rejects_unknown_user(client):
    response = client.post("/login", json={"username": "ghost", "password": "x"})
    assert response.status_code == 401
