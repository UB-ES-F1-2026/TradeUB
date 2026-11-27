"""Contract tests for the buy_asset migrations (US6.1, #126; US6.5, #185).

CI has no Postgres, so these tests check the migration text, not the real
function. Comments are stripped first so that words in them cannot make an
assertion pass or fail.

buy_asset is redefined by later migrations, so most tests read the latest
definition (load_current_function), not the migration that created it.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
BUY_ASSET_SQL = next(MIGRATIONS_DIR.glob("*_buy_asset.sql"))
FUNCTION_START = "create or replace function public.buy_asset("


def load_sql(path: Path = BUY_ASSET_SQL) -> str:
    text = path.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def load_current_function() -> str:
    """Latest buy_asset definition, with its grants, up to the next function."""
    for path in sorted(MIGRATIONS_DIR.glob("*.sql"), reverse=True):
        sql = load_sql(path)
        if FUNCTION_START in sql:
            start = sql.index(FUNCTION_START)
            end = sql.find("create or replace function", start + 1)
            return sql[start:] if end == -1 else sql[start:end]
    raise AssertionError("No migration defines buy_asset")


def test_positions_only_whole_units():
    assert "add constraint positions_units_whole check (units = trunc(units))" in load_sql()
    assert "p_units <> trunc(p_units)" in load_current_function()


def test_price_comes_from_the_price_engine():
    sql = load_current_function()

    # US5.6: the simulated price at this instant, never the catalog anchor or the request
    assert "v_price := public.asset_price(p_asset_id)" in sql
    assert "close_price_eur" not in sql
    assert "if v_price is null then raise exception 'asset not found: %'" in sql


def test_commission_is_one_percent_rounded_up_capped_at_one_euro():
    sql = load_current_function()

    assert "v_commission := least(ceil(v_cost) / 100, 1.00)" in sql
    assert "v_total := v_cost + v_commission" in sql


def test_cash_movement_and_position_in_same_function():
    sql = load_current_function()

    assert (
        "public.process_cash_movement( p_user_id, 'compra', -v_total, "
        "p_movement_id => v_movement_id )" in sql
    )
    assert "on conflict (user_id, asset_id) do update" in sql
    assert (
        "avg_price = (p.units * p.avg_price + v_total) / (p.units + excluded.units)"
        in sql
    )
    assert "updated_at = now()" in sql


def test_order_keeps_the_data_of_the_purchase():
    sql = load_current_function()

    assert "v_movement_id uuid := gen_random_uuid()" in sql
    assert "insert into public.orders" in sql
    assert (
        "'compra', 'executada', p_units, v_price, v_cost, v_commission, v_total, "
        "v_previous_avg_price, now(), v_movement_id" in sql
    )


def test_previous_avg_price_is_read_after_locking_the_account():
    sql = load_current_function()

    account_lock = sql.index("public.process_cash_movement(")
    previous_avg = sql.index("select avg_price into v_previous_avg_price")
    upsert = sql.index("insert into public.positions")
    assert account_lock < previous_avg < upsert


def test_returns_order_id_and_price():
    sql = load_current_function()

    assert "'order_id', v_order_id" in sql
    assert "'price', v_price::text" in sql


def test_only_service_role_can_execute():
    sql = load_current_function()

    signature = "public.buy_asset(uuid, bigint, numeric)"
    assert f"revoke all on function {signature} from public, anon, authenticated" in sql
    assert f"grant execute on function {signature} to service_role" in sql
