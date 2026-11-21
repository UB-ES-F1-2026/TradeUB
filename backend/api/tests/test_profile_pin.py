"""Tests HTTP de GET i POST /api/v1/profile/pin (US1.5).

La validació del token ja es prova a test_users_me.py i la de l'usuari
verificat a test_identity_verification.py. Aquí es comprova que els
endpoints les fan servir i la lògica del PIN.
"""

from datetime import UTC, datetime, timedelta

import pytest
from supabase import PostgrestAPIError

from core.pin import PIN_FORMAT_ERROR, hash_pin, verify_pin
from core.verification import REVIEW_SECONDS, TERMS_VERSION

PIN_ENDPOINT = "/api/v1/profile/pin"

SUBJECT = "11111111-2222-3333-4444-555555555555"

DB_ERROR = PostgrestAPIError({"message": "boom"})


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


# --- GET /profile/pin ---


def test_get_pin_requires_token(client):
    assert client.get(PIN_ENDPOINT).status_code == 401


def test_get_pin_without_pin_is_not_configured(client, auth, fake_pins):
    pins = fake_pins(pin_hash=None)

    response = client.get(PIN_ENDPOINT, headers=auth)

    assert response.status_code == 200
    assert response.json() == {"configurat": False}
    assert pins.eq_args == [("user_id", SUBJECT)]


def test_get_pin_with_pin_is_configured_and_hides_hash(client, auth, fake_pins):
    """Només retorna el booleà: el hash no surt mai cap al client."""
    fake_pins(pin_hash=hash_pin("1234"))

    response = client.get(PIN_ENDPOINT, headers=auth)

    assert response.status_code == 200
    assert response.json() == {"configurat": True}


def test_get_pin_database_error_returns_500(client, auth, fake_pins):
    fake_pins(error=DB_ERROR)

    response = client.get(PIN_ENDPOINT, headers=auth)

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut recuperar el PIN"


# --- POST /profile/pin ---


def test_save_pin_requires_token(client):
    assert client.post(PIN_ENDPOINT, json={"pin": "1234"}).status_code == 401


def test_save_pin_rejects_unverified_user(client, auth, fake_profile, fake_pins):
    fake_profile(rows=[{"id": SUBJECT}])
    pins = fake_pins()

    response = client.post(PIN_ENDPOINT, headers=auth, json={"pin": "1234"})

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Cal verificar la identitat i acceptar els termes per operar"
    )
    assert pins.upserted is None


def test_save_pin_creates_pin_as_hash(client, auth, verified, fake_pins):
    """El primer PIN no demana l'actual i es desa com a hash, per al sub del token."""
    pins = fake_pins(pin_hash=None)

    response = client.post(PIN_ENDPOINT, headers=auth, json={"pin": "1234"})

    assert response.status_code == 200
    assert response.json() == {"configurat": True}
    assert pins.upserted["user_id"] == SUBJECT
    assert pins.upserted["pin_hash"] != "1234"
    assert verify_pin("1234", pins.upserted["pin_hash"]) is True
    assert pins.on_conflict == "user_id"


def test_save_pin_ignores_user_id_in_body(client, auth, verified, fake_pins):
    """El PIN sempre es desa per a l'usuari del token, no per al del cos."""
    pins = fake_pins(pin_hash=None)

    response = client.post(
        PIN_ENDPOINT,
        headers=auth,
        json={"pin": "1234", "user_id": "99999999-9999-9999-9999-999999999999"},
    )

    assert response.status_code == 200
    assert pins.upserted["user_id"] == SUBJECT


@pytest.mark.parametrize(
    "pin",
    ["123", "12345", "12a4", "", " 1234"],
    ids=["three-digits", "five-digits", "letter", "empty", "space"],
)
def test_save_pin_rejects_invalid_format(client, auth, verified, fake_pins, pin):
    pins = fake_pins(pin_hash=None)

    response = client.post(PIN_ENDPOINT, headers=auth, json={"pin": pin})

    assert response.status_code == 422
    assert response.json()["detail"] == PIN_FORMAT_ERROR
    assert pins.upserted is None


def test_save_pin_changes_pin_with_current_pin(client, auth, verified, fake_pins):
    pins = fake_pins(pin_hash=hash_pin("1234"))

    response = client.post(
        PIN_ENDPOINT, headers=auth, json={"pin": "5678", "pin_actual": "1234"}
    )

    assert response.status_code == 200
    assert verify_pin("5678", pins.upserted["pin_hash"]) is True
    assert verify_pin("1234", pins.upserted["pin_hash"]) is False


@pytest.mark.parametrize(
    "body",
    [{"pin": "5678", "pin_actual": "0000"}, {"pin": "5678"}],
    ids=["wrong-current", "missing-current"],
)
def test_save_pin_change_requires_correct_current_pin(
    client, auth, verified, fake_pins, body
):
    pins = fake_pins(pin_hash=hash_pin("1234"))

    response = client.post(PIN_ENDPOINT, headers=auth, json=body)

    assert response.status_code == 403
    assert response.json()["detail"] == "El PIN actual és incorrecte."
    assert pins.upserted is None


def test_save_pin_with_corrupt_stored_hash_returns_500(
    client, auth, verified, fake_pins
):
    """Un hash desat corrupte és un error del servidor, no un PIN incorrecte."""
    pins = fake_pins(pin_hash="1234")

    response = client.post(
        PIN_ENDPOINT, headers=auth, json={"pin": "5678", "pin_actual": "1234"}
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut comprovar el PIN"
    assert pins.upserted is None


def test_save_pin_read_error_returns_500(client, auth, verified, fake_pins):
    fake_pins(error=DB_ERROR)

    response = client.post(PIN_ENDPOINT, headers=auth, json={"pin": "1234"})

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut recuperar el PIN"


def test_save_pin_write_error_returns_500(client, auth, verified, fake_pins):
    fake_pins(upsert_error=DB_ERROR)

    response = client.post(PIN_ENDPOINT, headers=auth, json={"pin": "1234"})

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut desar el PIN"
