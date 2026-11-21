"""Contract tests for the positions database migration (US6.1).

CI has no Postgres, so these tests check the migration text, not the real
schema. Comments are stripped first so that words in them cannot make an
assertion pass or fail.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
POSITIONS_SQL = next(MIGRATIONS_DIR.glob("*_positions_create.sql"))


def load_sql() -> str:
    text = POSITIONS_SQL.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def test_positions_table_columns():
    sql = load_sql()

    assert "create table if not exists public.positions" in sql
    assert (
        "user_id uuid not null references auth.users (id) on delete cascade"
        in sql
    )
    assert "asset_id bigint not null references public.assets (id)" in sql
    assert "units numeric(20, 8) not null" in sql
    assert "avg_price numeric(18, 6) not null" in sql
    assert "updated_at timestamptz not null default now()" in sql


def test_positions_one_row_per_user_and_asset():
    sql = load_sql()

    assert "primary key (user_id, asset_id)" in sql


def test_positions_values_must_be_positive():
    sql = load_sql()

    assert "check (units > 0)" in sql
    assert "check (avg_price > 0)" in sql


def test_positions_rls_allows_only_own_reads():
    sql = load_sql()

    assert "alter table public.positions enable row level security" in sql
    assert "on public.positions for select to authenticated" in sql
    assert "using ((select auth.uid()) = user_id)" in sql
    assert re.search(r"for (insert|update|delete|all)\b", sql) is None


def test_positions_client_write_grants_revoked():
    sql = load_sql()

    assert (
        "revoke insert, update, delete on public.positions from anon, authenticated"
        in sql
    )
