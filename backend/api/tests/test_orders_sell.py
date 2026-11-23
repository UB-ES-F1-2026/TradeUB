"""Tests HTTP de POST /api/v1/orders/sell (US6.2).

El PIN i l'usuari verificat ja es proven a test_require_pin.py: aquí se
substitueix require_pin i es comprova el contracte de l'endpoint. L'import,
la comissió i l'actualització de la posició es fan a la funció sell_asset de
Postgres, que la CI no pot executar (vegeu test_sell_asset_migration.py).
"""

from decimal import Decimal

import pytest
from fastapi import HTTPException
from supabase import PostgrestAPIError

import main
from api import deps
from api.orders import (
    ASSET_NOT_FOUND_ERROR,
    INSUFFICIENT_UNITS_ERROR,
    INVALID_UNITS_ERROR,
    SELL_ERROR,
)

ENDPOINT = "/api/v1/orders/sell"

SUBJECT = "11111111-2222-3333-4444-555555555555"

SELL_RESULT = {
    "balance": "10211.40",
    "units": "1",
    "avg_price": "214.400000",
    "amount": "212.40",
    "commission": "1.00",
    "net": "211.40",
}


@pytest.fixture
def pin_ok():
    """L'usuari del token està verificat i ha enviat el PIN correcte."""
    main.app.dependency_overrides[deps.require_pin] = lambda: {"sub": SUBJECT}
    yield
    main.app.dependency_overrides.clear()


def test_sell_requires_token(client):
    response = client.post(ENDPOINT, json={"asset_id": 1, "units": 1})

    assert response.status_code == 401


def test_sell_endpoint_requires_pin(client, make_token, fake_admin):
    """Si require_pin rebutja la petició, la venda no s'executa.

    require_pin ja inclou require_verified_user; el seu comportament es prova
    a test_require_pin.py.
    """

    def _wrong_pin():
        raise HTTPException(status_code=403, detail="PIN incorrecte")

    main.app.dependency_overrides[deps.require_pin] = _wrong_pin
    admin = fake_admin(rows=SELL_RESULT)

    response = client.post(
        ENDPOINT,
        headers={"Authorization": f"Bearer {make_token(sub=SUBJECT)}"},
        json={"asset_id": 1, "units": 1},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "PIN incorrecte"
    assert admin.rpc_call is None


def test_sell_returns_result(client, pin_ok, fake_admin):
    fake_admin(rows=SELL_RESULT)

    response = client.post(ENDPOINT, json={"asset_id": 1, "units": 1})

    assert response.status_code == 201
    body = response.json()
    assert {k: Decimal(str(v)) for k, v in body.items()} == {
        k: Decimal(v) for k, v in SELL_RESULT.items()
    }


def test_sell_all_units_returns_zero_units(client, pin_ok, fake_admin):
    """Si es ven tota la posició, sell_asset l'esborra i retorna 0 unitats."""
    fake_admin(rows={**SELL_RESULT, "units": "0"})

    response = client.post(ENDPOINT, json={"asset_id": 1, "units": 2})

    assert response.status_code == 201
    assert response.json()["units"] == 0


def test_sell_uses_token_subject(client, pin_ok, fake_admin):
    """L'usuari surt del token, mai del cos de la petició."""
    admin = fake_admin(rows=SELL_RESULT)

    client.post(
        ENDPOINT, json={"asset_id": 7, "units": 3, "user_id": "someone-else"}
    )

    assert admin.rpc_call == (
        "sell_asset",
        {"p_user_id": SUBJECT, "p_asset_id": 7, "p_units": "3"},
    )


@pytest.mark.parametrize("units", [0, -1, 1.5, "abc", None])
def test_sell_rejects_invalid_units(client, pin_ok, fake_admin, units):
    admin = fake_admin(rows=SELL_RESULT)

    response = client.post(ENDPOINT, json={"asset_id": 1, "units": units})

    assert response.status_code == 422
    assert admin.rpc_call is None


@pytest.mark.parametrize("asset_id", [0, -1, None])
def test_sell_rejects_invalid_asset_id(client, pin_ok, fake_admin, asset_id):
    admin = fake_admin(rows=SELL_RESULT)

    response = client.post(ENDPOINT, json={"asset_id": asset_id, "units": 1})

    assert response.status_code == 422
    assert admin.rpc_call is None


@pytest.mark.parametrize(
    ("code", "status", "detail"),
    [
        ("P0005", 422, INSUFFICIENT_UNITS_ERROR),
        ("P0004", 404, ASSET_NOT_FOUND_ERROR),
        ("22023", 422, INVALID_UNITS_ERROR),
        ("P0002", 500, SELL_ERROR),
        (None, 500, SELL_ERROR),
    ],
)
def test_sell_maps_database_errors(client, pin_ok, fake_admin, code, status, detail):
    fake_admin(error=PostgrestAPIError({"code": code, "message": "boom"}))

    response = client.post(ENDPOINT, json={"asset_id": 1, "units": 1})

    assert response.status_code == status
    assert response.json()["detail"] == detail
