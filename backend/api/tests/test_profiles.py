"""Tests de l'escriptura a profiles amb el client d'administració."""

from types import SimpleNamespace

import pytest

from api import deps
from core import config
from core.profiles import update_own_profile

SUBJECT = "11111111-2222-3333-4444-555555555555"


class FakeAdminClient:
    """Doble encadenable de table().update().eq().execute()."""

    def __init__(self):
        self.table_name = None
        self.update_data = None
        self.eq_args = None

    def table(self, name):
        self.table_name = name
        return self

    def update(self, data):
        self.update_data = data
        return self

    def eq(self, column, value):
        self.eq_args = (column, value)
        return self

    def execute(self):
        return SimpleNamespace(data=[{"id": self.eq_args[1], **self.update_data}])


def test_update_own_profile_filters_by_token_user():
    """L'actualització es limita a la fila de l'usuari del token."""
    admin = FakeAdminClient()

    rows = update_own_profile(admin, SUBJECT, {"username": "ivan"})

    assert admin.table_name == "profiles"
    assert admin.update_data == {"username": "ivan"}
    assert admin.eq_args == ("id", SUBJECT)
    assert rows == [{"id": SUBJECT, "username": "ivan"}]


@pytest.mark.parametrize("user_id", ["", None])
def test_update_own_profile_requires_user_id(user_id):
    """Sense identificador no s'escriu res, per no actualitzar files d'altres."""
    admin = FakeAdminClient()

    with pytest.raises(ValueError):
        update_own_profile(admin, user_id, {"username": "ivan"})

    assert admin.table_name is None


def test_update_own_profile_rejects_id_change():
    """No es pot reassignar la fila a un altre usuari canviant-ne l'id."""
    admin = FakeAdminClient()

    with pytest.raises(ValueError):
        update_own_profile(admin, SUBJECT, {"id": "un-altre-usuari"})

    assert admin.table_name is None


def test_admin_client_uses_secret_key(monkeypatch):
    """El client d'administració es crea amb la clau secreta, no amb la publicable."""
    calls = []
    monkeypatch.setattr(
        config,
        "create_client",
        lambda url, key, options=None: calls.append((url, key)) or object(),
    )

    config.create_admin_client()

    assert calls == [(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY)]
    assert config.SUPABASE_SECRET_KEY != config.SUPABASE_KEY


def test_get_admin_client_reuses_single_client(monkeypatch):
    """La dependència retorna sempre el mateix client d'administració."""
    deps._admin_client.cache_clear()
    sentinel = object()
    monkeypatch.setattr(deps, "create_admin_client", lambda: sentinel)

    try:
        assert deps.get_admin_client({"sub": SUBJECT}) is sentinel
        assert deps.get_admin_client({"sub": SUBJECT}) is sentinel
    finally:
        deps._admin_client.cache_clear()
