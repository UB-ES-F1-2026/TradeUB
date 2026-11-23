"""Tests HTTP de POST /api/v1/profile/personal-data.

La validació del token ja es prova a test_users_me.py i la de l'algorisme del
NIF/NIE a test_nif_nie.py; aquí es comprova el contracte de l'endpoint.
"""

import pytest
from supabase import PostgrestAPIError

from api.profile import PersonalData
from core.nif_nie import NIF_NIE_ERROR
from core.onboarding import PERSONAL_DATA_COLUMNS

ENDPOINT = "/api/v1/profile/personal-data"

SUBJECT = "11111111-2222-3333-4444-555555555555"

VALID_BODY = {
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

COMPLETE_PROFILE = {"id": SUBJECT, **VALID_BODY}
VERIFIED_PROFILE = {**COMPLETE_PROFILE, "dni_enviat_at": "2026-11-20T10:00:00+00:00"}


@pytest.fixture
def auth_headers(make_token):
    """Capçalera amb un token vàlid de l'usuari SUBJECT."""
    return {"Authorization": f"Bearer {make_token(sub=SUBJECT)}"}


def test_missing_header_returns_401(client):
    """Sense sessió no es poden desar dades."""
    response = client.post(ENDPOINT, json=VALID_BODY)

    assert response.status_code == 401


def test_saves_personal_data_of_token_subject(client, auth_headers, fake_admin):
    """Desa les dades a la fila de l'usuari del token i retorna la fila desada."""
    admin = fake_admin()

    response = client.post(ENDPOINT, json=VALID_BODY, headers=auth_headers)

    assert response.status_code == 200
    assert admin.table_name == "profiles"
    assert admin.eq_args == ("id", SUBJECT)
    assert admin.update_data == VALID_BODY
    assert response.json() == {"perfil": {"id": SUBJECT, **VALID_BODY}}


def test_saves_normalized_values(client, auth_headers, fake_admin):
    """El NIF es desa en majúscules i els textos sense espais als extrems."""
    admin = fake_admin()
    body = {**VALID_BODY, "nif": "  x0000000t ", "nom": "  Anna  "}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 200
    assert admin.update_data["nif"] == "X0000000T"
    assert admin.update_data["nom"] == "Anna"


def test_invalid_nif_returns_422_with_message(client, auth_headers, fake_admin):
    """Un NIF/NIE incorrecte retorna el missatge del formulari i no es desa res."""
    admin = fake_admin()
    body = {**VALID_BODY, "nif": "12345678A"}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 422
    assert response.json() == {"detail": NIF_NIE_ERROR}
    assert admin.table_name is None


@pytest.mark.parametrize("column", PERSONAL_DATA_COLUMNS)
def test_missing_field_returns_422(client, auth_headers, fake_admin, column):
    """Si falta qualsevol camp, es retorna 422 i no es desa res."""
    admin = fake_admin()
    body = {key: value for key, value in VALID_BODY.items() if key != column}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 422
    assert admin.table_name is None


@pytest.mark.parametrize("value", ["", "   "], ids=["empty", "spaces"])
@pytest.mark.parametrize("column", PERSONAL_DATA_COLUMNS)
def test_empty_field_returns_422(client, auth_headers, fake_admin, column, value):
    """Un camp buit o només d'espais compta com a absent."""
    admin = fake_admin()
    body = {**VALID_BODY, column: value}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 422
    assert admin.table_name is None


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("data_naixement", "1990-02-30"),
        ("data_naixement", "17/05/1990"),
        ("residencia_fiscal", "es"),
        ("residencia_fiscal", "ESP"),
    ],
    ids=["impossible-date", "date-format", "country-lowercase", "country-3-letters"],
)
def test_wrong_format_returns_422(client, auth_headers, fake_admin, column, value):
    """La data ha de ser AAAA-MM-DD real i el país un codi ISO de dues lletres."""
    admin = fake_admin()
    body = {**VALID_BODY, column: value}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 422
    assert admin.table_name is None


