"""Tests de la dependència require_pin (US1.5) i del bloqueig del PIN (US1.6).

La US1.5 no té cap operació que demani el PIN (la primera és la retirada,
US3.3), així que es prova amb una ruta de prova, com require_verified_user a
test_identity_verification.py.

El doble de profile_pins (conftest.FakePinsClient) aplica la mateixa lògica
que la funció SQL register_pin_attempt; l'atomicitat (for update) només es
pot provar contra Postgres.
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import Depends
from fastapi.routing import APIRoute
from supabase import PostgrestAPIError

import main
from api import account, deps, profile, users
from core import profile_pins
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
    assert response.json()["detail"] == f"{WRONG_PIN_ERROR} Et queden 2 intents."


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


# --- US1.6 Bloqueig per intents fallits ---

LOCKED_ERROR = "Has superat el nombre d'intents. Torna-ho a provar d'aquí a {} minuts."


def _in(seconds: int) -> datetime:
    return datetime.now(UTC) + timedelta(seconds=seconds)


def _post_pin(client, auth, pin):
    return client.post(PROTECTED_ENDPOINT, headers={**auth, "X-PIN": pin})


def test_wrong_pins_count_down_and_lock_on_third(
    client, auth, verified, fake_pins, protected_route
):
    """C1 i C2: cada error resta un intent i el 3r bloqueja 15 minuts."""
    pins = fake_pins(pin_hash=hash_pin("1234"))

    first = _post_pin(client, auth, "0000")
    second = _post_pin(client, auth, "0000")
    third = _post_pin(client, auth, "0000")

    assert first.status_code == 403
    assert first.json()["detail"] == f"{WRONG_PIN_ERROR} Et queden 2 intents."
    assert second.status_code == 403
    assert second.json()["detail"] == f"{WRONG_PIN_ERROR} Et queda 1 intent."
    assert third.status_code == 429
    assert third.json()["detail"] == LOCKED_ERROR.format(15)
    assert third.headers["Retry-After"] == "900"
    assert pins.attempts == [{"p_user_id": SUBJECT, "p_success": False}] * 3


def test_locked_pin_reports_minutes_left_rounded_up(
    client, auth, verified, fake_pins, protected_route
):
    """C3: mentre dura el bloqueig, 429 amb els minuts que falten arrodonits."""
    fake_pins(
        pin_hash=hash_pin("1234"), failed_attempts=3, locked_until=_in(10 * 60 + 30)
    )

    response = _post_pin(client, auth, "0000")

    assert response.status_code == 429
    assert response.json()["detail"] == LOCKED_ERROR.format(11)
    assert 620 <= int(response.headers["Retry-After"]) <= 630


def test_locked_pin_with_less_than_a_minute_left(
    client, auth, verified, fake_pins, protected_route
):
    fake_pins(pin_hash=hash_pin("1234"), failed_attempts=3, locked_until=_in(30))

    response = _post_pin(client, auth, "0000")

    assert response.status_code == 429
    assert response.json()["detail"] == (
        "Has superat el nombre d'intents. Torna-ho a provar d'aquí a 1 minut."
    )


def test_locked_pin_is_not_checked_even_if_correct(
    client, auth, verified, fake_pins, protected_route, monkeypatch
):
    """C4: amb el bloqueig actiu no es comprova el PIN ni es compta l'intent."""
    pins = fake_pins(
        pin_hash=hash_pin("1234"), failed_attempts=3, locked_until=_in(600)
    )

    def _must_not_verify(*args):
        raise AssertionError("No s'ha de comprovar el PIN amb el bloqueig actiu")

    monkeypatch.setattr(profile_pins, "verify_pin", _must_not_verify)

    response = _post_pin(client, auth, "1234")

    assert response.status_code == 429
    assert pins.attempts == []


def test_expired_lock_resets_counter(
    client, auth, verified, fake_pins, protected_route
):
    """C5: quan el bloqueig caduca, el comptador torna a començar."""
    pins = fake_pins(
        pin_hash=hash_pin("1234"), failed_attempts=3, locked_until=_in(-1)
    )

    response = _post_pin(client, auth, "0000")

    assert response.status_code == 403
    assert response.json()["detail"] == f"{WRONG_PIN_ERROR} Et queden 2 intents."
    assert pins.failed_attempts == 1
    assert pins.locked_until is None


