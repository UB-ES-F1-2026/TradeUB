"""Tests HTTP de la verificació simulada i els termes (US2.4).

Cobreix POST /api/v1/profile/identity-document, POST /api/v1/profile/terms,
el camp ``verificacio`` de GET /api/v1/users/me i la dependència
``require_verified_user``. La validació del token ja es prova a
test_users_me.py.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import Depends
from supabase import PostgrestAPIError

import main
from api import deps
from core.verification import REVIEW_SECONDS, TERMS_VERSION

DOCUMENT_ENDPOINT = "/api/v1/profile/identity-document"
TERMS_ENDPOINT = "/api/v1/profile/terms"
ME_ENDPOINT = "/api/v1/users/me"
PROTECTED_ENDPOINT = "/api/v1/test/require-verified"

SUBJECT = "11111111-2222-3333-4444-555555555555"


def _ago(seconds: int) -> str:
    return (datetime.now(UTC) - timedelta(seconds=seconds)).isoformat()


VERIFIED_SENT_AT = _ago(REVIEW_SECONDS + 60)


class FakeAdminClient:
    """Doble encadenable de table().select()/update().eq().execute().

    Guarda una sola fila de profiles (o cap) i hi aplica els update, com
    faria PostgREST, per poder comprovar el que s'ha desat.
    """

    def __init__(self, row=None, error=None):
        self.row = row
        self.error = error
        self.update_data = None
        self.eq_args = []
        self._pending_update = None

    def table(self, name):
        assert name == "profiles"
        return self

    def select(self, *columns):
        self._pending_update = None
        return self

    def update(self, data):
        self._pending_update = data
        return self

    def eq(self, column, value):
        self.eq_args.append((column, value))
        return self

    def execute(self):
        if self.error is not None:
            raise self.error
        if self.row is None:
            return SimpleNamespace(data=[])
        if self._pending_update is not None:
            self.update_data = self._pending_update
            self.row = {**self.row, **self._pending_update}
            self._pending_update = None
        return SimpleNamespace(data=[self.row])


@pytest.fixture
def fake_admin():
    """Substitueix get_admin_client per un doble i el retorna per inspeccionar-lo."""

    def install(row=None, error=None):
        admin = FakeAdminClient(row, error)
        main.app.dependency_overrides[deps.get_admin_client] = lambda: admin
        return admin

    yield install
    main.app.dependency_overrides.clear()


@pytest.fixture
def auth(make_token):
    return {"Authorization": f"Bearer {make_token(sub=SUBJECT)}"}


# --- POST /profile/identity-document ---


def test_document_requires_token(client):
    assert client.post(DOCUMENT_ENDPOINT).status_code == 401


def test_document_saves_sent_at_and_starts_review(client, auth, fake_admin):
    """Desa només el moment de l'enviament, filtrat pel sub del token."""
    admin = fake_admin(row={"id": SUBJECT})
    before = datetime.now(UTC)

    response = client.post(DOCUMENT_ENDPOINT, headers=auth)

    assert response.status_code == 200
    assert list(admin.update_data) == ["dni_enviat_at"]
    sent_at = datetime.fromisoformat(admin.update_data["dni_enviat_at"])
    assert before <= sent_at <= datetime.now(UTC)
    assert admin.eq_args == [("id", SUBJECT)]
    verificacio = response.json()["verificacio"]
    assert verificacio["estat"] == "en-revisio"
    assert verificacio["document_enviat_at"] == admin.update_data["dni_enviat_at"]


def test_document_resubmission_restarts_review(client, auth, fake_admin):
    """Si ja estava verificat, tornar-lo a enviar el posa en revisió de nou."""
    admin = fake_admin(row={"id": SUBJECT, "dni_enviat_at": VERIFIED_SENT_AT})

    response = client.post(DOCUMENT_ENDPOINT, headers=auth)

    assert response.status_code == 200
    assert admin.update_data["dni_enviat_at"] != VERIFIED_SENT_AT
    assert response.json()["verificacio"]["estat"] == "en-revisio"


def test_document_ignores_body(client, auth, fake_admin):
    """El client no pot triar el moment de l'enviament ni l'estat."""
    admin = fake_admin(row={"id": SUBJECT})

    response = client.post(
        DOCUMENT_ENDPOINT,
        headers=auth,
        json={"dni_enviat_at": VERIFIED_SENT_AT, "estat": "verificat"},
    )

    assert response.status_code == 200
    assert admin.update_data["dni_enviat_at"] != VERIFIED_SENT_AT
    assert response.json()["verificacio"]["estat"] == "en-revisio"


def test_document_without_profile_returns_404(client, auth, fake_admin):
    fake_admin(row=None)

    response = client.post(DOCUMENT_ENDPOINT, headers=auth)

    assert response.status_code == 404
    assert response.json()["detail"] == "Perfil no trobat"


def test_document_database_error_returns_500(client, auth, fake_admin):
    fake_admin(row={"id": SUBJECT}, error=PostgrestAPIError({"message": "boom"}))

    response = client.post(DOCUMENT_ENDPOINT, headers=auth)

    assert response.status_code == 500
    assert response.json()["detail"] == (
        "No s'ha pogut registrar l'enviament del document"
    )


# --- POST /profile/terms ---


def test_terms_requires_token(client):
    assert client.post(TERMS_ENDPOINT, json={"versio": TERMS_VERSION}).status_code == 401


