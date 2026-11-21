"""Hash i verificació del PIN de seguretat per a operacions (US1.5).

El PIN mai es desa en clar: es desa el hash ``hashlib.scrypt`` amb una sal
aleatòria per usuari, a la taula privada ``profile_pins``
(``supabase/migrations/20261114130000_profile_pins.sql``).

El hash porta els paràmetres de scrypt a dins, així els PINs desats es poden
continuar verificant encara que algun dia es canviïn els paràmetres.
"""

import base64
import hashlib
import hmac
import os
import re

PIN_FORMAT_ERROR = "El PIN ha de tenir 4 dígits."

# [0-9] i no \d: en Python \d també accepta xifres Unicode (per exemple les
# àrabs), que no són un PIN que l'usuari pugui tornar a escriure.
_PIN_PATTERN = re.compile(r"[0-9]{4}")

# Paràmetres de scrypt: cost (n), mida de bloc (r) i paral·lelisme (p).
# Amb n=2**14 i r=8 el càlcul fa servir uns 16 MB i tarda unes desenes de ms.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_KEY_BYTES = 32

_ALGORITHM = "scrypt"


def is_valid_pin(pin: object) -> bool:
    """Comprova que el PIN sigui exactament 4 dígits del 0 al 9."""
    return isinstance(pin, str) and _PIN_PATTERN.fullmatch(pin) is not None


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _scrypt(pin: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(pin.encode(), salt=salt, n=n, r=r, p=p, dklen=_KEY_BYTES)


def hash_pin(pin: str) -> str:
    """Calcula el hash d'un PIN amb una sal aleatòria nova.

    Args:
        pin: PIN de 4 dígits ja validat amb ``is_valid_pin``.

    Returns:
        Text ``scrypt$n$r$p$sal$hash`` (sal i hash en base64), per desar a
        ``profile_pins.pin_hash``.

    Raises:
        ValueError: si el PIN no té el format vàlid.
    """
    if not is_valid_pin(pin):
        raise ValueError(PIN_FORMAT_ERROR)

    salt = os.urandom(_SALT_BYTES)
    key = _scrypt(pin, salt, _SCRYPT_N, _SCRYPT_R, _SCRYPT_P)
    return "$".join(
        [_ALGORITHM, str(_SCRYPT_N), str(_SCRYPT_R), str(_SCRYPT_P), _b64(salt), _b64(key)]
    )


def verify_pin(pin: str, stored_hash: str) -> bool:
    """Comprova si un PIN coincideix amb el hash desat.

    Un PIN amb format incorrecte no coincideix mai i no es calcula el hash.

    Args:
        pin: PIN rebut a la petició.
        stored_hash: valor de ``profile_pins.pin_hash``.

    Returns:
        True si el PIN és el correcte.

    Raises:
        ValueError: si el hash desat no té el format esperat. És un error del
            servidor, no del PIN, i no s'ha de presentar com a PIN incorrecte.
    """
    try:
        algorithm, n, r, p, salt, key = stored_hash.split("$")
        if algorithm != _ALGORITHM:
            raise ValueError
        n, r, p = int(n), int(r), int(p)
        salt = base64.b64decode(salt, validate=True)
        key = base64.b64decode(key, validate=True)
    except (AttributeError, ValueError) as e:
        raise ValueError("El hash del PIN desat no és vàlid") from e

    if not is_valid_pin(pin):
        return False

    # compare_digest triga el mateix encara que els bytes difereixin al
    # principi, i així el temps de resposta no dona pistes del hash
    return hmac.compare_digest(_scrypt(pin, salt, n, r, p), key)
