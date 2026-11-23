"""Validació i emmascarament de l'IBAN espanyol (US3.3).

És la validació definitiva de l'IBAN que l'usuari vincula per a les
retirades simulades. Només s'accepten IBAN espanyols: ``ES`` + 22 dígits, amb
els dígits de control correctes (mod-97, ISO 13616).
"""

import re

IBAN_ERROR = "El codi IBAN no és vàlid."

# [0-9] i no \d: en Python \d també accepta xifres Unicode (per exemple les
# àrabs), que int() converteix sense queixar-se però la base de dades rebutja.
_IBAN_PATTERN = re.compile(r"ES[0-9]{22}")

# Caràcters visibles al final de l'IBAN emmascarat
_VISIBLE_DIGITS = 4
_MASK_CHAR = "•"


def normalize_iban(value: str) -> str:
    """Treu tots els espais (també els del mig) i passa l'IBAN a majúscules."""
    return "".join(value.split()).upper()


def is_valid_iban(value: str) -> bool:
    """Comprova el format i els dígits de control d'un IBAN espanyol.

    Args:
        value: IBAN tal com l'ha escrit l'usuari. Es normalitza abans.

    Returns:
        True si és ``ES`` + 22 dígits i el càlcul mod-97 dona 1.
    """
    iban = normalize_iban(value)
    if not _IBAN_PATTERN.fullmatch(iban):
        return False

    # Mod-97: els 4 primers caràcters passen al final i cada lletra es
    # converteix en número (A=10 ... Z=35; per a "ES", E=14 i S=28). Un IBAN
    # és correcte si el número resultant dona residu 1 en dividir-lo per 97.
    rearranged = iban[4:] + iban[:4]
    number = int("".join(str(int(char, 36)) for char in rearranged))
    return number % 97 == 1


def mask_iban(iban: str) -> str:
    """Emmascara l'IBAN deixant visibles el país i els 4 últims dígits.

    Args:
        iban: IBAN desat a profiles, ja normalitzat.

    Returns:
        L'IBAN en grups de 4, per exemple ``ES•• •••• •••• •••• •••• 1332``.
    """
    iban = normalize_iban(iban)
    hidden = len(iban) - 2 - _VISIBLE_DIGITS
    masked = iban[:2] + _MASK_CHAR * hidden + iban[-_VISIBLE_DIGITS:]
    return " ".join(masked[i : i + 4] for i in range(0, len(masked), 4))
