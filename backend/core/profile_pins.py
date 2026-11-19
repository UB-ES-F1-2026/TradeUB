"""Lectura i escriptura del hash del PIN a la taula privada profile_pins.

La taula té el RLS actiu sense cap política
(``supabase/migrations/20261114130000_profile_pins.sql``): només s'hi pot
accedir amb el client d'administració. Per això sempre es filtra per
l'identificador de l'usuari del token, mai per un valor de la petició.
"""

from datetime import UTC, datetime

from supabase import Client

PINS_TABLE = "profile_pins"


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
    if not user_id:
        raise ValueError("Cal l'identificador de l'usuari del token")

    response = (
        admin_client.table(PINS_TABLE)
        .select("pin_hash")
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0]["pin_hash"] if response.data else None


def save_pin_hash(admin_client: Client, user_id: str, pin_hash: str) -> None:
    """Crea o substitueix el hash del PIN de l'usuari autenticat.

    ``user_id`` és la clau primària, així que l'upsert insereix la fila el
    primer cop i la sobreescriu quan l'usuari canvia el PIN.

    Raises:
        ValueError: si ``user_id`` és buit.
        PostgrestAPIError: si PostgREST rebutja l'escriptura.
    """
    if not user_id:
        raise ValueError("Cal l'identificador de l'usuari del token")

    admin_client.table(PINS_TABLE).upsert(
        {
            "user_id": user_id,
            "pin_hash": pin_hash,
            # El default de la columna només s'aplica a l'insert, no al canvi
            "updated_at": datetime.now(UTC).isoformat(),
        },
        on_conflict="user_id",
    ).execute()
