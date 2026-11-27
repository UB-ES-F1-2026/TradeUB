"""Tests HTTP de POST /api/v1/account/withdrawals (US3.3).

La dependència require_pin ja es prova a test_require_pin.py i la validació
de l'IBAN a test_iban.py. Aquí es comprova el contracte de l'endpoint: el PIN
de veritat (amb hash) contra un doble del client d'administració que respon
a les taules que llegeix la retirada i a la funció process_cash_movement.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from supabase import PostgrestAPIError

import main
from api import deps
from api.account import (
    MIN_WITHDRAWAL_ERROR,
    NO_IBAN_ERROR,
    WITHDRAWAL_ERROR,
    format_euros,
)
from core.pin import hash_pin
from core.verification import REVIEW_SECONDS, TERMS_VERSION

ENDPOINT = "/api/v1/account/withdrawals"

SUBJECT = "11111111-2222-3333-4444-555555555555"

PIN = "1234"
PIN_HASH = hash_pin(PIN)

IBAN = "ES9121000418450200051332"
MASKED_IBAN = "ES•• •••• •••• •••• •••• 1332"


def _ago(seconds: int) -> str:
    return (datetime.now(UTC) - timedelta(seconds=seconds)).isoformat()


VERIFIED_PROFILE = {
    "id": SUBJECT,
    "dni_enviat_at": _ago(REVIEW_SECONDS + 60),
    "termes_versio": TERMS_VERSION,
    "termes_acceptats_at": _ago(10),
}


class FakeWithdrawalAdmin:
    """Doble del client d'administració per a la retirada.

    Respon a table(nom).select().eq().execute() per a profile_pins, profiles i
    accounts, i a rpc("process_cash_movement", params).execute(). Si
    ``rpc_result`` és una excepció, es llança en executar la funció.
    """

    def __init__(self, pin_hash, iban, rpc_result, balance=None, balance_error=None):
        self.data = {
            "profile_pins": [{"pin_hash": pin_hash}] if pin_hash else [],
            "profiles": [{**VERIFIED_PROFILE, "iban": iban}],
            "accounts": [{"balance": balance}] if balance is not None else [],
        }
        self.balance_error = balance_error
        self.rpc_result = rpc_result
        self.rpc_call = None
        self.eq_args = {}
        self._pending = None

    def table(self, name):
        self._pending = name
        return self

    def select(self, *columns):
        return self

    def eq(self, column, value):
        self.eq_args[self._pending] = (column, value)
        return self

    def rpc(self, name, params):
        if name == "register_pin_attempt":
            # Comptador d'intents (US1.6): es prova a test_require_pin.py
            self._pending = "pin_attempt"
            self.pin_success = params["p_success"]
            return self
        self.rpc_call = (name, params)
        self._pending = "rpc"
        return self

    def execute(self):
        if self._pending == "pin_attempt":
            remaining = 3 if self.pin_success else 2
            return SimpleNamespace(
                data={"remaining_attempts": remaining, "retry_after_seconds": None}
            )
        if self._pending == "rpc":
            if isinstance(self.rpc_result, Exception):
                raise self.rpc_result
            return SimpleNamespace(data=self.rpc_result)
        if self._pending == "accounts" and self.balance_error is not None:
            raise self.balance_error
        return SimpleNamespace(data=self.data[self._pending])


@pytest.fixture
def auth(make_token):
    """Token de l'usuari i el PIN correcte a la capçalera."""
    return {"Authorization": f"Bearer {make_token(sub=SUBJECT)}", "X-PIN": PIN}


@pytest.fixture
def verified(fake_profile):
    """L'usuari del token està verificat i ha acceptat els termes."""
    fake_profile(rows=[VERIFIED_PROFILE])


@pytest.fixture
def admin():
    """Instal·la el doble; per defecte l'usuari té PIN, IBAN i saldo de sobres."""

    def install(pin_hash=PIN_HASH, iban=IBAN, rpc_result=9900, **kwargs):
        fake = FakeWithdrawalAdmin(pin_hash, iban, rpc_result, **kwargs)
        main.app.dependency_overrides[deps.get_admin_client] = lambda: fake
        return fake

    yield install
    main.app.dependency_overrides.clear()


def _insufficient_balance():
    return PostgrestAPIError(
        {"message": "Insufficient balance: current 50.00, requested 80.00", "code": "P0003"}
    )


# --- Accés ---


def test_withdrawal_requires_token(client):
    assert client.post(ENDPOINT, json={"amount": 100}).status_code == 401


def test_withdrawal_rejects_unverified_user(client, auth, fake_profile, admin):
    fake_profile(rows=[{"id": SUBJECT}])
    fake = admin()

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 403
    assert fake.rpc_call is None


def test_withdrawal_without_pin_configured_returns_403(client, auth, verified, admin):
    fake = admin(pin_hash=None)

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Cal configurar el PIN de seguretat al perfil per fer aquesta operació."
    )
    assert fake.rpc_call is None


@pytest.mark.parametrize("pin", ["9999", None], ids=["wrong-pin", "missing-pin"])
def test_withdrawal_with_wrong_pin_returns_403(client, auth, verified, admin, pin):
    fake = admin()
    headers = {**auth, "X-PIN": pin} if pin else {"Authorization": auth["Authorization"]}

    response = client.post(ENDPOINT, headers=headers, json={"amount": 100})

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "El PIN introduït és incorrecte. Et queden 2 intents."
    )
    assert fake.rpc_call is None


