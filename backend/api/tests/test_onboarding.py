"""Tests de l'estat de l'onboarding (core/onboarding.py i GET /api/v1/users/me)."""

import pytest

from core.onboarding import (
    ONBOARDING_STEPS,
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
def test_all_steps_pending_without_rules(profile):
    """Mentre cap pas tingui regla, tots surten pendents."""
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
