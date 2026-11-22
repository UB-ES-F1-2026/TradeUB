"""Tests d'acceptació del Sprint 2 (QA 5, #133): missatges d'error exactes.

Cada missatge s'escriu literal, copiat del criteri d'acceptació de Trello, i no
s'importa la constant del codi: si algú canvia el text de l'API, el test ha de
fallar encara que els tests unitaris de l'endpoint segueixin passant.
La taula criteri → test és a docs/qa/pla-proves.md.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from supabase import PostgrestAPIError

import main
from api import deps
from core.pin import hash_pin
from core.verification import REVIEW_SECONDS, TERMS_VERSION

SUBJECT = "11111111-2222-3333-4444-555555555555"

DEPOSITS = "/api/v1/account/deposits"
WITHDRAWALS = "/api/v1/account/withdrawals"
PIN = "/api/v1/profile/pin"
IBAN = "/api/v1/profile/iban"


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
        ("post", WITHDRAWALS, {"amount": "50"}),
        ("get", "/api/v1/account/balance", None),
        ("get", "/api/v1/account/movements", None),
        ("post", PIN, {"pin": "1234"}),
    ],
    ids=["ingres", "retirada", "saldo", "historial", "crear-pin"],
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


# --- US3.3 Retirar diners ficticis ---


class FakeWithdrawalAdmin:
    """Client d'administració amb el PIN, l'IBAN i el saldo de l'usuari.

    La funció process_cash_movement retorna el saldo nou o llança l'error
    ``rpc_error`` (P0003 és el saldo insuficient de la migració).
    """

    def __init__(self, pin_hash, balance, rpc_error):
        self.rows = {
            "profile_pins": [{"pin_hash": pin_hash}] if pin_hash else [],
            "profiles": [{**VERIFIED_PROFILE, "iban": "ES9121000418450200051332"}],
            "accounts": [{"balance": balance}],
        }
        self.rpc_error = rpc_error
        self.rpc_call = None
        self._table = None

    def table(self, name):
        self._table = name
        return self

    def select(self, *columns):
        return self

    def eq(self, column, value):
        return self

    def rpc(self, name, params):
        self.rpc_call = (name, params)
        self._table = "rpc"
        return self

    def execute(self):
        if self._table != "rpc":
            return SimpleNamespace(data=self.rows[self._table])
        if self.rpc_error is not None:
            raise self.rpc_error
        balance = self.rows["accounts"][0]["balance"]
        return SimpleNamespace(data=balance + float(self.rpc_call[1]["p_amount"]))


@pytest.fixture
def withdrawal_admin():
    def install(pin_hash=hash_pin("1234"), balance=50, rpc_error=None):
        admin = FakeWithdrawalAdmin(pin_hash, balance, rpc_error)
        main.app.dependency_overrides[deps.get_admin_client] = lambda: admin
        return admin

    yield install
    main.app.dependency_overrides.clear()


INSUFFICIENT = PostgrestAPIError({"message": "Insufficient balance", "code": "P0003"})
DB_ERROR = PostgrestAPIError({"message": "boom"})


@pytest.mark.parametrize(
    ("pin", "admin_kwargs", "amount", "status", "detail"),
    [
        ("1234", {}, "0.99", 422, "L'import mínim de retirada és d'1 €."),
        (
            "1234",
            {"rpc_error": INSUFFICIENT},
            "80",
            422,
            "Saldo insuficient. Et falten 30,00 € per completar l'operació",
        ),
        ("0000", {}, "10", 403, "El PIN introduït és incorrecte."),
        (
            "1234",
            {"pin_hash": None},
            "10",
            403,
            "Cal configurar el PIN de seguretat al perfil per fer aquesta operació.",
        ),
        (
            "1234",
            {"rpc_error": DB_ERROR},
            "10",
            500,
            "No s'ha pogut processar la retirada. El teu saldo no ha canviat.",
        ),
    ],
    ids=["minim", "saldo-insuficient", "pin-incorrecte", "sense-pin", "fallada-bd"],
)
def test_withdrawal_errors(
    client, auth, verified, withdrawal_admin, pin, admin_kwargs, amount, status, detail
):
    withdrawal_admin(**admin_kwargs)

    response = client.post(
        WITHDRAWALS, headers={**auth, "X-PIN": pin}, json={"amount": amount}
    )

    assert response.status_code == status
    assert response.json()["detail"] == detail


def test_withdrawal_with_correct_pin_returns_new_balance(
    client, auth, verified, withdrawal_admin
):
    """US3.3: en confirmar la retirada, el saldo es redueix."""
    admin = withdrawal_admin(balance=50)

    response = client.post(
        WITHDRAWALS, headers={**auth, "X-PIN": "1234"}, json={"amount": "10"}
    )

    assert response.status_code == 201
    assert response.json() == {"balance": 40}
    assert admin.rpc_call[1]["p_amount"] == "-10"


def test_invalid_iban(client, auth, verified, fake_admin):
    response = client.put(IBAN, headers=auth, json={"iban": "ES0000000000000000000000"})

    assert response.status_code == 422
    assert response.json()["detail"] == "El codi IBAN no és vàlid."
