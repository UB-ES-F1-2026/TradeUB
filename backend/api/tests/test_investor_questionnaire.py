"""Tests HTTP de POST /api/v1/profile/investor-questionnaire.

La validació del token ja es prova a test_users_me.py i el càlcul del perfil a
test_investor_profile.py; aquí es comprova el contracte de l'endpoint, que és
el que espera el frontend (#82).
"""

import pytest
from supabase import PostgrestAPIError

from api.profile import INVESTOR_ANSWERS_COLUMN, InvestorQuestionnaire
from core.investor_profile import INVESTOR_QUESTIONS
from core.onboarding import INVESTOR_PROFILE_COLUMN

ENDPOINT = "/api/v1/profile/investor-questionnaire"

SUBJECT = "11111111-2222-3333-4444-555555555555"

# 1 + 1 + 1 + 1 + 0 = 4 punts → intermedi
VALID_BODY = {
    "experiencia": "poca",
    "coneixement": "mitja",
    "seguiment": "setmanal",
    "caiguda": "esperar",
    "horitzo": "curt",
}


@pytest.fixture
def auth_headers(make_token):
    """Capçalera amb un token vàlid de l'usuari SUBJECT."""
    return {"Authorization": f"Bearer {make_token(sub=SUBJECT)}"}


def test_missing_header_returns_401(client):
    """Sense sessió no es pot respondre el qüestionari."""
    response = client.post(ENDPOINT, json=VALID_BODY)

    assert response.status_code == 401


def test_saves_answers_and_profile_of_token_subject(client, auth_headers, fake_admin):
    """Desa les respostes i el perfil calculat a la fila de l'usuari del token."""
    admin = fake_admin()

    response = client.post(ENDPOINT, json=VALID_BODY, headers=auth_headers)

    assert response.status_code == 200
    assert admin.table_name == "profiles"
    assert admin.eq_args == ("id", SUBJECT)
    assert admin.update_data == {
        INVESTOR_ANSWERS_COLUMN: VALID_BODY,
        INVESTOR_PROFILE_COLUMN: "intermedi",
    }


@pytest.mark.parametrize(
    ("position", "profile"),
    [(0, "principiant"), (1, "intermedi"), (2, "avancat")],
)
def test_returns_calculated_profile(client, auth_headers, fake_admin, position, profile):
    """La resposta és {"profile": ...}, el contracte que espera el frontend."""
    fake_admin()
    body = {question_id: options[position] for question_id, options in INVESTOR_QUESTIONS.items()}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"profile": profile}


def test_client_cannot_choose_the_profile(client, auth_headers, fake_admin):
    """Un perfil o un id al cos no canvien ni el perfil desat ni la fila."""
    admin = fake_admin()
    body = {**VALID_BODY, "profile": "avancat", "perfil_inversor": "avancat", "id": "un-altre"}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 200
    assert response.json() == {"profile": "intermedi"}
    assert admin.update_data == {
        INVESTOR_ANSWERS_COLUMN: VALID_BODY,
        INVESTOR_PROFILE_COLUMN: "intermedi",
    }
    assert admin.eq_args == ("id", SUBJECT)


@pytest.mark.parametrize("question_id", INVESTOR_QUESTIONS)
def test_missing_answer_returns_422(client, auth_headers, fake_admin, question_id):
    """Si falta qualsevol resposta, es retorna 422 i no es desa res."""
    admin = fake_admin()
    body = {key: value for key, value in VALID_BODY.items() if key != question_id}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 422
    assert admin.table_name is None


@pytest.mark.parametrize(
    "value",
    ["inventada", "alt", "", None, 2],
    ids=["unknown", "option-of-another-question", "empty", "null", "index"],
)
def test_invalid_answer_returns_422(client, auth_headers, fake_admin, value):
    """Només s'accepten els ids d'opció de la pregunta, no índexs ni altres textos."""
    admin = fake_admin()
    body = {**VALID_BODY, "experiencia": value}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 422
    assert admin.table_name is None


def test_no_profile_row_returns_404(client, auth_headers, fake_admin):
    """Si l'usuari no té fila a profiles no es pot respondre com si s'hagués desat."""
    fake_admin(rows=[])

    response = client.post(ENDPOINT, json=VALID_BODY, headers=auth_headers)

    assert response.status_code == 404


def test_database_error_returns_500(client, auth_headers, fake_admin):
    """Un error de PostgREST es tradueix a un 500 amb missatge propi."""
    fake_admin(
        error=PostgrestAPIError(
            {
                "message": "permission denied",
                "code": "42501",
                "hint": None,
                "details": None,
            }
        )
    )

    response = client.post(ENDPOINT, json=VALID_BODY, headers=auth_headers)

    assert response.status_code == 500
    assert response.json() == {"detail": "No s'ha pogut desar el qüestionari"}


def test_model_matches_questions():
    """El model té una resposta per pregunta i admet exactament les seves opcions."""
    schema = InvestorQuestionnaire.model_json_schema()

    assert set(schema["required"]) == set(INVESTOR_QUESTIONS)
    for question_id, options in INVESTOR_QUESTIONS.items():
        assert schema["properties"][question_id]["enum"] == list(options)
