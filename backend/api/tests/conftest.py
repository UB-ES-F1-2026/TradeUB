"""Fixtures compartides pels tests de l'API.

Els tests son hermetics: no fan cap peticio de xarxa ni toquen dades reals
de Supabase. El JWKS es substitueix per una clau generada aqui mateix i la
taula profiles per dobles (de lectura amb el client de l'usuari i
d'escriptura amb el client d'administracio).
"""

import math
import os
import socket

# Definim les env vars que es llegeixen en importació
os.environ["SUPABASE_URL"] = "https://proyecto-de-test.supabase.co"
os.environ["SUPABASE_KEY"] = "sb_publishable_clave_falsa_de_test"
os.environ["SUPABASE_SECRET_KEY"] = "sb_secret_clave_falsa_de_test"

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


class FakeAdminClient:
    """Doble encadenable de la clau secreta.

    Imita table().select/update().eq().execute() i rpc(nom, params). Amb
    rpc, execute() retorna ``rows`` com a ``data`` (el valor de la funció).
    """

    def __init__(self, rows=None, error=None):
        self.rows = rows
        self.error = error
        self.table_name = None
        self.update_data = None
        self.eq_args = None
        self.rpc_call = None
        self.select_mode = False

    def rpc(self, name, params):
        self.rpc_call = (name, params)
        return self

    def table(self, name):
        self.table_name = name
        return self

    def select(self, *columns):
        self.select_mode = True
        return self

    def update(self, data):
        self.select_mode = False
        self.update_data = data
        return self

    def eq(self, column, value):
        self.eq_args = (column, value)
        return self

    def execute(self):
        if self.error is not None:
            raise self.error
        if self.select_mode:
            return SimpleNamespace(data=self.rows or [])
        if self.rows is not None:
            if not self.rows or self.update_data is None:
                return SimpleNamespace(data=self.rows)
            return SimpleNamespace(data=[{**self.rows[0], **self.update_data}])
        return SimpleNamespace(data=[{"id": self.eq_args[1], **self.update_data}])


@pytest.fixture
def fake_admin():
    """Substitueix get_admin_client per un doble i el retorna per inspeccionar-lo.

    Yields:
        Funció install(rows=None, error=None). Sense rows, el doble retorna la
        fila amb les dades rebudes, com faria PostgREST.
    """

    def install(rows=None, error=None):
        admin = FakeAdminClient(rows, error)
        main.app.dependency_overrides[deps.get_admin_client] = lambda: admin
        return admin

    yield install
    main.app.dependency_overrides.clear()


class FakePinsClient:
    """Doble de la taula profile_pins amb el client d'administració.

    Imita table().select().eq().execute(), table().upsert().execute() i
    rpc("register_pin_attempt", params).execute(). Guarda el hash de l'usuari
    (o cap), el comptador d'intents i el bloqueig, i hi aplica l'upsert i la
    funció SQL com faria Postgres
    (supabase/migrations/20261127140000_profile_pins_attempts.sql).
    """

    MAX_ATTEMPTS = 3
    LOCK_SECONDS = 15 * 60

    def __init__(
        self,
        pin_hash=None,
        error=None,
        upsert_error=None,
        failed_attempts=0,
        locked_until=None,
        rpc_error=None,
    ):
        self.pin_hash = pin_hash
        self.error = error
        self.upsert_error = upsert_error
        self.failed_attempts = failed_attempts
        self.locked_until = locked_until
        self.rpc_error = rpc_error
        self.eq_args = []
        self.upserted = None
        self.on_conflict = None
        self.attempts = []
        self._pending_upsert = None
        self._pending_rpc = None

    def table(self, name):
        assert name == "profile_pins"
        self._pending_rpc = None
        return self

    def select(self, *columns):
        self._pending_upsert = None
        return self

    def eq(self, column, value):
        self.eq_args.append((column, value))
        return self

    def upsert(self, data, on_conflict=""):
        self._pending_upsert = data
        self.on_conflict = on_conflict
        return self

    def rpc(self, name, params):
        assert name == "register_pin_attempt"
        self._pending_rpc = params
        return self

    def _register_attempt(self, params):
        """Mateixa lògica que la funció SQL register_pin_attempt."""
        self.attempts.append(params)
        if self.rpc_error is not None:
            raise self.rpc_error
        now = datetime.now(UTC)
        if self.locked_until is not None and self.locked_until > now:
            seconds = math.ceil((self.locked_until - now).total_seconds())
            return {"remaining_attempts": 0, "retry_after_seconds": seconds}
        if self.locked_until is not None:
            self.failed_attempts = 0
            self.locked_until = None
        if params["p_success"]:
            self.failed_attempts = 0
        else:
            self.failed_attempts += 1
            if self.failed_attempts >= self.MAX_ATTEMPTS:
                self.locked_until = now + timedelta(seconds=self.LOCK_SECONDS)
        return {
            "remaining_attempts": max(self.MAX_ATTEMPTS - self.failed_attempts, 0),
            "retry_after_seconds": self.LOCK_SECONDS if self.locked_until else None,
        }

    def execute(self):
        if self._pending_rpc is not None:
            params, self._pending_rpc = self._pending_rpc, None
            return SimpleNamespace(data=self._register_attempt(params))
        if self.error is not None:
            raise self.error
        if self._pending_upsert is not None:
            if self.upsert_error is not None:
                raise self.upsert_error
            self.upserted = self._pending_upsert
            self.pin_hash = self.upserted["pin_hash"]
            self._pending_upsert = None
            return SimpleNamespace(data=[self.upserted])
        if not self.pin_hash:
            return SimpleNamespace(data=[])
        locked_until = self.locked_until.isoformat() if self.locked_until else None
        return SimpleNamespace(
            data=[{"pin_hash": self.pin_hash, "locked_until": locked_until}]
        )


@pytest.fixture
def fake_pins():
    """Substitueix get_admin_client per un doble de profile_pins.

    Yields:
        Funció install(pin_hash=None, error=None, upsert_error=None, ...) que
        retorna el doble per inspeccionar què s'ha llegit i desat. També
        accepta ``failed_attempts``, ``locked_until`` (datetime) i
        ``rpc_error`` per preparar el comptador d'intents.
    """

    def install(pin_hash=None, error=None, upsert_error=None, **attempts):
        pins = FakePinsClient(pin_hash, error, upsert_error, **attempts)
        main.app.dependency_overrides[deps.get_admin_client] = lambda: pins
        return pins

    yield install
    main.app.dependency_overrides.clear()
