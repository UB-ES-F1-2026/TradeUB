"""Tests HTTP de GET /api/v1/users/me."""

from datetime import UTC, datetime, timedelta

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWKClientError
from supabase import PostgrestAPIError

from api import deps

ENDPOINT = "/api/v1/users/me"

# Un instant clarament al passat, per al token caducat.
EXPIRED_AT = datetime.now(UTC) - timedelta(hours=1)


# --- Casos que no arriben ni a demanar la clau al JWKS ---


def test_missing_header_returns_401(client):
    """Sense capcalera Authorization, es rebutja la peticio."""
    response = client.get(ENDPOINT)

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "header_value",
    ["Bearer", "Bearer ", "Bearer  ", "Basic eyJ4IjoxfQ=="],
    ids=["no-space", "empty-credential", "double-space", "wrong-scheme"],
)
def test_malformed_header_returns_401(client, header_value):
    """Amb capçalera Authorization mal formada, es rebutja la peticio."""
    response = client.get(ENDPOINT, headers={"Authorization": header_value})

    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_non_jwt_token_returns_401(client):
    """Un token mal format passa HTTPBearer pero el rebutja la validacio del JWT."""
    response = client.get(ENDPOINT, headers={"Authorization": "Bearer basura"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Token invàlid"


# --- Capa 2: validacio del token (fake_jwks substitueix el JWKS real) ---


def test_expired_token_returns_401(client, make_token):
    """Un token caducat es rebutja amb un detail propi, diferent de la resta."""
    response = client.get(
        ENDPOINT, headers={"Authorization": f"Bearer {make_token(exp=EXPIRED_AT)}"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Token expirat"


def test_wrong_audience_returns_401(client, make_token):
    """Un token per a una altra audiencia no val per a aquesta API."""
    response = client.get(
        ENDPOINT,
        headers={"Authorization": f"Bearer {make_token(aud='una-altra-cosa')}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Token invàlid"


def test_wrong_issuer_returns_401(client, make_token):
    """Un token emes per un altre projecte de Supabase no val."""
    token = make_token(iss="https://un-altre-projecte.supabase.co/auth/v1")
    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Token invàlid"


def test_wrong_signature_returns_401(client, make_token):
    """Un token signat amb una altra clau es rebutja."""
    other_key = ec.generate_private_key(ec.SECP256R1())
    token = make_token(key=other_key)

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Token invàlid"


def test_unsigned_token_returns_401(client, make_token):
    """Un token amb alg: none i sense signatura es rebutja."""
    token = make_token(algorithm="none", key=None)
    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Token invàlid"


def test_jwks_unreachable_returns_503(client, make_token, monkeypatch):
    """Si el JWKS no respon es un fallo nostre, no del client: 503 i no 401."""
    token = make_token()

    class BrokenJwksClient:
        def get_signing_key_from_jwt(self, token):
            raise PyJWKClientError("no es pot baixar el JWKS")

    monkeypatch.setattr(deps, "jwks_client", BrokenJwksClient())

    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 503
    assert (
        response.json()["detail"] == "No s'ha pogut validar el token a través del JWKS"
    )


# --- Capa 3: cos de l'endpoint ---

# Un UUID distintiu, per comprovar que el filtre surt del token.
SUBJECT = "11111111-2222-3333-4444-555555555555"


def test_valid_token_returns_profile(client, make_token, fake_profile):
    """Amb un token valid i una fila a profiles, es retorna user i perfil. Comprova tambe que el perfil es filtra pel sub del token"""
    profile = {"id": SUBJECT, "username": "ivan"}
    fake_db = fake_profile(rows=[profile])

    token = make_token(sub=SUBJECT)
    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["sub"] == SUBJECT
    assert body["perfil"] == profile
    assert fake_db.table_name == "profiles"
    assert fake_db.eq_args == ("id", SUBJECT)


def test_empty_profile_when_no_row(client, make_token, fake_profile):
    """Sense fila a profiles es retorna 200 amb el perfil buit."""
    fake_profile(rows=[])

    token = make_token(sub=SUBJECT)
    response = client.get(ENDPOINT, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["perfil"] == {}


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
    assert response.json()["detail"] == "No s'ha pogut recuperar el perfil"
