"""Lectura i escriptura del PIN a la taula privada profile_pins.

La taula té el RLS actiu sense cap política
(``supabase/migrations/20261114130000_profile_pins.sql``): només s'hi pot
accedir amb el client d'administració. Per això sempre es filtra per
l'identificador de l'usuari del token, mai per un valor de la petició.

També porta el comptador d'intents fallits i el bloqueig de 15 minuts
(US1.6, ``supabase/migrations/20261127140000_profile_pins_attempts.sql``),
compartit entre les operacions (``require_pin``) i el canvi de PIN. Només
``check_pin`` el consulta.
"""

import math
from datetime import UTC, datetime

from supabase import Client

from core.pin import verify_pin

PINS_TABLE = "profile_pins"

# Funció SQL que compta l'intent de manera atòmica
REGISTER_ATTEMPT_FUNCTION = "register_pin_attempt"


class PinLockedError(Exception):
    """El PIN està bloquejat per massa intents fallits."""

    def __init__(self, retry_after_seconds: int):
        super().__init__(f"PIN bloquejat durant {retry_after_seconds} s")
        self.retry_after_seconds = retry_after_seconds


class WrongPinError(Exception):
    """El PIN no és correcte i encara queden intents abans del bloqueig."""

    def __init__(self, remaining_attempts: int):
        super().__init__(f"PIN incorrecte, queden {remaining_attempts} intents")
        self.remaining_attempts = remaining_attempts


def _require_user_id(user_id: str) -> None:
    if not user_id:
        raise ValueError("Cal l'identificador de l'usuari del token")


def get_pin_hash(admin_client: Client, user_id: str) -> str | None:
    """Llegeix el hash del PIN de l'usuari autenticat.

    Args:
        admin_client: client de Supabase amb la clau secreta.
        user_id: claim ``sub`` del token validat.

    Returns:
        El hash desat, o None si l'usuari encara no té PIN.

    Raises:
        ValueError: si ``user_id`` és buit.
        PostgrestAPIError: si PostgREST rebutja la consulta.
    """
    record = get_pin_record(admin_client, user_id, columns="pin_hash")
    return record["pin_hash"] if record else None


def get_pin_record(
    admin_client: Client, user_id: str, columns: str = "pin_hash, locked_until"
) -> dict | None:
    """Llegeix la fila de profile_pins de l'usuari autenticat.

    Per defecte porta el hash i el bloqueig, que és el que necessita
    ``check_pin``.

    Returns:
        La fila amb les columnes demanades, o None si l'usuari no té PIN.

    Raises:
        ValueError: si ``user_id`` és buit.
        PostgrestAPIError: si PostgREST rebutja la consulta.
    """
    _require_user_id(user_id)

    response = (
        admin_client.table(PINS_TABLE)
        .select(columns)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None


def save_pin_hash(admin_client: Client, user_id: str, pin_hash: str) -> None:
    """Crea o substitueix el hash del PIN de l'usuari autenticat.

    ``user_id`` és la clau primària, així que l'upsert insereix la fila el
    primer cop i la sobreescriu quan l'usuari canvia el PIN. No toca el
    comptador d'intents: el canvi només arriba aquí després d'un encert, que
    ja l'ha tornat a 0.

    Raises:
        ValueError: si ``user_id`` és buit.
        PostgrestAPIError: si PostgREST rebutja l'escriptura.
    """
    _require_user_id(user_id)

    admin_client.table(PINS_TABLE).upsert(
        {
            "user_id": user_id,
            "pin_hash": pin_hash,
            # El default de la columna només s'aplica a l'insert, no al canvi
            "updated_at": datetime.now(UTC).isoformat(),
        },
        on_conflict="user_id",
    ).execute()


def _seconds_until(locked_until: str | None) -> int | None:
    """Segons que falten per acabar el bloqueig, o None si no n'hi ha."""
    if not locked_until:
        return None
    remaining = (datetime.fromisoformat(locked_until) - datetime.now(UTC)).total_seconds()
    return math.ceil(remaining) if remaining > 0 else None


def check_pin(
    admin_client: Client, user_id: str, pin: str | None, record: dict
) -> None:
    """Comprova el PIN tenint en compte el comptador d'intents i el bloqueig.

    És l'única lògica d'intents, per a les operacions i per al canvi de PIN:
    1. Si el PIN està bloquejat, s'atura sense comprovar-lo (C4).
    2. Es comprova el PIN amb el hash.
    3. Es registra l'intent amb la funció SQL, que bloqueja la fila. És qui
       decideix: si mentrestant unes altres peticions han bloquejat el PIN, la
       resposta és el bloqueig encara que el PIN sigui correcte.

    Args:
        admin_client: client de Supabase amb la clau secreta.
        user_id: claim ``sub`` del token validat.
        pin: PIN rebut a la petició (pot faltar).
        record: fila de ``get_pin_record`` de l'usuari, amb el hash.

    Raises:
        PinLockedError: si el PIN està bloquejat o es bloqueja ara.
        WrongPinError: si el PIN no és correcte i encara queden intents.
        ValueError: si el hash desat no és vàlid (error del servidor).
        PostgrestAPIError: si no s'ha pogut registrar l'intent.
    """
    retry_after = _seconds_until(record.get("locked_until"))
    if retry_after is not None:
        raise PinLockedError(retry_after)

    matches = verify_pin(pin, record["pin_hash"])

    _require_user_id(user_id)
    result = (
        admin_client.rpc(
            REGISTER_ATTEMPT_FUNCTION, {"p_user_id": user_id, "p_success": matches}
        )
        .execute()
        .data
    )
    if result["retry_after_seconds"] is not None:
        raise PinLockedError(result["retry_after_seconds"])
    if not matches:
        raise WrongPinError(result["remaining_attempts"])
