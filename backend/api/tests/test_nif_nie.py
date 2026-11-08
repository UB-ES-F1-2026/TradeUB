"""Tests de la validació del NIF/NIE (core/nif_nie.py).

Els casos són els mateixos que frontend/src/tests/nifNie.spec.js, perquè el
backend i el formulari han d'acceptar i rebutjar els mateixos documents.
"""

import pytest

from core.nif_nie import NIF_NIE_ERROR, is_valid_nif_nie, normalize_nif_nie


@pytest.mark.parametrize(
    "value",
    ["12345678Z", "X0000000T", "Y1234567X", "  12345678z ", "x0000000t"],
    ids=["nif", "nie-x", "nie-y", "spaces-lowercase", "nie-lowercase"],
)
def test_accepts_valid_documents(value):
    """Accepta NIF i NIE amb la lletra de control correcta, també en minúscules."""
    assert is_valid_nif_nie(value) is True


def test_accepts_nie_with_z_prefix():
    """El prefix Z equival a un 2 davant del número."""
    letter = "TRWAGMYFPDXBNJZSQVHLCKE"[21234567 % 23]

    assert is_valid_nif_nie(f"Z1234567{letter}") is True


@pytest.mark.parametrize(
    "value",
    ["12345678A", "X0000000A"],
    ids=["nif", "nie"],
)
def test_rejects_wrong_control_letter(value):
    """Rebutja un document ben format però amb la lletra de control incorrecta."""
    assert is_valid_nif_nie(value) is False


@pytest.mark.parametrize(
    "value",
    ["1234567Z", "123456789Z", "W1234567L", "X00000000T", "ABC", ""],
    ids=["7-digits", "9-digits", "wrong-prefix", "nie-8-digits", "letters", "empty"],
)
def test_rejects_wrong_format(value):
    """Rebutja els documents amb una llargada, un prefix o uns caràcters incorrectes."""
    assert is_valid_nif_nie(value) is False


def test_rejects_unicode_digits():
    """Les xifres àrabs (١٢٣...) no són vàlides encara que int() les entengui."""
    assert is_valid_nif_nie("١٢٣٤٥٦٧٨Z") is False


def test_rejects_internal_newline():
    """Un salt de línia dins del document no es pot colar."""
    assert is_valid_nif_nie("12345678\nZ") is False


def test_normalize_strips_and_uppercases():
    """El valor que es desa és el normalitzat."""
    assert normalize_nif_nie("  x0000000t ") == "X0000000T"


def test_error_message_matches_frontend():
    """El missatge és el mateix que mostra el formulari."""
    assert NIF_NIE_ERROR == "El format del NIF/NIE no és vàlid."
