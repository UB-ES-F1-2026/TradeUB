"""Tests for the cash movement API boundary and migration contract."""

from pathlib import Path
from types import SimpleNamespace

from supabase import PostgrestAPIError

import main
from api import deps

SUBJECT = "11111111-2222-3333-4444-555555555555"
MIGRATION = (
    Path(__file__).parents[3]
    / "supabase"
    / "migrations"
    / "20261113190000_cash_movements_create.sql"
)


class FakeCashClient:
    def __init__(self, *, movements=None, rpc_result=None, rpc_error=None):
        self.movements = movements or []
        self.rpc_result = rpc_result
        self.rpc_error = rpc_error
        self.table_name = None
        self.eq_args = None
        self.rpc_name = None
        self.rpc_params = None

    def table(self, name):
        self.table_name = name
        return self

    def select(self, *_columns):
        return self

    def eq(self, column, value):
        self.eq_args = (column, value)
        return self

    def order(self, *_args, **_kwargs):
        return self

    def rpc(self, name, params):
        self.rpc_name = name
        self.rpc_params = params
        return self

    def execute(self):
        if self.rpc_error is not None:
            raise self.rpc_error
        if self.rpc_name is not None:
            return SimpleNamespace(data=self.rpc_result)
        return SimpleNamespace(data=self.movements)


def install_client(client):
    main.app.dependency_overrides[deps.get_user_client] = lambda: client
    main.app.dependency_overrides[deps.get_admin_client] = lambda: client


def test_deposit_updates_balance_and_records_balance_after(client, make_token):
    db = FakeCashClient(rpc_result=10100.0)
    install_client(db)

    response = client.post(
        "/api/v1/account/movements",
        json={"type": "ingres", "amount": "100"},
        headers={"Authorization": f"Bearer {make_token(sub=SUBJECT)}"},
    )

    assert response.status_code == 201
    assert db.rpc_name == "process_cash_movement"
    assert db.rpc_params == {
        "p_user_id": SUBJECT,
        "p_type": "ingres",
        "p_amount": 100,
    }
    assert response.json() == {
        "type": "ingres",
        "amount": 100,
        "balance": 10100.0,
    }


def test_overdraft_returns_error_without_writing(client, make_token):
    db = FakeCashClient(
        rpc_error=PostgrestAPIError(
            {
                "message": "Insufficient balance",
                "code": "P0001",
                "hint": None,
                "details": None,
            }
        )
    )
    install_client(db)

    response = client.post(
        "/api/v1/account/movements",
        json={"type": "retirada", "amount": "10001"},
        headers={"Authorization": f"Bearer {make_token(sub=SUBJECT)}"},
    )

    assert response.status_code == 400
    assert db.rpc_params["p_amount"] == -10001
    assert db.movements == []


def test_movement_history_is_filtered_to_token_subject(client, make_token):
    db = FakeCashClient(movements=[{"user_id": SUBJECT, "amount": 100}])
    install_client(db)

    response = client.get(
        "/api/v1/account/movements",
        params={"user_id": "99999999-8888-7777-6666-555555555555"},
        headers={"Authorization": f"Bearer {make_token(sub=SUBJECT)}"},
    )

    assert response.status_code == 200
    assert db.table_name == "cash_movements"
    assert db.eq_args == ("user_id", SUBJECT)


def test_migration_has_rls_and_no_write_policies():
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "enable row level security" in sql.lower()
    assert "for select" in sql.lower()
    assert "create policy" in sql.lower()
    assert "create policy" in sql.lower() and "for insert" not in sql.lower()
    assert "create policy" in sql.lower() and "for delete" not in sql.lower()
    assert "for update" in sql.lower()
    assert "revoke all on function" in sql.lower()
    assert "authenticated" in sql.lower()