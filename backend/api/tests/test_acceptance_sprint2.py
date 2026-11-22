"""Tests d'acceptació del Sprint 2 (QA 5, #133): missatges d'error exactes.

Cada missatge s'escriu literal, copiat del criteri d'acceptació de Trello, i no
s'importa la constant del codi: si algú canvia el text de l'API, el test ha de
fallar encara que els tests unitaris de l'endpoint segueixin passant.
La taula criteri → test és a docs/qa/pla-proves.md.
"""

from datetime import UTC, datetime, timedelta

import pytest
from supabase import PostgrestAPIError

from core.pin import hash_pin
from core.verification import REVIEW_SECONDS, TERMS_VERSION

SUBJECT = "11111111-2222-3333-4444-555555555555"

DEPOSITS = "/api/v1/account/deposits"
PIN = "/api/v1/profile/pin"


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
    fake_profile(rows=[VERIFIED_PROFILE])


# --- US3.2 Ingressar diners ficticis ---


@pytest.mark.parametrize(
    ("amount", "detail"),
    [
        ("0.99", "L'import mínim d'ingrés és d'1 €."),
        ("10000.01", "L'import màxim per operació és de 10.000 €."),
    ],
    ids=["US3.2-minim", "US3.2-maxim"],
)
def test_deposit_limits(client, auth, verified, fake_admin, amount, detail):
    admin = fake_admin(rows=0)

    response = client.post(DEPOSITS, headers=auth, json={"amount": amount})

    assert response.status_code == 422
    assert response.json()["detail"] == detail
    assert admin.rpc_call is None


def test_deposit_database_failure(client, auth, verified, fake_admin):
    """US3.2: si falla la base de dades, no s'aplica cap canvi."""
    fake_admin(error=PostgrestAPIError({"message": "boom"}))

    response = client.post(DEPOSITS, headers=auth, json={"amount": "50"})

    assert response.status_code == 500
    assert response.json()["detail"] == (
        "No s'ha pogut processar el dipòsit. El teu saldo no ha canviat."
    )


# --- 403 per a usuaris no verificats (US2.4, US1.5, US3.2, US3.5) ---


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("post", DEPOSITS, {"amount": "50"}),
        ("get", "/api/v1/account/balance", None),
        ("get", "/api/v1/account/movements", None),
        ("post", PIN, {"pin": "1234"}),
    ],
    ids=["ingres", "saldo", "historial", "crear-pin"],
)
def test_unverified_user_cannot_operate(
    client, auth, fake_profile, fake_admin, method, path, body
):
    fake_profile(rows=[{"id": SUBJECT}])
    admin = fake_admin(rows=0)

    response = client.request(method.upper(), path, headers=auth, json=body)

    assert response.status_code == 403
    assert (
        response.json()["detail"]
        == "Cal verificar la identitat i acceptar els termes per operar"
    )
    assert admin.rpc_call is None


# --- US1.5 PIN de seguretat ---


@pytest.mark.parametrize(
    "pin", ["123", "12345", "12a4", ""], ids=["3-digits", "5-digits", "lletra", "buit"]
)
def test_pin_must_have_four_digits(client, auth, verified, fake_pins, pin):
    pins = fake_pins()

    response = client.post(PIN, headers=auth, json={"pin": pin})

    assert response.status_code == 422
    assert response.json()["detail"] == "El PIN ha de tenir 4 dígits."
    assert pins.upserted is None


def test_pin_change_with_wrong_current_pin(client, auth, verified, fake_pins):
    pins = fake_pins(pin_hash=hash_pin("1234"))

    response = client.post(
        PIN, headers=auth, json={"pin": "5678", "pin_actual": "0000"}
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "El PIN actual és incorrecte."
    assert pins.upserted is None
