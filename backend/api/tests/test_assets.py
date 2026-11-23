"""Tests HTTP de GET /api/v1/assets."""

from types import SimpleNamespace

from supabase import PostgrestAPIError

import main
from api import deps

ENDPOINT = "/api/v1/assets"


class FakeAssetsQuery:
    def __init__(self, rows, error=None):
        self.rows = rows
        self.error = error
        self.table_name = None
        self.selected_columns = None
        self.or_filter = None
        self.order_column = None

    def table(self, name):
        self.table_name = name
        return self

    def select(self, columns):
        self.selected_columns = columns
        return self

    def or_(self, expression):
        self.or_filter = expression
        return self

    def order(self, column):
        self.order_column = column
        return self

    def execute(self):
        if self.error is not None:
            raise self.error
        return SimpleNamespace(data=self.rows)


def _install_fake_assets(main, deps, rows=None, error=None):
    fake_db = FakeAssetsQuery(rows or [], error)
    main.app.dependency_overrides[deps.get_user_client] = lambda: fake_db
    return fake_db


def test_missing_header_returns_401(client):
    response = client.get(ENDPOINT)

    assert response.status_code == 401


def test_without_query_returns_all_assets_ordered_by_name(client, make_token):
    rows = [{"name": "Apple"}, {"name": "Zalando"}]
    fake_db = _install_fake_assets(main, deps, rows)

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    assert response.json() == rows
    assert fake_db.table_name == "assets"
    assert fake_db.selected_columns == (
        "id, name, ticker, type, close_price_eur, daily_change_pct, price_date"
    )
    assert fake_db.or_filter is None
    assert fake_db.order_column == "name"


def test_short_query_returns_all_assets(client, make_token):
    fake_db = _install_fake_assets(main, deps, [{"name": "Visa"}])

    response = client.get(
        ENDPOINT, params={"q": " V "}, headers={"Authorization": f"Bearer {make_token()}"}
    )

    assert response.status_code == 200
    assert fake_db.or_filter is None


def test_query_filters_name_ticker_and_isin_and_sanitizes_input(client, make_token):
    fake_db = _install_fake_assets(main, deps, [{"name": "Apple"}])

    response = client.get(
        ENDPOINT,
        params={"q": "  aapl,()  "},
        headers={"Authorization": f"Bearer {make_token()}"},
    )

    assert response.status_code == 200
    assert fake_db.or_filter == (
        "name.ilike.%aapl%,ticker.ilike.%aapl%,isin.ilike.aapl"
    )


def test_postgrest_error_returns_500(client, make_token):
    _install_fake_assets(
        main,
        deps,
        error=PostgrestAPIError(
            {
                "message": "permission denied",
                "code": "42501",
                "hint": None,
                "details": None,
            }
        ),
    )

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut recuperar el catàleg d'actius"