def test_ignores_fields_outside_the_model(client, auth_headers, fake_admin):
    """Un id al cos no pot canviar la fila que s'actualitza."""
    admin = fake_admin()
    body = {**VALID_BODY, "id": "un-altre-usuari", "nom_complet": "Algú"}

    response = client.post(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 200
    assert admin.update_data == VALID_BODY
    assert admin.eq_args == ("id", SUBJECT)


def test_no_profile_row_returns_404(client, auth_headers, fake_admin):
    """Si l'usuari no té fila a profiles no es pot respondre com si s'hagués desat."""
    fake_admin(rows=[])

    response = client.post(ENDPOINT, json=VALID_BODY, headers=auth_headers)

    assert response.status_code == 404


def test_patch_updates_editable_personal_data(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[COMPLETE_PROFILE])
    body = {
        "nom": "  Marta  ",
        "cognoms": "Puig Soler",
        "telefon": "+34 611 111 111",
        "carrer": "Carrer Nou, 2",
        "codi_postal": "08002",
        "poblacio": "Barcelona",
    }

    response = client.patch(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 200
    assert admin.update_data == {**body, "nom": "Marta"}
    assert response.json() == {"perfil": {**COMPLETE_PROFILE, **body, "nom": "Marta"}}


def test_patch_rejects_explicit_null(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[COMPLETE_PROFILE])

    response = client.patch(
        ENDPOINT, json={"nom": None}, headers=auth_headers
    )

    assert response.status_code == 422
    assert admin.update_data is None


@pytest.mark.parametrize("field", [
    "nom",
    "cognoms",
    "telefon",
    "carrer",
    "codi_postal",
    "poblacio",
])
@pytest.mark.parametrize("value", ["", "   "], ids=["empty", "spaces"])
def test_patch_rejects_empty_editable_fields(
    client, auth_headers, fake_admin, field, value
):
    admin = fake_admin(rows=[COMPLETE_PROFILE])

    response = client.patch(ENDPOINT, json={field: value}, headers=auth_headers)

    assert response.status_code == 422
    assert admin.update_data is None


def test_patch_rejects_kyc_fields(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[COMPLETE_PROFILE])

    response = client.patch(
        ENDPOINT,
        json={"telefon": "+34 611 111 111", "nif": "12345678Z"},
        headers=auth_headers,
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Les dades verificades per KYC no es poden modificar directament."
    }
    assert admin.update_data is None


def test_patch_rejects_body_with_only_kyc_fields(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[COMPLETE_PROFILE])
    body = {
        "nif": "12345678Z",
        "data_naixement": "1990-05-17",
        "residencia_fiscal": "ES",
    }

    response = client.patch(ENDPOINT, json=body, headers=auth_headers)

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Les dades verificades per KYC no es poden modificar directament."
    }
    assert admin.update_data is None


def test_patch_requires_completed_personal_data_step(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[{"id": SUBJECT}])

    response = client.patch(
        ENDPOINT, json={"telefon": "+34 611 111 111"}, headers=auth_headers
    )

    assert response.status_code == 409
    assert admin.update_data is None


def test_post_verified_profile_rejects_changed_nif(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[VERIFIED_PROFILE])

    response = client.post(
        ENDPOINT, json={**VALID_BODY, "nif": "X0000000T"}, headers=auth_headers
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Les dades verificades per KYC no es poden modificar directament."
    }
    assert admin.update_data is None


def test_post_verified_profile_accepts_same_nif(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[VERIFIED_PROFILE])

    response = client.post(ENDPOINT, json=VALID_BODY, headers=auth_headers)

    assert response.status_code == 200
    assert admin.update_data == VALID_BODY


def test_post_verified_profile_rejects_changed_birth_date(
    client, auth_headers, fake_admin
):
    admin = fake_admin(rows=[VERIFIED_PROFILE])

    response = client.post(
        ENDPOINT,
        json={**VALID_BODY, "data_naixement": "1991-01-01"},
        headers=auth_headers,
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Les dades verificades per KYC no es poden modificar directament."
    }
    assert admin.update_data is None


def test_post_unverified_profile_accepts_changed_nif(client, auth_headers, fake_admin):
    admin = fake_admin(rows=[COMPLETE_PROFILE])

    response = client.post(
        ENDPOINT, json={**VALID_BODY, "nif": "X0000000T"}, headers=auth_headers
    )

    assert response.status_code == 200
    assert admin.update_data["nif"] == "X0000000T"


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
    assert response.json() == {"detail": "No s'han pogut desar les dades personals"}


def test_model_fields_match_onboarding_rule():
    """L'endpoint desa exactament les columnes que la regla de l'onboarding comprova."""
    assert set(PersonalData.model_fields) == set(PERSONAL_DATA_COLUMNS)


def test_saved_profile_returns_iban_only_masked(client, auth_headers, fake_admin):
    """La fila desada pot portar l'IBAN vinculat: només surt emmascarat."""
    iban = "ES9121000418450200051332"
    fake_admin(rows=[{"id": SUBJECT, **VALID_BODY, "iban": iban}])

    response = client.post(ENDPOINT, json=VALID_BODY, headers=auth_headers)

    assert response.status_code == 200
    perfil = response.json()["perfil"]
    assert "iban" not in perfil
    assert perfil["iban_emmascarat"] == "ES•• •••• •••• •••• •••• 1332"
    assert iban not in response.text


def test_patch_returns_iban_only_masked(client, auth_headers, fake_admin):
    """El PATCH també retorna la fila desada: l'IBAN només surt emmascarat."""
    iban = "ES9121000418450200051332"
    fake_admin(rows=[{**COMPLETE_PROFILE, "iban": iban}])

    response = client.patch(ENDPOINT, json={"nom": "Marta"}, headers=auth_headers)

    assert response.status_code == 200
    perfil = response.json()["perfil"]
    assert "iban" not in perfil
    assert perfil["iban_emmascarat"] == "ES•• •••• •••• •••• •••• 1332"
    assert iban not in response.text
