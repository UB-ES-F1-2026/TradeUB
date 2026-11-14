"""Tests de la validació i l'emmascarament de l'IBAN (core/iban.py)."""

import pytest

from core.iban import is_valid_iban, mask_iban, normalize_iban

VALID_IBAN = "ES9121000418450200051332"


@pytest.mark.parametrize(
    "value",
    [
        VALID_IBAN,
        "ES7921000813610123456789",
        "ES91 2100 0418 4502 0005 1332",
        "es9121000418450200051332",
        "  ES91 2100 0418 4502 0005 1332 ",
    ],
    ids=["iban", "other-iban", "spaces", "lowercase", "outer-spaces"],
)
def test_accepts_valid_spanish_iban(value):
    """Accepta IBAN espanyols correctes, amb espais i en minúscules."""
    assert is_valid_iban(value) is True


def test_rejects_wrong_check_digits():
    """Ben format però amb un dígit canviat: el mod-97 no dona 1."""
    assert is_valid_iban("ES9121000418450200051333") is False


@pytest.mark.parametrize(
    "value",
    [
        "DE89370400440532013000",
        "ES912100041845020005133",
        "ES91210004184502000513321",
        "ES91210004184502000513A2",
        "ES٩١21000418450200051332",
        "",
    ],
    ids=["other-country", "too-short", "too-long", "letter", "arabic-digits", "empty"],
)
def test_rejects_invalid_format(value):
    """Rebutja IBAN d'altres països (encara que siguin correctes) i formats dolents."""
    assert is_valid_iban(value) is False


def test_normalize_removes_spaces_and_uppercases():
    assert normalize_iban(" es91 2100 0418 4502 0005 1332 ") == VALID_IBAN


def test_mask_keeps_country_and_last_four_digits():
    assert mask_iban(VALID_IBAN) == "ES•• •••• •••• •••• •••• 1332"


def test_mask_hides_the_rest_of_the_iban():
    """Cap dígit fora dels 4 últims surt a l'IBAN emmascarat."""
    masked = mask_iban(VALID_IBAN)

    assert sum(char.isdigit() for char in masked) == 4
