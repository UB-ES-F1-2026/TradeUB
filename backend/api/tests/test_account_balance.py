"""Tests HTTP de GET /api/v1/account/balance.

La validacio del token ja es prova a test_users_me.py i la de
require_verified_user a test_identity_verification.py; aqui nomes es
comprova que l'endpoint esta protegit i el seu cos.
"""

import pytest
from fastapi import Depends
from supabase import PostgrestAPIError

import main
from api import deps

ENDPOINT = "/api/v1/account/balance"

SUBJECT = "11111111-2222-3333-4444-555555555555"


@pytest.fixture
def verified():
    """Dona l'usuari per verificat sense saltar-se la validacio del token."""
    main.app.dependency_overrides[deps.require_verified_user] = (
        lambda user=Depends(deps.get_current_user): user
    )


def test_missing_header_returns_401(client):
    """Sense sessio no es pot consultar el saldo."""
    response = client.get(ENDPOINT)

    assert response.status_code == 401


def test_unverified_user_returns_403(client, make_token, fake_profile):
    """Sense DNI verificat ni termes acceptats no es consulta el saldo."""
    fake_db = fake_profile(rows=[])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Cal verificar la identitat i acceptar els termes per operar"
    )
    assert fake_db.table_name == "profiles"


@pytest.mark.usefixtures("verified")
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


@pytest.mark.usefixtures("verified")
def test_no_account_returns_404(client, make_token, fake_profile):
    """Sense fila a accounts es retorna 404."""
    fake_profile(rows=[])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Compte no trobat"


@pytest.mark.usefixtures("verified")
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
