"""Tests de l'estat de l'onboarding (core/onboarding.py i GET /api/v1/users/me)."""

import pytest

from core.investor_profile import INVESTOR_PROFILES
from core.onboarding import (
    INVESTOR_PROFILE_COLUMN,
    ONBOARDING_STEPS,
    PERSONAL_DATA_COLUMNS,
    STATUS_COMPLETED,
    STATUS_PENDING,
    get_onboarding_status,
)

ENDPOINT = "/api/v1/users/me"

# Han de coincidir amb ONBOARDING_STEPS de frontend/src/stores/onboarding.js
EXPECTED_STEP_IDS = ["dades-personals", "questionari-inversor", "verificacio-identitat"]


def test_steps_follow_frontend_order():
    """Els passos surten en el mateix ordre i amb els mateixos ids que al frontend."""
    steps = get_onboarding_status({})["steps"]

    assert [step["id"] for step in steps] == EXPECTED_STEP_IDS


@pytest.mark.parametrize(
    "profile",
    [{}, {"id": "user-123", "username": "ivan"}],
    ids=["no-row", "row-without-step-data"],
)
def test_all_steps_pending_without_step_data(profile):
    """Sense dades de cap pas, tots surten pendents."""
    steps = get_onboarding_status(profile)["steps"]

    assert all(step["status"] == STATUS_PENDING for step in steps)


def test_step_marked_completed_when_rule_passes(monkeypatch):
    """Quan la regla d'un pas es compleix, el pas surt completat i la resta no."""
    rules = list(ONBOARDING_STEPS)
    rules[0] = (rules[0][0], lambda profile: True)
    monkeypatch.setattr("core.onboarding.ONBOARDING_STEPS", tuple(rules))

    steps = get_onboarding_status({})["steps"]

    assert [step["status"] for step in steps] == [
        STATUS_COMPLETED,
        STATUS_PENDING,
        STATUS_PENDING,
    ]


def test_users_me_returns_onboarding_status(client, make_token, fake_profile):
    """GET /users/me inclou l'estat de cada pas de l'onboarding."""
    fake_profile(rows=[{"id": "user-123"}])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    assert response.json()["onboarding"] == {
        "steps": [{"id": step_id, "status": STATUS_PENDING} for step_id in EXPECTED_STEP_IDS]
    }


def test_users_me_returns_onboarding_status_without_row(client, make_token, fake_profile):
    """Sense fila a profiles, els passos també surten pendents."""
    fake_profile(rows=[])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    steps = response.json()["onboarding"]["steps"]
    assert [step["status"] for step in steps] == [STATUS_PENDING] * 3


# Fila amb totes les dades personals, tal com la retorna PostgREST (la data és text)
COMPLETE_PERSONAL_DATA = {
    "id": "user-123",
    "nom": "Anna",
    "cognoms": "Puig Soler",
    "data_naixement": "1990-05-17",
    "telefon": "+34 600 000 000",
    "nif": "12345678Z",
    "carrer": "Carrer de Balmes, 1",
    "codi_postal": "08001",
    "poblacio": "Barcelona",
    "residencia_fiscal": "ES",
}


def _personal_data_status(profile):
    """Estat del pas de dades personals per a un perfil."""
    return get_onboarding_status(profile)["steps"][0]["status"]


def test_personal_data_completed_when_all_columns_have_value():
    """Amb totes les columnes plenes, el pas de dades personals surt completat."""
    assert _personal_data_status(COMPLETE_PERSONAL_DATA) == STATUS_COMPLETED


@pytest.mark.parametrize("column", PERSONAL_DATA_COLUMNS)
@pytest.mark.parametrize(
    "empty_value", [None, "", "   "], ids=["null", "empty", "spaces"]
)
def test_personal_data_pending_when_a_column_is_empty(column, empty_value):
    """N'hi ha prou que una columna no tingui valor perquè el pas quedi pendent."""
    profile = {**COMPLETE_PERSONAL_DATA, column: empty_value}

    assert _personal_data_status(profile) == STATUS_PENDING


def test_personal_data_completed_does_not_complete_other_steps():
    """Completar les dades personals no marca cap altre pas."""
    steps = get_onboarding_status(COMPLETE_PERSONAL_DATA)["steps"]

    assert [step["status"] for step in steps] == [
        STATUS_COMPLETED,
        STATUS_PENDING,
        STATUS_PENDING,
    ]


def test_users_me_returns_personal_data_completed(client, make_token, fake_profile):
    """GET /users/me reflecteix el pas completat quan el perfil té les dades."""
    fake_profile(rows=[COMPLETE_PERSONAL_DATA])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    assert response.json()["onboarding"]["steps"][0] == {
        "id": "dades-personals",
        "status": STATUS_COMPLETED,
    }


def _questionnaire_status(profile):
    """Estat del pas del qüestionari d'inversor per a un perfil."""
    return get_onboarding_status(profile)["steps"][1]["status"]


@pytest.mark.parametrize("investor_profile", INVESTOR_PROFILES)
def test_questionnaire_completed_with_saved_profile(investor_profile):
    """Amb un perfil d'inversor desat, el pas del qüestionari surt completat."""
    profile = {"id": "user-123", INVESTOR_PROFILE_COLUMN: investor_profile}

    assert _questionnaire_status(profile) == STATUS_COMPLETED


@pytest.mark.parametrize(
    "value", [None, "", "expert", "Principiant"], ids=["null", "empty", "unknown", "case"]
)
def test_questionnaire_pending_without_valid_profile(value):
    """Un perfil buit o que el càlcul no pot assignar deixa el pas pendent."""
    profile = {"id": "user-123", INVESTOR_PROFILE_COLUMN: value}

    assert _questionnaire_status(profile) == STATUS_PENDING


def test_questionnaire_completed_does_not_complete_other_steps():
    """Completar el qüestionari no marca cap altre pas."""
    steps = get_onboarding_status({INVESTOR_PROFILE_COLUMN: "intermedi"})["steps"]

    assert [step["status"] for step in steps] == [
        STATUS_PENDING,
        STATUS_COMPLETED,
        STATUS_PENDING,
    ]


def test_users_me_returns_questionnaire_completed(client, make_token, fake_profile):
    """GET /users/me reflecteix els passos completats quan el perfil té les dades."""
    fake_profile(rows=[{**COMPLETE_PERSONAL_DATA, INVESTOR_PROFILE_COLUMN: "avancat"}])

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {make_token()}"})

    assert response.status_code == 200
    assert response.json()["onboarding"]["steps"] == [
        {"id": "dades-personals", "status": STATUS_COMPLETED},
        {"id": "questionari-inversor", "status": STATUS_COMPLETED},
        {"id": "verificacio-identitat", "status": STATUS_PENDING},
    ]
