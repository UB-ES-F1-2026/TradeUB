"""Tests HTTP de GET /api/v1/account/positions (US6.2).

La validació del token ja es prova a test_users_me.py i la de
require_verified_user a test_identity_verification.py; aquí només es
comprova que l'endpoint està protegit i el seu cos.
"""

import pytest
from fastapi import Depends
from supabase import PostgrestAPIError

import main
from api import deps

ENDPOINT = "/api/v1/account/positions"

SUBJECT = "11111111-2222-3333-4444-555555555555"


@pytest.fixture
def verified():
    """Dona l'usuari per verificat sense saltar-se la validació del token."""
    main.app.dependency_overrides[deps.require_verified_user] = (
        lambda user=Depends(deps.get_current_user): user
    )


def test_missing_header_returns_401(client):
    """Sense sessió no es poden consultar les posicions."""
    response = client.get(ENDPOINT)

    assert response.status_code == 401


def test_unverified_user_returns_403(client, make_token, fake_profile):
    """Sense DNI verificat ni termes acceptats no es consulten les posicions."""
    fake_db = fake_profile(rows=[])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 403
    assert fake_db.table_name == "profiles"


@pytest.mark.usefixtures("verified")
def test_returns_positions_of_token_subject(client, make_token, fake_profile):
    """Retorna l'actiu i les unitats enteres, filtrades pel sub del token."""
    fake_db = fake_profile(
        rows=[
            {"asset_id": 7, "units": 3},
            # PostgREST pot retornar el numeric com a text
            {"asset_id": 12, "units": "10.00000000"},
        ]
    )

    token = make_token(sub=SUBJECT)
    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json() == [
        {"asset_id": 7, "units": 3},
        {"asset_id": 12, "units": 10},
    ]
    assert fake_db.table_name == "positions"
    assert fake_db.eq_args == ("user_id", SUBJECT)


@pytest.mark.usefixtures("verified")
def test_without_positions_returns_empty_list(client, make_token, fake_profile):
    """Sense posicions no és un error: llista buida."""
    fake_profile(rows=[])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.usefixtures("verified")
def test_postgrest_error_returns_500(client, make_token, fake_profile):
    """Si PostgREST rebutja la consulta, és un 500 amb un missatge propi."""
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
    assert response.json()["detail"] == "No s'han pogut recuperar les posicions"