def test_terms_saves_current_version_when_verified(client, auth, fake_admin):
    admin = fake_admin(row={"id": SUBJECT, "dni_enviat_at": VERIFIED_SENT_AT})
    before = datetime.now(UTC)

    response = client.post(TERMS_ENDPOINT, headers=auth, json={"versio": TERMS_VERSION})

    assert response.status_code == 200
    assert set(admin.update_data) == {"termes_versio", "termes_acceptats_at"}
    assert admin.update_data["termes_versio"] == TERMS_VERSION
    accepted_at = datetime.fromisoformat(admin.update_data["termes_acceptats_at"])
    assert before <= accepted_at <= datetime.now(UTC)
    assert all(arg == ("id", SUBJECT) for arg in admin.eq_args)
    verificacio = response.json()["verificacio"]
    assert verificacio["estat"] == "verificat"
    assert verificacio["termes_acceptats"] is True


@pytest.mark.parametrize(
    "sent_at",
    [None, _ago(1)],
    ids=["pending", "in-review"],
)
def test_terms_rejected_until_identity_verified(client, auth, fake_admin, sent_at):
    admin = fake_admin(row={"id": SUBJECT, "dni_enviat_at": sent_at})

    response = client.post(TERMS_ENDPOINT, headers=auth, json={"versio": TERMS_VERSION})

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Cal tenir la identitat verificada per acceptar els termes"
    )
    assert admin.update_data is None


def test_terms_rejects_other_version(client, auth, fake_admin):
    admin = fake_admin(row={"id": SUBJECT, "dni_enviat_at": VERIFIED_SENT_AT})

    response = client.post(TERMS_ENDPOINT, headers=auth, json={"versio": "2020-01"})

    assert response.status_code == 409
    assert response.json()["detail"] == "La versió dels termes no és la vigent"
    assert admin.update_data is None


@pytest.mark.parametrize("body", [{}, {"versio": ""}, {"versio": "   "}])
def test_terms_requires_version(client, auth, fake_admin, body):
    fake_admin(row={"id": SUBJECT, "dni_enviat_at": VERIFIED_SENT_AT})

    response = client.post(TERMS_ENDPOINT, headers=auth, json=body)

    assert response.status_code == 422


def test_terms_without_profile_returns_404(client, auth, fake_admin):
    fake_admin(row=None)

    response = client.post(TERMS_ENDPOINT, headers=auth, json={"versio": TERMS_VERSION})

    assert response.status_code == 404


def test_terms_database_error_returns_500(client, auth, fake_admin):
    fake_admin(row={"id": SUBJECT}, error=PostgrestAPIError({"message": "boom"}))

    response = client.post(TERMS_ENDPOINT, headers=auth, json={"versio": TERMS_VERSION})

    assert response.status_code == 500


# --- GET /users/me ---


def test_users_me_includes_verification(client, auth, fake_profile):
    fake_profile(rows=[{"id": SUBJECT, "dni_enviat_at": _ago(1)}])

    response = client.get(ME_ENDPOINT, headers=auth)

    assert response.status_code == 200
    verificacio = response.json()["verificacio"]
    assert verificacio["estat"] == "en-revisio"
    assert verificacio["termes_versio_vigent"] == TERMS_VERSION
    assert verificacio["termes_acceptats"] is False


def test_users_me_without_profile_is_pending(client, auth, fake_profile):
    fake_profile(rows=[])

    response = client.get(ME_ENDPOINT, headers=auth)

    assert response.json()["verificacio"]["estat"] == "pendent"


# --- require_verified_user ---


@pytest.fixture
def protected_route():
    """Ruta de prova que fa servir la dependència, com farà un endpoint operatiu."""

    @main.app.get(PROTECTED_ENDPOINT)
    def _protected(user=Depends(deps.require_verified_user)):
        return {"sub": user["sub"]}

    yield
    main.app.router.routes.pop()


def test_require_verified_user_allows_verified(
    client, auth, fake_profile, protected_route
):
    db = fake_profile(
        rows=[
            {
                "id": SUBJECT,
                "dni_enviat_at": VERIFIED_SENT_AT,
                "termes_versio": TERMS_VERSION,
                "termes_acceptats_at": _ago(10),
            }
        ]
    )

    response = client.get(PROTECTED_ENDPOINT, headers=auth)

    assert response.status_code == 200
    assert response.json() == {"sub": SUBJECT}
    assert db.eq_args == ("id", SUBJECT)


@pytest.mark.parametrize(
    "profile",
    [
        {},
        {"dni_enviat_at": _ago(1), "termes_versio": TERMS_VERSION,
         "termes_acceptats_at": _ago(1)},
        {"dni_enviat_at": VERIFIED_SENT_AT},
        {"dni_enviat_at": VERIFIED_SENT_AT, "termes_versio": "2020-01",
         "termes_acceptats_at": _ago(10)},
    ],
    ids=["no-row", "in-review", "no-terms", "old-terms"],
)
def test_require_verified_user_rejects_with_403(
    client, auth, fake_profile, protected_route, profile
):
    fake_profile(rows=[profile] if profile else [])

    response = client.get(PROTECTED_ENDPOINT, headers=auth)

    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Cal verificar la identitat i acceptar els termes per operar"
    )


def test_require_verified_user_database_error_returns_500(
    client, auth, fake_profile, protected_route
):
    fake_profile(error=PostgrestAPIError({"message": "boom"}))

    response = client.get(PROTECTED_ENDPOINT, headers=auth)

    assert response.status_code == 500
