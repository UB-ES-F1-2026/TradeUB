"""Tests de la dependència require_pin (US1.5).

La US1.5 no té cap operació que demani el PIN (la primera és la retirada,
US3.3), així que es prova amb una ruta de prova, com require_verified_user a
test_identity_verification.py.
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import Depends
from supabase import PostgrestAPIError

import main
from api import deps
from core.pin import hash_pin
from core.verification import REVIEW_SECONDS, TERMS_VERSION

PROTECTED_ENDPOINT = "/api/v1/test/require-pin"

SUBJECT = "11111111-2222-3333-4444-555555555555"

NO_PIN_ERROR = "Cal configurar el PIN de seguretat al perfil per fer aquesta operació."
WRONG_PIN_ERROR = "El PIN introduït és incorrecte."


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


@pytest.fixture
def protected_route():
    """Ruta de prova que fa servir la dependència, com farà la retirada."""

    @main.app.post(PROTECTED_ENDPOINT)
    def _protected(user=Depends(deps.require_pin)):
        return {"sub": user["sub"]}

    yield
    main.app.router.routes.pop()


def test_require_pin_allows_correct_pin(
    client, auth, verified, fake_pins, protected_route
):
    pins = fake_pins(pin_hash=hash_pin("1234"))

    response = client.post(PROTECTED_ENDPOINT, headers={**auth, "X-PIN": "1234"})

    assert response.status_code == 200
    assert response.json() == {"sub": SUBJECT}
    assert pins.eq_args == [("user_id", SUBJECT)]


@pytest.mark.parametrize(
    "headers",
    [{"X-PIN": "0000"}, {"X-PIN": "12a4"}, {}],
    ids=["wrong-pin", "bad-format", "missing-header"],
)
def test_require_pin_rejects_wrong_pin(
    client, auth, verified, fake_pins, protected_route, headers
):
    fake_pins(pin_hash=hash_pin("1234"))

    response = client.post(PROTECTED_ENDPOINT, headers={**auth, **headers})

    assert response.status_code == 403
    assert response.json()["detail"] == WRONG_PIN_ERROR


def test_require_pin_without_configured_pin(
    client, auth, verified, fake_pins, protected_route
):
    fake_pins(pin_hash=None)

    response = client.post(PROTECTED_ENDPOINT, headers={**auth, "X-PIN": "1234"})

    assert response.status_code == 403
    assert response.json()["detail"] == NO_PIN_ERROR


def test_require_pin_rejects_unverified_user(
    client, auth, fake_profile, fake_pins, protected_route
):
    """Inclou require_verified_user: sense verificar, el PIN no s'arriba a mirar."""
    fake_profile(rows=[{"id": SUBJECT}])
    pins = fake_pins(pin_hash=hash_pin("1234"))

    response = client.post(PROTECTED_ENDPOINT, headers={**auth, "X-PIN": "1234"})

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Cal verificar la identitat i acceptar els termes per operar"
    )
    assert pins.eq_args == []


def test_require_pin_requires_token(client, protected_route):
    response = client.post(PROTECTED_ENDPOINT, headers={"X-PIN": "1234"})

    assert response.status_code == 401


def test_require_pin_database_error_returns_500(
    client, auth, verified, fake_pins, protected_route
):
    fake_pins(error=PostgrestAPIError({"message": "boom"}))

    response = client.post(PROTECTED_ENDPOINT, headers={**auth, "X-PIN": "1234"})

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut recuperar el PIN"


def test_require_pin_corrupt_hash_returns_500(
    client, auth, verified, fake_pins, protected_route
):
    """Un hash desat corrupte és un error del servidor, no un PIN incorrecte."""
    fake_pins(pin_hash="1234")

    response = client.post(PROTECTED_ENDPOINT, headers={**auth, "X-PIN": "1234"})

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut comprovar el PIN"
