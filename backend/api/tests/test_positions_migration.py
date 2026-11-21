"""Contract tests for the positions database migration (US6.1)."""

from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parents[3] / "supabase" / "migrations"
POSITIONS_SQL = next(MIGRATIONS_DIR.glob("*_positions_create.sql"))


def test_positions_migration_schema_and_rls():
    sql = POSITIONS_SQL.read_text(encoding="utf-8").lower()

    assert "create table if not exists public.positions" in sql
    assert "user_id" in sql
    assert "asset_id" in sql
    assert "units" in sql
    assert "avg_price" in sql
    assert "updated_at" in sql
    assert "primary key (user_id, asset_id)" in sql

    assert "enable row level security" in sql
    assert "for select" in sql
    assert "for insert" not in sql
    assert "for update" not in sql
    assert "for delete" not in sql
