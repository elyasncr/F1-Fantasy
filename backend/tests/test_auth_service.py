from services.auth_service import hash_password, verify_password


def test_hash_password_returns_string_different_from_input():
    plain = "minha-senha-secreta"
    hashed = hash_password(plain)
    assert isinstance(hashed, str)
    assert hashed != plain
    assert len(hashed) > 30  # bcrypt hashes are ~60 chars


def test_hash_password_is_not_deterministic():
    plain = "mesma-senha"
    h1 = hash_password(plain)
    h2 = hash_password(plain)
    assert h1 != h2  # bcrypt salts cada hash


def test_verify_password_accepts_correct_plain():
    plain = "abc123"
    hashed = hash_password(plain)
    assert verify_password(plain, hashed) is True


def test_verify_password_rejects_wrong_plain():
    hashed = hash_password("certo")
    assert verify_password("errado", hashed) is False


def test_verify_password_rejects_garbage_hash():
    assert verify_password("qualquer", "isso-nao-eh-bcrypt") is False
