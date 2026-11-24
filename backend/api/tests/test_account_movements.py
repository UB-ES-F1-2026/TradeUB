"""Tests HTTP de GET /api/v1/account/movements (US3.5).

La validacio del token ja es prova a test_users_me.py i la de
require_verified_user a test_identity_verification.py; aqui es comprova que
l'endpoint esta protegit, els filtres que arriben a la consulta i el cos.
"""

from types import SimpleNamespace

import pytest
from fastapi import Depends
from supabase import PostgrestAPIError

import main
from api import deps

ENDPOINT = "/api/v1/account/movements"

SUBJECT = "11111111-2222-3333-4444-555555555555"

DEPOSIT = {
    "id": "a",
    "user_id": SUBJECT,
    "type": "ingres",
    "amount": 500.0,
    "balance_after": 10500.0,
    "created_at": "2026-11-14T10:00:00+00:00",
}

WITHDRAWAL = {
    "id": "b",
    "user_id": SUBJECT,
    "type": "retirada",
    "amount": -200.0,
    "balance_after": 10300.0,
    "created_at": "2026-11-15T09:00:00+00:00",
    "iban_masked": "ES•• •••• •••• •••• •••• 1332",
}


class FakeMovementsClient:
    """Doble de select().eq().gte().lt().order().range().execute().

    Guarda cada filtre per comprovar-lo; no filtra les files.
    """

    def __init__(self, rows, error):
        self.rows = rows
        self.error = error
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return self

    def __getattr__(self, method):
        def record(*args, **kwargs):
            self.calls.append((method, *args, *kwargs.values()))
            return self

        return record

    def execute(self):
        if self.error is not None:
            raise self.error
        return SimpleNamespace(data=self.rows)


@pytest.fixture
def fake_movements():
    """Usuari verificat i cash_movements substituida per un doble."""

    def install(rows=None, error=None):
        fake = FakeMovementsClient(rows or [], error)
        main.app.dependency_overrides[deps.require_verified_user] = (
            lambda user=Depends(deps.get_current_user): user
        )
        main.app.dependency_overrides[deps.get_user_client] = lambda: fake
        return fake

    yield install
    main.app.dependency_overrides.clear()


def get(client, make_token, **params):
    token = make_token(sub=SUBJECT)
    return client.get(
        ENDPOINT, params=params, headers={"Authorization": f"Bearer {token}"}
    )


def test_missing_header_returns_401(client):
    """Sense sessio no es pot consultar l'historial."""
    response = client.get(ENDPOINT)

    assert response.status_code == 401


def test_unverified_user_returns_403(client, make_token, fake_profile):
    """Sense DNI verificat ni termes acceptats no es consulta l'historial."""
    fake_profile(rows=[])

    response = get(client, make_token)

    assert response.status_code == 403


def test_returns_movements_with_server_concept(client, make_token, fake_movements):
    """Cada moviment porta el concepte generat i res mes que els camps public."""
    fake_movements(rows=[WITHDRAWAL, DEPOSIT])

    response = get(client, make_token)

    assert response.status_code == 200
    assert response.json() == {
        "movements": [
            {
                "created_at": WITHDRAWAL["created_at"],
                "concept": "Retirada a ES•• 1332",
                "amount": -200.0,
                "type": "retirada",
                "balance_after": 10300.0,
            },
            {
                "created_at": DEPOSIT["created_at"],
                "concept": "Ingrés de diners",
                "amount": 500.0,
                "type": "ingres",
                "balance_after": 10500.0,
            },
        ],
        "has_more": False,
    }


def test_default_query_filters_by_token_subject_newest_first(
    client, make_token, fake_movements
):
    """Sense filtres: nomes els del sub, del mes nou al mes antic, 20 + 1 files."""
    fake = fake_movements()

    get(client, make_token)

    assert fake.calls == [
        ("table", "cash_movements"),
        ("select", "*"),
        ("eq", "user_id", SUBJECT),
        ("order", "created_at", True),
        ("order", "id", True),
        ("range", 0, 20),
    ]


