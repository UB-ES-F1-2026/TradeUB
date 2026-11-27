"""Contract tests for the orders migration (US6.5, #185).

CI has no Postgres, so these tests check the migration text, not the real
schema. Comments are stripped first so that words in them cannot make an
assertion pass or fail.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
ORDERS_SQL = next(MIGRATIONS_DIR.glob("*_orders_create.sql"))


def load_sql() -> str:
    text = ORDERS_SQL.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def test_orders_rls_allows_only_own_reads():
    sql = load_sql()

    assert "alter table public.orders enable row level security" in sql
    assert "on public.orders for select to authenticated" in sql
    assert "using ((select auth.uid()) = user_id)" in sql
    # Only the read policy. The migration also has "for update" row locks, so
    # the check looks at policies, not at the whole text
    assert sql.count("create policy") == 1
    assert (
        "revoke insert, update, delete on public.orders from anon, authenticated"
        in sql
    )


def test_cash_movement_accepts_the_movement_id():
    sql = load_sql()

    assert (
        "drop function if exists public.process_cash_movement(uuid, text, numeric, text)"
        in sql
    )
    assert "p_movement_id uuid default null" in sql
    assert "coalesce(p_movement_id, gen_random_uuid())" in sql

    signature = "public.process_cash_movement(uuid, text, numeric, text, uuid)"
    assert f"revoke all on function {signature} from public, anon, authenticated" in sql
    assert f"grant execute on function {signature} to service_role" in sql
