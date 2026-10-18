import httpx
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from api import deps, mfa


def test_enroll_totp_returns_factor_data_and_sends_access_token(monkeypatch):
    calls = []
    response = httpx.Response(
        200,
        json={
            "id": "factor-123",
            "totp": {
                "uri": "otpauth://totp/TradeUB:user@example.com?secret=SECRET",
                "secret": "SECRET",
            },
        },
    )

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return response

    monkeypatch.setattr(mfa.httpx, "post", fake_post)

    result = mfa.enroll_totp("access-token")

    assert result == {
        "factor_id": "factor-123",
        "uri": "otpauth://totp/TradeUB:user@example.com?secret=SECRET",
        "secret": "SECRET",
    }
    assert calls == [
        (
            f"{mfa.AUTH_URL}/factors",
            {
                "headers": {
                    "apikey": mfa.SUPABASE_KEY,
                    "Authorization": "Bearer access-token",
                    "Content-Type": "application/json",
                },
                "json": {"factor_type": "totp", "friendly_name": "TradeUB"},
                "timeout": 10.0,
            },
        )
    ]


def test_enroll_totp_returns_service_error(monkeypatch):
    response = httpx.Response(
        400,
        json={"msg": "The user already has a TOTP factor"},
    )
    monkeypatch.setattr(mfa.httpx, "post", lambda *args, **kwargs: response)

    with pytest.raises(HTTPException) as error:
        mfa.enroll_totp("access-token")

    assert error.value.status_code == 502
    assert error.value.detail == "The user already has a TOTP factor"


def test_enroll_totp_returns_unavailable_when_supabase_cannot_be_reached(monkeypatch):
    def raise_connection_error(*args, **kwargs):
        raise httpx.ConnectError("connection failed")

    monkeypatch.setattr(mfa.httpx, "post", raise_connection_error)

    with pytest.raises(HTTPException) as error:
        mfa.enroll_totp("access-token")

    assert error.value.status_code == 503


def test_verify_totp_creates_challenge_and_verifies_code(monkeypatch):
    calls = []
    responses = iter(
        [
            httpx.Response(200, json={"id": "challenge-123"}),
            httpx.Response(200, json={"access_token": "new-token"}),
        ]
    )

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return next(responses)

    monkeypatch.setattr(mfa.httpx, "post", fake_post)

    result = mfa.verify_totp(mfa.MfaCode(factor_id="factor-123", code="123456"), "access-token")

    assert result == {"verified": True}
    assert calls[0][0] == f"{mfa.AUTH_URL}/factors/factor-123/challenge"
    assert calls[1] == (
        f"{mfa.AUTH_URL}/factors/factor-123/verify",
        {
            "headers": {
                "apikey": mfa.SUPABASE_KEY,
                "Authorization": "Bearer access-token",
                "Content-Type": "application/json",
            },
            "json": {"challenge_id": "challenge-123", "code": "123456"},
            "timeout": 10.0,
        },
    )


def test_verify_totp_returns_exact_invalid_code_message(monkeypatch):
    monkeypatch.setattr(
        mfa.httpx,
        "post",
        lambda url, **kwargs: (
            httpx.Response(200, json={"id": "challenge-123"})
            if url.endswith("/challenge")
            else httpx.Response(400, json={"msg": "Invalid code"})
        ),
    )

    with pytest.raises(HTTPException) as error:
        mfa.verify_totp(mfa.MfaCode(factor_id="factor-123", code="000000"), "access-token")

    assert error.value.status_code == 400
    assert error.value.detail == "El codi d'autenticació és incorrecte"


def test_mfa_code_requires_six_digits():
    with pytest.raises(ValidationError):
        mfa.MfaCode(factor_id="factor-123", code="12345")

    with pytest.raises(ValidationError):
        mfa.MfaCode(factor_id="factor-123", code="12345a")


def test_get_access_token_validates_and_returns_credentials(monkeypatch):
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="access-token",
    )
    monkeypatch.setattr(deps, "get_current_user", lambda received: {"sub": "user-123"})

    assert deps.get_access_token(credentials) == "access-token"
