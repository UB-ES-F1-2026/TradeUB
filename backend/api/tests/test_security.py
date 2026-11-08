"""Proves de seguretat transversals de l'API.

Comproven que cap ruta de /api/v1 queda oberta sense sessió, que les dades
sempre es filtren per l'usuari del token (mai per paràmetres de la petició) i
que la 2FA s'exigeix també a través d'una petició HTTP real.
"""

from types import SimpleNamespace

import pytest

import main
from api import deps

# Rutes de /api/v1 que poden respondre sense sessió. Afegir-hi una ruta ha de
# ser una decisió explícita de l'equip.
PUBLIC_ROUTES: set[tuple[str, str]] = {
    ("GET", "/api/v1/health"),  # smoke test del desplegament (#74): no retorna cap dada
}

SUBJECT = "11111111-2222-3333-4444-555555555555"
OTHER_USER = "99999999-8888-7777-6666-555555555555"


def _api_routes():
    """Parelles (mètode, ruta) de tots els endpoints registrats sota /api/v1.

    Es llegeixen de l'esquema OpenAPI perquè hi surten totes les rutes, també
    les dels routers inclosos amb include_router.
    """
    return sorted(
        (method.upper(), path)
        for path, operations in main.app.openapi()["paths"].items()
        if path.startswith("/api/v1")
        for method in operations
    )


def _mfa_client(totp):
    """Client fals que només respon la llista de factors MFA."""
    return SimpleNamespace(
        auth=SimpleNamespace(
            mfa=SimpleNamespace(list_factors=lambda: SimpleNamespace(totp=totp))
        )
    )


def test_api_has_routes_to_check():
    """Si no es troba cap ruta, el test de rutes protegides no comprovaria res."""
    assert _api_routes()


@pytest.mark.parametrize(("method", "path"), _api_routes())
def test_every_route_requires_session(client, method, path):
    """Sense capçalera Authorization, cap endpoint de /api/v1 respon dades."""
    if (method, path) in PUBLIC_ROUTES:
        pytest.skip("Ruta pública declarada a PUBLIC_ROUTES")

    # Els paràmetres de ruta ({id}) es substitueixen per un valor qualsevol
    url = path.replace("{", "").replace("}", "")
    response = client.request(method, url)

    assert response.status_code == 401


def test_query_params_cannot_select_another_user(client, make_token, fake_profile):
    """Encara que la petició demani un altre id, el filtre surt del token."""
    fake_db = fake_profile(rows=[{"id": SUBJECT}])

    response = client.get(
        "/api/v1/users/me",
        params={"id": OTHER_USER, "user_id": OTHER_USER, "sub": OTHER_USER},
        headers={
            "Authorization": f"Bearer {make_token(sub=SUBJECT)}",
            "X-User-Id": OTHER_USER,
        },
    )

    assert response.status_code == 200
    assert fake_db.eq_args == ("id", SUBJECT)


def test_aal1_session_with_mfa_is_rejected(client, make_token, fake_profile, monkeypatch):
    """Amb la 2FA activa, una sessió que només ha posat la contrasenya rep 403."""
    fake_db = fake_profile(rows=[{"id": SUBJECT}])
    monkeypatch.setattr(deps, "create_user_client", lambda token: _mfa_client([object()]))

    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {make_token(sub=SUBJECT, aal='aal1')}"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Cal completar la verificació en dos passos"
    # No s'ha arribat a consultar la base de dades
    assert fake_db.table_name is None


def test_aal1_session_without_mfa_is_accepted(client, make_token, fake_profile, monkeypatch):
    """Sense 2FA activa, la sessió amb només contrasenya és vàlida."""
    fake_profile(rows=[{"id": SUBJECT}])
    monkeypatch.setattr(deps, "create_user_client", lambda token: _mfa_client([]))

    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {make_token(sub=SUBJECT, aal='aal1')}"},
    )

    assert response.status_code == 200
