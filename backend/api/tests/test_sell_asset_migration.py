"""Contract tests for the sell_asset migration (US6.2, #128).

CI has no Postgres, so these tests check the migration text, not the real
function. Comments are stripped first so that words in them cannot make an
assertion pass or fail.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
SELL_ASSET_SQL = next(MIGRATIONS_DIR.glob("*_sell_asset.sql"))


def load_sql() -> str:
    text = SELL_ASSET_SQL.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def test_only_whole_positive_units():
    sql = load_sql()

    assert "p_units <= 0 or p_units <> trunc(p_units)" in sql


def test_price_comes_from_catalog():
    sql = load_sql()

    assert "select close_price_eur into v_price from public.assets" in sql


def test_locks_account_before_position():
    sql = load_sql()

    account_lock = sql.index("from public.accounts where user_id = p_user_id for update")
    position_lock = sql.index(
        "from public.positions where user_id = p_user_id and asset_id = p_asset_id for update"
    )
    assert account_lock < position_lock


def test_cannot_sell_more_units_than_held():
    sql = load_sql()

    assert "if not found or v_held < p_units then" in sql
    assert "errcode = 'p0005'" in sql


def test_commission_is_deducted_from_amount():
    sql = load_sql()

    assert "v_commission := least(ceil(v_amount) / 100, 1.00)" in sql
    assert "v_net := v_amount - v_commission" in sql
    assert "public.process_cash_movement(p_user_id, 'venda', v_net)" in sql


def test_position_is_deleted_when_sold_out():
    sql = load_sql()

    assert "if v_held = p_units then delete from public.positions" in sql
    assert "set units = units - p_units, updated_at = now()" in sql


def test_only_service_role_can_execute():
    sql = load_sql()

    signature = "public.sell_asset(uuid, bigint, numeric)"
    assert f"revoke all on function {signature} from public, anon, authenticated" in sql
    assert f"grant execute on function {signature} to service_role" in sql
