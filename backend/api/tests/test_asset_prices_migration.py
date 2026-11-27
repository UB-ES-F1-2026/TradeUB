"""Contract tests for the asset prices migration (US5.6, #191).

CI has no Postgres here, so these tests check the migration text, not the real
functions. Comments are stripped first so that words in them cannot make an
assertion pass or fail.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
PRICES_SQL = next(MIGRATIONS_DIR.glob("*_asset_prices.sql"))
CATALOG_SQL = next(MIGRATIONS_DIR.glob("*_assets_catalog.sql"))


def load_sql(path: Path = PRICES_SQL) -> str:
    text = path.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def test_every_catalog_asset_has_volatility_and_drift():
    catalog = set(re.findall(r"\('[^']+', '([a-z0-9]+)', '[a-z0-9]{12}'", load_sql(CATALOG_SQL)))
    params = set(re.findall(r"\('([a-z0-9]+)', 0\.\d{4}, 0\.\d{4}\)", load_sql()))

    assert catalog
    assert catalog == params


def test_volatility_and_drift_have_defaults_and_ranges():
    sql = load_sql()

    assert "add column if not exists volatility numeric(6, 4) not null default 0.0080" in sql
    assert "add column if not exists drift numeric(6, 4) not null default 0.0400" in sql
    assert "check (volatility > 0 and volatility <= 0.05)" in sql
    assert "check (drift >= 0 and drift <= 0.2)" in sql


def test_market_opens_weekdays_from_7_30_to_23_madrid_time():
    sql = load_sql()

    assert "at time zone 'europe/madrid'" in sql
    assert "between 1 and 5" in sql
    assert "::time >= time '07:30'" in sql
    assert "::time < time '23:00'" in sql


def test_market_clock_only_runs_while_open():
    sql = load_sql()

    # 5 sessions a week of 55,800 seconds (7:30-23:00), counted from 7:30 (27,000 s)
    assert "(weeks * 5 + least(weekday, 5)) * 55800" in sql
    assert "- 27000" in sql
    # Closed: the last second of the previous session
    assert "greatest(least(session_second, 55799), -1)" in sql


def test_only_service_role_can_execute():
    sql = load_sql()

    for signature in (
        "public.market_is_open(text, timestamptz)",
        "public.market_seconds(timestamptz)",
    ):
        assert f"revoke all on function {signature} from public, anon, authenticated" in sql
        assert f"grant execute on function {signature} to service_role" in sql