# --- Retirada correcta ---


def test_withdrawal_returns_new_balance(client, auth, verified, admin):
    """Crida la funció atòmica amb l'import en negatiu i l'IBAN emmascarat."""
    fake = admin(rpc_result=9749.5)

    response = client.post(ENDPOINT, headers=auth, json={"amount": "250.50"})

    assert response.status_code == 201
    assert response.json() == {"balance": 9749.5}
    assert fake.rpc_call == (
        "process_cash_movement",
        {
            "p_user_id": SUBJECT,
            "p_type": "retirada",
            "p_amount": "-250.50",
            "p_iban_masked": MASKED_IBAN,
        },
    )
    assert IBAN not in str(fake.rpc_call)


def test_withdrawal_uses_token_subject(client, auth, verified, admin):
    """L'usuari, el PIN i l'IBAN surten del token, mai del cos de la petició."""
    fake = admin()

    response = client.post(
        ENDPOINT,
        headers=auth,
        json={"amount": 100, "user_id": "99999999-9999-9999-9999-999999999999"},
    )

    assert response.status_code == 201
    assert fake.rpc_call[1]["p_user_id"] == SUBJECT
    assert fake.eq_args["profile_pins"] == ("user_id", SUBJECT)
    assert fake.eq_args["profiles"] == ("id", SUBJECT)


@pytest.mark.parametrize(
    ("amount", "sent"),
    [(1, "-1"), ("1.00", "-1.00"), (25000, "-25000")],
    ids=["minimum", "minimum-decimals", "no-maximum"],
)
def test_withdrawal_accepts_valid_amounts(client, auth, verified, admin, amount, sent):
    fake = admin()

    response = client.post(ENDPOINT, headers=auth, json={"amount": amount})

    assert response.status_code == 201
    assert fake.rpc_call[1]["p_amount"] == sent


# --- Errors ---


@pytest.mark.parametrize("amount", ["0.99", 0, -50], ids=["below-minimum", "zero", "negative"])
def test_withdrawal_below_minimum_returns_422(client, auth, verified, admin, amount):
    fake = admin()

    response = client.post(ENDPOINT, headers=auth, json={"amount": amount})

    assert response.status_code == 422
    assert response.json()["detail"] == MIN_WITHDRAWAL_ERROR
    assert fake.rpc_call is None


@pytest.mark.parametrize(
    "body",
    [{"amount": "10.123"}, {"amount": "abc"}, {"amount": "NaN"}, {}],
    ids=["three-decimals", "not-a-number", "nan", "missing"],
)
def test_withdrawal_rejects_invalid_amount(client, auth, verified, admin, body):
    fake = admin()

    response = client.post(ENDPOINT, headers=auth, json=body)

    assert response.status_code == 422
    assert fake.rpc_call is None


@pytest.mark.parametrize("iban", [None, ""], ids=["null", "empty"])
def test_withdrawal_without_iban_returns_422(client, auth, verified, admin, iban):
    """El formulari no hi deixa arribar, però el backend ho comprova igualment."""
    fake = admin(iban=iban)

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 422
    assert response.json()["detail"] == NO_IBAN_ERROR
    assert fake.rpc_call is None


def test_withdrawal_insufficient_balance_says_how_much_is_missing(
    client, auth, verified, admin
):
    """La funció la rebutja i es torna a llegir el saldo per calcular què falta."""
    fake = admin(rpc_result=_insufficient_balance(), balance=50)

    response = client.post(ENDPOINT, headers=auth, json={"amount": "1280.75"})

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Saldo insuficient. Et falten 1.230,75 € per completar l'operació"
    )
    assert fake.eq_args["accounts"] == ("user_id", SUBJECT)


def test_withdrawal_insufficient_balance_never_shows_negative_missing(
    client, auth, verified, admin
):
    """Si entremig ha entrat un ingrés, no es mostra un import negatiu."""
    admin(rpc_result=_insufficient_balance(), balance=500)

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 422
    assert "Et falten 0,01 €" in response.json()["detail"]


def test_withdrawal_insufficient_balance_read_error_returns_500(
    client, auth, verified, admin
):
    admin(
        rpc_result=_insufficient_balance(),
        balance_error=PostgrestAPIError({"message": "boom"}),
    )

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 500
    assert response.json()["detail"] == WITHDRAWAL_ERROR


def test_withdrawal_database_error_returns_500(client, auth, verified, admin):
    """Qualsevol altre error de la funció: cap canvi i el missatge de la US."""
    admin(rpc_result=PostgrestAPIError({"message": "boom", "code": "P0002"}))

    response = client.post(ENDPOINT, headers=auth, json={"amount": 100})

    assert response.status_code == 500
    assert response.json()["detail"] == WITHDRAWAL_ERROR


@pytest.mark.parametrize(
    ("amount", "expected"),
    [("0.01", "0,01"), ("30", "30,00"), ("1230.75", "1.230,75"), ("1234567.8", "1.234.567,80")],
)
def test_format_euros_uses_catalan_separators(amount, expected):
    assert format_euros(Decimal(amount)) == expected
