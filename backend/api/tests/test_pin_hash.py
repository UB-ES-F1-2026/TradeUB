"""Tests del format, el hash i la verificació del PIN (core/pin.py)."""

import pytest

from core.pin import PIN_FORMAT_ERROR, hash_pin, is_valid_pin, verify_pin


@pytest.mark.parametrize("pin", ["0000", "1234", "9876"])
def test_accepts_four_digits(pin):
    assert is_valid_pin(pin) is True


@pytest.mark.parametrize(
    "pin",
    ["123", "12345", "12a4", " 1234", "1234 ", "", "١٢٣٤", 1234, None],
    ids=[
        "three-digits",
        "five-digits",
        "letter",
        "leading-space",
        "trailing-space",
        "empty",
        "arabic-digits",
        "int",
        "none",
    ],
)
def test_rejects_invalid_format(pin):
    assert is_valid_pin(pin) is False


def test_hash_does_not_contain_pin_and_stores_parameters():
    """El hash porta l'algorisme i els paràmetres, i no conté el PIN en clar."""
    stored = hash_pin("1234")

    algorithm, n, r, p, salt, key = stored.split("$")
    assert (algorithm, n, r, p) == ("scrypt", "16384", "8", "1")
    assert "1234" not in salt + key


def test_same_pin_gives_different_hashes():
    """Cada hash té una sal nova: dos usuaris amb el mateix PIN no es delaten."""
    assert hash_pin("1234") != hash_pin("1234")


def test_hash_rejects_invalid_pin():
    with pytest.raises(ValueError, match=PIN_FORMAT_ERROR):
        hash_pin("12a4")


def test_verify_accepts_correct_pin():
    assert verify_pin("1234", hash_pin("1234")) is True


@pytest.mark.parametrize("pin", ["4321", "123", "12345", "", None])
def test_verify_rejects_wrong_pin(pin):
    assert verify_pin(pin, hash_pin("1234")) is False


@pytest.mark.parametrize(
    "stored",
    ["", "1234", "bcrypt$16384$8$1$c2Fs$aGFzaA==", "scrypt$x$8$1$c2Fs$aGFzaA==", None],
    ids=["empty", "plain-pin", "other-algorithm", "bad-parameter", "none"],
)
def test_verify_raises_on_malformed_hash(stored):
    """Un hash desat corrupte és un error del servidor, no un PIN incorrecte."""
    with pytest.raises(ValueError):
        verify_pin("1234", stored)
