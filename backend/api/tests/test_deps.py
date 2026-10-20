import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from api import deps


def _credentials() -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="access-token",
    )


def test_get_current_user_accepts_aal2_token(monkeypatch):
    class SigningKey:
        key = "public-key"

    monkeypatch.setattr(
        deps.jwks_client,
        "get_signing_key_from_jwt",
        lambda token: SigningKey(),
    )
    monkeypatch.setattr(
        deps.jwt,
        "decode",
        lambda token, key, algorithms, audience, issuer: {
            "sub": "user-123",
            "aal": "aal2",
        },
    )

    assert deps.get_current_user(_credentials()) == {
        "sub": "user-123",
        "aal": "aal2",
    }


def test_get_current_user_rejects_aal1_token(monkeypatch):
    class SigningKey:
        key = "public-key"

    monkeypatch.setattr(
        deps.jwks_client,
        "get_signing_key_from_jwt",
        lambda token: SigningKey(),
    )
    monkeypatch.setattr(
        deps.jwt,
        "decode",
        lambda token, key, algorithms, audience, issuer: {
            "sub": "user-123",
            "aal": "aal1",
        },
    )

    with pytest.raises(HTTPException) as error:
        deps.get_current_user(_credentials())

    assert error.value.status_code == 403
    assert error.value.detail == "Cal completar la verificació en dos passos"


def test_get_user_client_uses_validated_aal2_token(monkeypatch):
    credentials = _credentials()
    expected_client = object()
    monkeypatch.setattr(
        deps,
        "create_user_client",
        lambda token: expected_client,
    )

    assert (
        deps.get_user_client(credentials, {"sub": "user-123", "aal": "aal2"})
        is expected_client
    )
