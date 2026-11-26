"""Tests HTTP de GET /api/v1/orders/{order_id} (US6.5).

La validació del token ja es prova a test_users_me.py i la de
require_verified_user a test_identity_verification.py; aquí es comprova que
l'endpoint està protegit, la consulta que arriba a PostgREST i el cos. La RLS
d'orders es prova a test_orders_migration.py.
"""

from types import SimpleNamespace

import pytest
from fastapi import Depends
from supabase import PostgrestAPIError

import main
from api import deps
from api.orders import ORDER_DETAIL_COLUMNS, ORDER_ERROR, ORDER_NOT_FOUND_ERROR

SUBJECT = "11111111-2222-3333-4444-555555555555"
ORDER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
ENDPOINT = f"/api/v1/orders/{ORDER_ID}"

ORDER_ROW = {
    "id": ORDER_ID,
    "side": "compra",
    "status": "executada",
    "units": 3,
    "price": 212.4,
    "amount": 637.2,
    "commission": 1,
    "total": 638.2,
    "created_at": "2026-11-25T10:00:00+00:00",
    "executed_at": "2026-11-25T10:00:00+00:00",
    "assets": {"id": 7, "name": "Apple", "ticker": "AAPL"},
    "cash_movements": {"balance_after": 9361.8},
}


class FakeOrdersClient:
    """Doble de table().select().eq().eq().execute() amb el client de l'usuari.

    Guarda cada crida per comprovar-la; no filtra les files.
    """

    def __init__(self, rows, error):
        self.rows = rows
        self.error = error
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return self

    def __getattr__(self, method):
        def record(*args):
            self.calls.append((method, *args))
            return self

        return record

    def execute(self):
        if self.error is not None:
            raise self.error
        return SimpleNamespace(data=self.rows)


@pytest.fixture
def fake_orders():
    """Usuari verificat i la taula orders substituïda per un doble."""

    def install(rows=None, error=None):
        fake = FakeOrdersClient(rows or [], error)
        main.app.dependency_overrides[deps.require_verified_user] = (
            lambda user=Depends(deps.get_current_user): user
        )
        main.app.dependency_overrides[deps.get_user_client] = lambda: fake
        return fake

    yield install
    main.app.dependency_overrides.clear()


def get(client, make_token, endpoint=ENDPOINT):
    token = make_token(sub=SUBJECT)
    return client.get(endpoint, headers={"Authorization": f"Bearer {token}"})


def test_missing_header_returns_401(client):
    response = client.get(ENDPOINT)

    assert response.status_code == 401


def test_unverified_user_returns_403(client, make_token, fake_profile):
    """Sense DNI verificat ni termes acceptats no es consulta el detall."""
    fake_profile(rows=[])

    response = get(client, make_token)

    assert response.status_code == 403


def test_returns_saved_order_detail(client, make_token, fake_orders):
    """Tot surt de la fila desada, amb l'actiu i el saldo del moviment."""
    fake_orders(rows=[ORDER_ROW])

    response = get(client, make_token)

    assert response.status_code == 200
    assert response.json() == {
        "id": ORDER_ID,
        "side": "compra",
        "status": "executada",
        "asset": {"id": 7, "name": "Apple", "ticker": "AAPL"},
        "units": 3,
        "price": 212.4,
        "amount": 637.2,
        "commission": 1,
        "total": 638.2,
        "created_at": "2026-11-25T10:00:00+00:00",
        "executed_at": "2026-11-25T10:00:00+00:00",
        "balance_after": 9361.8,
    }


def test_query_filters_by_order_and_token_subject(client, make_token, fake_orders):
    """Una sola consulta amb embeds, filtrada per l'id i pel sub del token."""
    fake = fake_orders(rows=[ORDER_ROW])

    get(client, make_token)

    assert fake.calls == [
        ("table", "orders"),
        ("select", ORDER_DETAIL_COLUMNS),
        ("eq", "id", ORDER_ID),
        ("eq", "user_id", SUBJECT),
    ]
    assert "assets(id, name, ticker)" in ORDER_DETAIL_COLUMNS
    assert "cash_movements(balance_after)" in ORDER_DETAIL_COLUMNS


def test_missing_or_foreign_order_returns_404(client, make_token, fake_orders):
    """La RLS i el filtre per user_id fan que l'ordre d'un altre no arribi."""
    fake_orders(rows=[])

    response = get(client, make_token)

    assert response.status_code == 404
    assert response.json()["detail"] == ORDER_NOT_FOUND_ERROR


def test_invalid_uuid_returns_422(client, make_token, fake_orders):
    fake = fake_orders(rows=[ORDER_ROW])

    response = get(client, make_token, endpoint="/api/v1/orders/no-es-un-uuid")

    assert response.status_code == 422
    assert fake.calls == []


def test_postgrest_error_returns_500(client, make_token, fake_orders):
    fake_orders(
        error=PostgrestAPIError(
            {"message": "boom", "code": "42501", "hint": None, "details": None}
        )
    )

    response = get(client, make_token)

    assert response.status_code == 500
    assert response.json()["detail"] == ORDER_ERROR
