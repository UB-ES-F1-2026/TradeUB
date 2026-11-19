"""Tests HTTP de POST /api/v1/account/deposits (US3.2).

La validació del token ja es prova a test_users_me.py i la de l'usuari
verificat a test_identity_verification.py. Aquí es comprova el contracte de
l'endpoint i que crida process_cash_movement amb el sub del token.
"""

from datetime import UTC, datetime, timedelta

import pytest
from supabase import PostgrestAPIError

from api.account import DEPOSIT_ERROR, MAX_DEPOSIT_ERROR, MIN_DEPOSIT_ERROR
from core.verification import REVIEW_SECONDS, TERMS_VERSION

ENDPOINT = "/api/v1/account/deposits"

SUBJECT = "11111111-2222-3333-4444-555555555555"


def _ago(seconds: int) -> str:
    return (datetime.now(UTC) - timedelta(seconds=seconds)).isoformat()


VERIFIED_PROFILE = {
    "id": SUBJECT,
    "dni_enviat_at": _ago(REVIEW_SECONDS + 60),
    "termes_versio": TERMS_VERSION,
    "termes_acceptats_at": _ago(10),
}


@pytest.fixture
def auth(make_token):
    return {"Authorization": f"Bearer {make_token(sub=SUBJECT)}"}


@pytest.fixture
def verified(fake_profile):
    """L'usuari del token està verificat i ha acceptat els termes."""
    fake_profile(rows=[VERIFIED_PROFILE])


def test_deposit_requires_token(client):
    assert client.post(ENDPOINT, json={"amount": 100}).status_code == 401


def test_deposit_rejects_unverified_user(client, auth, fake_profile, fake_admin):
    fake_profile(rows=[{"id": SUBJECT}])
    admin = fake_admin(rows=10100)

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 403
    assert admin.rpc_call is None


def test_deposit_returns_new_balance(client, auth, verified, fake_admin):
    """Crida la funció atòmica amb el sub del token i retorna el saldo nou."""
    admin = fake_admin(rows=10250.5)

    response = client.post(ENDPOINT, headers=auth, json={"amount": "250.50"})

    assert response.status_code == 201
    assert response.json() == {"balance": 10250.5}
    assert admin.rpc_call == (
        "process_cash_movement",
        {"p_user_id": SUBJECT, "p_type": "ingres", "p_amount": "250.50"},
    )


def test_deposit_ignores_user_id_from_body(client, auth, verified, fake_admin):
    """L'usuari sempre surt del token, mai del cos de la petició."""
    admin = fake_admin(rows=10100)

    response = client.post(
        ENDPOINT,
        headers=auth,
        json={"amount": 100, "user_id": "99999999-9999-9999-9999-999999999999"},
    )

    assert response.status_code == 201
    assert admin.rpc_call[1]["p_user_id"] == SUBJECT


@pytest.mark.parametrize(
    ("amount", "sent"),
    [(1, "1"), ("1.00", "1.00"), (10000, "10000"), ("9999.99", "9999.99"), (0.1 + 1, "1.1")],
    ids=["minimum", "minimum-decimals", "maximum", "below-maximum", "json-float"],
)
def test_deposit_accepts_amounts_within_limits(
    client, auth, verified, fake_admin, amount, sent
):
    admin = fake_admin(rows=10000)

    response = client.post(ENDPOINT, headers=auth, json={"amount": amount})

    assert response.status_code == 201
    assert admin.rpc_call[1]["p_amount"] == sent


@pytest.mark.parametrize(
    ("amount", "detail"),
    [
        ("0.99", MIN_DEPOSIT_ERROR),
        (0, MIN_DEPOSIT_ERROR),
        (-50, MIN_DEPOSIT_ERROR),
        ("10000.01", MAX_DEPOSIT_ERROR),
        (25000, MAX_DEPOSIT_ERROR),
    ],
    ids=["below-minimum", "zero", "negative", "above-maximum", "far-above-maximum"],
)
def test_deposit_rejects_amounts_out_of_limits(
    client, auth, verified, fake_admin, amount, detail
):
    admin = fake_admin(rows=10000)

    response = client.post(ENDPOINT, headers=auth, json={"amount": amount})

    assert response.status_code == 422
    assert response.json()["detail"] == detail
    assert admin.rpc_call is None


@pytest.mark.parametrize(
    "body",
    [
        {"amount": "10.123"},
        {"amount": "abc"},
        {"amount": "NaN"},
        {"amount": "Infinity"},
        {"amount": None},
        {},
    ],
    ids=["three-decimals", "not-a-number", "nan", "infinity", "null", "missing"],
)
def test_deposit_rejects_invalid_amount(client, auth, verified, fake_admin, body):
    admin = fake_admin(rows=10000)

    response = client.post(ENDPOINT, headers=auth, json=body)

    assert response.status_code == 422
    assert admin.rpc_call is None


def test_deposit_database_error_returns_500(client, auth, verified, fake_admin):
    """Si la funció falla, no hi ha canvis i es retorna el missatge de la US."""
    fake_admin(error=PostgrestAPIError({"message": "boom"}))

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 500
    assert response.json()["detail"] == DEPOSIT_ERROR
