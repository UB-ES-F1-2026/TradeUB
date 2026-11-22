"""Tests HTTP de PUT /api/v1/profile/iban (US3.3).

La validació del token ja es prova a test_users_me.py, la de l'usuari
verificat a test_identity_verification.py i la de l'IBAN a test_iban.py.
Aquí es comprova el contracte de l'endpoint.
"""

from datetime import UTC, datetime, timedelta

import pytest
from supabase import PostgrestAPIError

from core.iban import IBAN_ERROR
from core.verification import REVIEW_SECONDS, TERMS_VERSION

ENDPOINT = "/api/v1/profile/iban"

SUBJECT = "11111111-2222-3333-4444-555555555555"

VALID_IBAN = "ES9121000418450200051332"
MASKED_IBAN = "ES•• •••• •••• •••• •••• 1332"


def _ago(seconds: int) -> str:
    return (datetime.now(UTC) - timedelta(seconds=seconds)).isoformat()


VERIFIED_PROFILE = {
    "id": SUBJECT,
    "dni_enviat_at": _ago(REVIEW_SECONDS + 60),
    "termes_versio": TERMS_VERSION,
    "termes_acceptats_at": _ago(10),
}


@pytest.fixture
def auth(make_token):
    return {"Authorization": f"Bearer {make_token(sub=SUBJECT)}"}


@pytest.fixture
def verified(fake_profile):
    """L'usuari del token està verificat i ha acceptat els termes."""
    fake_profile(rows=[VERIFIED_PROFILE])


def test_link_iban_requires_token(client):
    assert client.put(ENDPOINT, json={"iban": VALID_IBAN}).status_code == 401


def test_link_iban_rejects_unverified_user(client, auth, fake_profile, fake_admin):
    fake_profile(rows=[{"id": SUBJECT}])
    admin = fake_admin()

    response = client.put(ENDPOINT, headers=auth, json={"iban": VALID_IBAN})

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Cal verificar la identitat i acceptar els termes per operar"
    )
    assert admin.update_data is None


def test_link_iban_saves_normalized_and_returns_masked(
    client, auth, verified, fake_admin
):
    """Es desa sense espais i en majúscules, i només es retorna emmascarat."""
    admin = fake_admin()

    response = client.put(
        ENDPOINT, headers=auth, json={"iban": " es91 2100 0418 4502 0005 1332 "}
    )

    assert response.status_code == 200
    assert response.json() == {"iban_emmascarat": MASKED_IBAN}
    assert VALID_IBAN not in response.text
    assert admin.table_name == "profiles"
    assert admin.eq_args == ("id", SUBJECT)
    assert admin.update_data == {"iban": VALID_IBAN}


def test_link_iban_only_saves_the_iban(client, auth, verified, fake_admin):
    """Els camps de més del cos (com l'id) s'ignoren: només es desa l'IBAN."""
    admin = fake_admin()

    response = client.put(
        ENDPOINT,
        headers=auth,
        json={"iban": VALID_IBAN, "id": "99999999-9999-9999-9999-999999999999"},
    )

    assert response.status_code == 200
    assert admin.eq_args == ("id", SUBJECT)
    assert admin.update_data == {"iban": VALID_IBAN}


@pytest.mark.parametrize(
    "iban",
    ["ES9121000418450200051333", "DE89370400440532013000", "ES91", ""],
    ids=["wrong-check-digits", "other-country", "too-short", "empty"],
)
def test_link_iban_rejects_invalid_iban(client, auth, verified, fake_admin, iban):
    admin = fake_admin()

    response = client.put(ENDPOINT, headers=auth, json={"iban": iban})

    assert response.status_code == 422
    assert response.json()["detail"] == IBAN_ERROR
    assert admin.update_data is None


def test_link_iban_without_profile_returns_404(client, auth, verified, fake_admin):
    fake_admin(rows=[])

    response = client.put(ENDPOINT, headers=auth, json={"iban": VALID_IBAN})

    assert response.status_code == 404
    assert response.json()["detail"] == "Perfil no trobat"


def test_link_iban_database_error_returns_500(client, auth, verified, fake_admin):
    fake_admin(error=PostgrestAPIError({"message": "boom"}))

    response = client.put(ENDPOINT, headers=auth, json={"iban": VALID_IBAN})

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut desar l'IBAN"
