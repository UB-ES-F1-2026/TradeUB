"""Tests HTTP de GET /api/v1/account/balance.

La validacio del token ja es prova a test_users_me.py; aqui nomes es
comprova que l'endpoint esta protegit i el seu cos.
"""

from supabase import PostgrestAPIError

ENDPOINT = "/api/v1/account/balance"

SUBJECT = "11111111-2222-3333-4444-555555555555"


def test_missing_header_returns_401(client):
    """Sense sessio no es pot consultar el saldo."""
    response = client.get(ENDPOINT)

    assert response.status_code == 401


def test_returns_balance_of_token_subject(client, make_token, fake_profile):
    """Retorna el saldo i el filtra pel sub del token."""
    account = {
        "balance": 10000.0,
        "currency": "EUR",
        "updated_at": "2026-11-01T10:00:00+00:00",
    }
    fake_db = fake_profile(rows=[account])

    token = make_token(sub=SUBJECT)
    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == account
    assert fake_db.table_name == "accounts"
    assert fake_db.eq_args == ("user_id", SUBJECT)


def test_no_account_returns_404(client, make_token, fake_profile):
    """Sense fila a accounts es retorna 404."""
    fake_profile(rows=[])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Compte no trobat"


def test_postgrest_error_returns_500(client, make_token, fake_profile):
    """Si PostgREST rebutja la consulta, es un 500 amb un missatge propi."""
    fake_profile(
        error=PostgrestAPIError(
            {
                "message": "permission denied",
                "code": "42501",
                "hint": None,
                "details": None,
            }
        )
    )

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut recuperar el saldo"
