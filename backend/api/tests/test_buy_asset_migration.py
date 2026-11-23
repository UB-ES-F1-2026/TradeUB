"""Contract tests for the buy_asset migration (US6.1, #126).

CI has no Postgres, so these tests check the migration text, not the real
function. Comments are stripped first so that words in them cannot make an
assertion pass or fail.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
BUY_ASSET_SQL = next(MIGRATIONS_DIR.glob("*_buy_asset.sql"))


def load_sql() -> str:
    text = BUY_ASSET_SQL.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def test_positions_only_whole_units():
    sql = load_sql()

    assert "add constraint positions_units_whole check (units = trunc(units))" in sql
    assert "p_units <> trunc(p_units)" in sql


def test_price_comes_from_catalog():
    sql = load_sql()

    assert "select close_price_eur into v_price from public.assets" in sql


def test_commission_is_one_percent_rounded_up_capped_at_one_euro():
    sql = load_sql()

    assert "v_commission := least(ceil(v_cost) / 100, 1.00)" in sql
    assert "v_total := v_cost + v_commission" in sql


def test_cash_movement_and_position_in_same_function():
    sql = load_sql()

    assert "public.process_cash_movement(p_user_id, 'compra', -v_total)" in sql
    assert "on conflict (user_id, asset_id) do update" in sql
    assert (
        "avg_price = (p.units * p.avg_price + v_total) / (p.units + excluded.units)"
        in sql
    )
    assert "updated_at = now()" in sql


def test_only_service_role_can_execute():
    sql = load_sql()

    signature = "public.buy_asset(uuid, bigint, numeric)"
    assert f"revoke all on function {signature} from public, anon, authenticated" in sql
    assert f"grant execute on function {signature} to service_role" in sql
