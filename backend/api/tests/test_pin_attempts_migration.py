"""Contract tests for the PIN attempts migration (US1.6, #188).

The SQL test chain (supabase/tests/run.sh) skips the migrations that depend
on profiles, so profile_pins and this function are not run against Postgres
in CI. These tests check the migration text instead. Comments are stripped
first so that words in them cannot make an assertion pass or fail.
"""

import re
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
MIGRATION_SQL = next(MIGRATIONS_DIR.glob("*_profile_pins_attempts.sql"))


def load_sql() -> str:
    text = MIGRATION_SQL.read_text(encoding="utf-8").lower()
    text = re.sub(r"--[^\n]*", "", text)
    return re.sub(r"\s+", " ", text)


def test_adds_counter_and_lock_columns():
    sql = load_sql()

    assert "add column if not exists failed_attempts int not null default 0" in sql
    assert "add column if not exists locked_until timestamptz" in sql


def test_counts_with_row_locked():
    sql = load_sql()

    assert "security definer" in sql
    assert "from public.profile_pins where user_id = p_user_id for update" in sql


def test_active_lock_is_checked_before_counting():
    sql = load_sql()

    active_lock = sql.index("if v_locked_until > now() then")
    expired_lock = sql.index("if v_locked_until is not null then v_attempts := 0")
    counting = sql.index("v_attempts := v_attempts + 1")
    assert active_lock < expired_lock < counting


def test_locks_fifteen_minutes_on_third_failure():
    sql = load_sql()

    assert "v_max_attempts constant int := 3" in sql
    assert "if v_attempts >= v_max_attempts then" in sql
    assert "v_locked_until := now() + interval '15 minutes'" in sql


def test_only_service_role_can_execute():
    sql = load_sql()

    signature = "public.register_pin_attempt(uuid, boolean)"
    assert f"revoke all on function {signature} from public, anon, authenticated" in sql
    assert f"grant execute on function {signature} to service_role" in sql


def test_skipped_by_sql_test_chain():
    """run.sh skips migrations that mention profiles; this one must be skipped."""
    assert "profiles" in MIGRATION_SQL.read_text(encoding="utf-8")
