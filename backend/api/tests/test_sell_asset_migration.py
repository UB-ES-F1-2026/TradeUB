"""Contract tests for the sell_asset migrations (US6.2, #128; US6.5, #185).

CI has no Postgres, so these tests check the migration text, not the real
function. Comments are stripped first so that words in them cannot make an
assertion pass or fail.

sell_asset is redefined by later migrations, so the tests read the latest
definition (load_current_function), not the migration that created it.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
FUNCTION_START = "create or replace function public.sell_asset("


def load_sql(path: Path) -> str:
    text = path.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def load_current_function() -> str:
    """Latest sell_asset definition, with its grants, up to the next function."""
    for path in sorted(MIGRATIONS_DIR.glob("*.sql"), reverse=True):
        sql = load_sql(path)
        if FUNCTION_START in sql:
            start = sql.index(FUNCTION_START)
            end = sql.find("create or replace function", start + 1)
            return sql[start:] if end == -1 else sql[start:end]
    raise AssertionError("No migration defines sell_asset")


def test_only_whole_positive_units():
    sql = load_current_function()

    assert "p_units <= 0 or p_units <> trunc(p_units)" in sql


def test_price_comes_from_the_price_engine():
    sql = load_current_function()

    # US5.6: the simulated price at this instant, never the catalog anchor or the request
    assert "v_price := public.asset_price(p_asset_id)" in sql
    assert "close_price_eur" not in sql
    assert "if v_price is null then raise exception 'asset not found: %'" in sql


def test_locks_account_before_position():
    sql = load_current_function()

    account_lock = sql.index("from public.accounts where user_id = p_user_id for update")
    position_lock = sql.index(
        "from public.positions where user_id = p_user_id and asset_id = p_asset_id for update"
    )
    assert account_lock < position_lock


def test_cannot_sell_more_units_than_held():
    sql = load_current_function()

    assert "if not found or v_held < p_units then" in sql
    assert "errcode = 'p0005'" in sql


def test_commission_is_deducted_from_amount():
    sql = load_current_function()

    assert "v_commission := least(ceil(v_amount) / 100, 1.00)" in sql
    assert "v_net := v_amount - v_commission" in sql
    assert (
        "public.process_cash_movement( p_user_id, 'venda', v_net, "
        "p_movement_id => v_movement_id )" in sql
    )


def test_position_is_deleted_when_sold_out():
    sql = load_current_function()

    assert "if v_held = p_units then delete from public.positions" in sql
    assert "set units = units - p_units, updated_at = now()" in sql


def test_order_keeps_the_data_of_the_sale():
    sql = load_current_function()

    assert "v_movement_id uuid := gen_random_uuid()" in sql
    assert "insert into public.orders" in sql
    assert (
        "'venda', 'executada', p_units, v_price, v_amount, v_commission, v_net, "
        "v_avg_price, now(), v_movement_id" in sql
    )


def test_returns_order_id_and_price():
    sql = load_current_function()

    assert "'order_id', v_order_id" in sql
    assert "'price', v_price::text" in sql


def test_only_service_role_can_execute():
    sql = load_current_function()

    signature = "public.sell_asset(uuid, bigint, numeric)"
    assert f"revoke all on function {signature} from public, anon, authenticated" in sql
    assert f"grant execute on function {signature} to service_role" in sql