def test_filters_reach_the_query(client, make_token, fake_movements):
    """Les dates son incloses i es combinen amb el tipus i la pagina."""
    fake = fake_movements()

    get(
        client,
        make_token,
        **{"from": "2026-11-01", "to": "2026-11-15", "type": "retirada"},
        limit=5,
        offset=10,
    )

    assert ("gte", "created_at", "2026-11-01T00:00:00+00:00") in fake.calls
    assert ("lte", "created_at", "2026-11-15T23:59:59.999999+00:00") in fake.calls
    assert ("eq", "type", "retirada") in fake.calls
    assert ("range", 10, 15) in fake.calls


def test_extra_row_means_there_is_another_page(client, make_token, fake_movements):
    """La fila de mes no es retorna, nomes activa has_more."""
    fake_movements(rows=[WITHDRAWAL, DEPOSIT])

    body = get(client, make_token, limit=1).json()

    assert len(body["movements"]) == 1
    assert body["has_more"] is True


def test_withdrawal_without_saved_iban_has_generic_concept(
    client, make_token, fake_movements
):
    """Les retirades anteriors a #116 no tenen IBAN desat."""
    fake_movements(rows=[{**WITHDRAWAL, "iban_masked": None}])

    body = get(client, make_token).json()

    assert body["movements"][0]["concept"] == "Retirada de diners"


def test_last_possible_date_is_accepted(client, make_token, fake_movements):
    """El final del dia no es calcula sumant un dia, que desbordaria."""
    fake_movements()

    response = get(client, make_token, to="9999-12-31")

    assert response.status_code == 200


@pytest.mark.parametrize(
    ("movement_type", "concept"),
    [("compra", "Compra d'actius"), ("venda", "Venda d'actius")],
)
def test_buy_and_sell_have_their_concept(
    client, make_token, fake_movements, movement_type, concept
):
    """La compra (US6.1) i la venda (US6.2) no es mostren com a retirada."""
    fake_movements(rows=[{**WITHDRAWAL, "type": movement_type, "iban_masked": None}])

    body = get(client, make_token).json()

    assert body["movements"][0]["concept"] == concept
    assert body["movements"][0]["type"] == movement_type


def test_unknown_movement_type_has_generic_concept(client, make_token, fake_movements):
    """Un tipus que l'endpoint encara no coneix té un concepte genèric."""
    fake_movements(rows=[{**WITHDRAWAL, "type": "dividend", "iban_masked": None}])

    body = get(client, make_token).json()

    assert body["movements"][0]["concept"] == "Moviment d'efectiu"


@pytest.mark.parametrize("movement_type", ["compra", "venda"])
def test_buy_and_sell_filters_reach_the_query(
    client, make_token, fake_movements, movement_type
):
    """El filtre de tipus també admet la compra i la venda."""
    fake = fake_movements()

    response = get(client, make_token, type=movement_type)

    assert response.status_code == 200
    assert ("eq", "type", movement_type) in fake.calls


@pytest.mark.parametrize(
    "params",
    [
        {"type": "dividend"},
        {"from": "15/11/2026"},
        {"limit": 0},
        {"limit": 101},
        {"offset": -1},
    ],
)
def test_invalid_params_return_422(client, make_token, fake_movements, params):
    """Tipus, dates i paginacio fora del que admet l'endpoint."""
    fake_movements()

    response = get(client, make_token, **params)

    assert response.status_code == 422


def test_from_after_to_returns_422(client, make_token, fake_movements):
    """Un rang de dates invertit es rebutja amb un missatge propi."""
    fake_movements()

    response = get(client, make_token, **{"from": "2026-11-15", "to": "2026-11-01"})

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "La data d'inici no pot ser posterior a la data de fi."
    )


def test_postgrest_error_returns_500(client, make_token, fake_movements):
    """Si PostgREST rebutja la consulta, es un 500 amb un missatge propi."""
    fake_movements(
        error=PostgrestAPIError(
            {"message": "boom", "code": "42501", "hint": None, "details": None}
        )
    )

    response = get(client, make_token)

    assert response.status_code == 500
    assert response.json()["detail"] == "No s'ha pogut recuperar l'historial"