def test_correct_pin_resets_counter(
    client, auth, verified, fake_pins, protected_route
):
    """C6: un PIN correcte torna el comptador a 0."""
    pins = fake_pins(pin_hash=hash_pin("1234"), failed_attempts=2)

    ok = _post_pin(client, auth, "1234")
    wrong = _post_pin(client, auth, "0000")

    assert ok.status_code == 200
    assert pins.attempts[0] == {"p_user_id": SUBJECT, "p_success": True}
    assert wrong.json()["detail"] == f"{WRONG_PIN_ERROR} Et queden 2 intents."


def test_lock_from_parallel_request_wins_over_correct_pin(
    client, auth, verified, fake_pins, protected_route, monkeypatch
):
    """Si una altra petició bloqueja el PIN mentre es comprova, mana el bloqueig.

    La lectura prèvia no veu el bloqueig, però la funció SQL, que bloqueja la
    fila, sí: el PIN correcte no passa.
    """
    pin_hash = hash_pin("1234")
    fake_pins(pin_hash=pin_hash, failed_attempts=3, locked_until=_in(600))
    monkeypatch.setattr(
        deps,
        "get_pin_record",
        lambda admin, user_id: {"pin_hash": pin_hash, "locked_until": None},
    )

    response = _post_pin(client, auth, "1234")

    assert response.status_code == 429


def test_operations_and_pin_change_share_counter(
    client, auth, verified, fake_pins, protected_route
):
    """Els errors a les operacions i al canvi de PIN sumen al mateix comptador."""
    pins = fake_pins(pin_hash=hash_pin("1234"))

    _post_pin(client, auth, "0000")
    _post_pin(client, auth, "0000")
    response = client.post(
        "/api/v1/profile/pin",
        headers=auth,
        json={"pin": "5678", "pin_actual": "0000"},
    )

    assert response.status_code == 429
    assert response.json()["detail"] == LOCKED_ERROR.format(15)
    assert pins.upserted is None


def test_register_attempt_error_returns_500(
    client, auth, verified, fake_pins, protected_route
):
    fake_pins(
        pin_hash=hash_pin("1234"), rpc_error=PostgrestAPIError({"message": "boom"})
    )

    response = _post_pin(client, auth, "1234")

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut comprovar el PIN"


# C7: el login el fa Supabase Auth directament, sense passar pel backend.
# Les rutes de saldo, historial i perfil no poden dependre de require_pin.
ROUTES_WITHOUT_PIN = [
    (users.router, "GET", "/me"),
    (account.router, "GET", "/balance"),
    (account.router, "GET", "/positions"),
    (account.router, "GET", "/movements"),
    (profile.router, "GET", "/pin"),
    (profile.router, "PATCH", "/personal-data"),
]


def _dependency_calls(dependant):
    for dependency in dependant.dependencies:
        yield dependency.call
        yield from _dependency_calls(dependency)


def _route(router, method, path):
    return next(
        route
        for route in router.routes
        if isinstance(route, APIRoute)
        and route.path == path
        and method in route.methods
    )


@pytest.mark.parametrize(
    ("router", "method", "path"),
    ROUTES_WITHOUT_PIN,
    ids=[f"{method} {path}" for _, method, path in ROUTES_WITHOUT_PIN],
)
def test_lock_only_applies_to_pin_routes(router, method, path):
    """C7: el bloqueig només el consulten require_pin i el canvi de PIN."""
    calls = set(_dependency_calls(_route(router, method, path).dependant))

    assert deps.require_pin not in calls


def test_locked_pin_does_not_block_profile_or_pin_status(
    client, auth, fake_profile, fake_pins
):
    """C7: amb el PIN bloquejat, el perfil i l'estat del PIN responen igual."""
    fake_profile(rows=[VERIFIED_PROFILE])
    pins = fake_pins(
        pin_hash=hash_pin("1234"), failed_attempts=3, locked_until=_in(600)
    )

    me = client.get("/api/v1/users/me", headers=auth)
    status = client.get("/api/v1/profile/pin", headers=auth)

    assert me.status_code == 200
    assert status.status_code == 200
    assert status.json() == {"configurat": True}
    assert pins.attempts == []
