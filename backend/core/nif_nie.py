"""Validació del NIF/NIE espanyol.

És la validació definitiva: la del formulari (``frontend/src/utils/nifNie.js``)
només és un avís previ i es pot saltar. Totes dues han d'acceptar i rebutjar
els mateixos valors, i fan servir el mateix missatge d'error.
"""

import re

NIF_NIE_ERROR = "El format del NIF/NIE no és vàlid."

# El residu de (número % 23) indexa aquesta cadena
CONTROL_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"

# El NIE substitueix la lletra inicial per un dígit abans de calcular la lletra
NIE_PREFIX_DIGIT = {"X": "0", "Y": "1", "Z": "2"}

# [0-9] i no \d: en Python \d també accepta xifres Unicode (per exemple les
# àrabs), que int() converteix sense queixar-se però la base de dades rebutja.
_NIF_PATTERN = re.compile(r"([0-9]{8})([A-Z])")
_NIE_PATTERN = re.compile(r"([XYZ])([0-9]{7})([A-Z])")


def normalize_nif_nie(value: str) -> str:
    """Treu els espais dels extrems i passa el document a majúscules."""
    return value.strip().upper()


def is_valid_nif_nie(value: str) -> bool:
    """Comprova el format i la lletra de control d'un NIF o d'un NIE.

    Args:
        value: document tal com l'ha escrit l'usuari. Es normalitza abans.

    Returns:
        True si és un NIF (8 xifres + lletra) o un NIE (X/Y/Z + 7 xifres +
        lletra) amb la lletra de control correcta.
    """
    normalized = normalize_nif_nie(value)

    # fullmatch i no match amb ^...$: el $ de Python accepta un salt de línia final
    if nif := _NIF_PATTERN.fullmatch(normalized):
        number, letter = nif.groups()
        return CONTROL_LETTERS[int(number) % 23] == letter

    if nie := _NIE_PATTERN.fullmatch(normalized):
        prefix, digits, letter = nie.groups()
        number = int(NIE_PREFIX_DIGIT[prefix] + digits)
        return CONTROL_LETTERS[number % 23] == letter

    return False
