"""Fixtures compartides pels tests de l'API.

Els tests son hermetics: no fan cap peticio de xarxa ni toquen dades reals
de Supabase. El JWKS es substitueix per una clau generada aqui mateix i la
taula profiles per un doble.
"""

import os
import socket

# Definim les env vars que es llegeixen en importació
os.environ["SUPABASE_URL"] = "https://proyecto-de-test.supabase.co"
os.environ["SUPABASE_KEY"] = "sb_publishable_clave_falsa_de_test"

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import main
from api import deps
from core.config import SUPABASE_URL


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """Cap test pot sortir a la xarxa. Si algun ho intenta, falla a l'acte."""

    def _connect_block(self, address):
        raise RuntimeError(f"XARXA BLOQUEJADA: connect a {address}")

    def _dns_block(host, port, *a, **k):
        raise RuntimeError(f"XARXA BLOQUEJADA: DNS de {host}:{port}")

    monkeypatch.setattr(socket.socket, "connect", _connect_block)
    monkeypatch.setattr(socket, "getaddrinfo", _dns_block)


@pytest.fixture
def client():
    """TestClient sense cap override d'autenticacio."""
    with TestClient(main.app) as c:
        yield c
    main.app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def signing_key():
    """Parella de claus EC P-256 que fa el paper de la clau de Supabase.

    Returns:
        Tupla (clau_privada, clau_publica).
    """
    private_key = ec.generate_private_key(ec.SECP256R1())

    return private_key, private_key.public_key()


@pytest.fixture()
def fake_jwks(monkeypatch, signing_key):
    """Substitueix el client JWKS de deps per un doble sense xarxa."""
    _, public_key = signing_key

    class FakeJwksClient:
        def get_signing_key_from_jwt(self, token):
            return SimpleNamespace(key=public_key)

    monkeypatch.setattr(deps, "jwks_client", FakeJwksClient())


@pytest.fixture
def make_token(signing_key, fake_jwks):
    """Fabrica de JWT signats en local, per defecte valids, aal2 i amb ES256.

    Returns:
        Funcio que accepta **claims per sobreescriure els valors per defecte.
        Els parametres algorithm i key permeten simular un token signat amb un
        algorisme que deps.py no te a la llista blanca.
    """

    private_key, _ = signing_key

    def _make(algorithm="ES256", key=None, **overrides):
        now = datetime.now(UTC)
        claims = {
            "sub": "123e4567-e89b-42d3-a456-426614174000",
            "email": "test@example.com",
            "role": "authenticated",
            "aal": "aal2",
            "aud": "authenticated",
            "iss": f"{SUPABASE_URL}/auth/v1",
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        claims.update(overrides)
        if algorithm == "ES256" and key is None:
            key = private_key
        return jwt.encode(
            claims,
            key,
            algorithm=algorithm,
            headers={"kid": "k1"},
        )

    return _make


@pytest.fixture
def fake_profile():
    """Sobreescriu get_user_client amb un doble encadenable de Supabase.

    Imita nomes el que fa users.py:
        db.table("profiles").select("*").eq("id", <sub>).execute() -> .data

    El doble guarda els arguments d'eq() per poder comprovar que el perfil
    es filtra pel subjecte del token i no per cap parametre de la peticio.

    Yields:
        Funcio install(rows=None, error=None) que instal·la l'override i
        retorna el doble, per poder inspeccionar-lo des del test.
    """

    class FakeSupabaseClient:
        def __init__(self, rows, error):
            self.rows = rows
            self.error = error
            self.table_name = None
            self.eq_args = None

        def table(self, name):
            self.table_name = name
            return self

        def select(self, *columns):
            return self

        def eq(self, column, value):
            self.eq_args = (column, value)
            return self

        def execute(self):
            if self.error is not None:
                raise self.error
            return SimpleNamespace(data=self.rows)

    def install(rows=None, error=None):
        fake_client = FakeSupabaseClient(rows or [], error)
        main.app.dependency_overrides[deps.get_user_client] = lambda: fake_client
        return fake_client

    yield install
    main.app.dependency_overrides.clear()
