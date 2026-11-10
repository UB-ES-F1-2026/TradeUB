"""Escriptura a la taula profiles des del servidor.

L'usuari només pot llegir la seva fila de profiles (vegeu la migració
``supabase/migrations/20261103000000_profiles_read_only.sql``). Totes les
escriptures passen per aquí amb el client d'administració, que salta el RLS,
i per això sempre es filtren per l'identificador de l'usuari del token.
"""

from supabase import Client


def get_own_profile(admin_client: Client, user_id: str) -> dict:
    """Llegeix la fila de profiles de l'usuari autenticat.

    Args:
        admin_client: client de Supabase amb la clau secreta.
        user_id: claim ``sub`` del token validat.

    Returns:
        La fila de l'usuari, o un diccionari buit si no en té.

    Raises:
        ValueError: si ``user_id`` és buit.
        PostgrestAPIError: si PostgREST rebutja la consulta.
    """
    if not user_id:
        raise ValueError("Cal l'identificador de l'usuari del token")

    response = admin_client.table("profiles").select("*").eq("id", user_id).execute()
    return response.data[0] if response.data else {}


def update_own_profile(admin_client: Client, user_id: str, data: dict) -> list[dict]:
    """Actualitza la fila de profiles de l'usuari autenticat.

    Args:
        admin_client: client de Supabase amb la clau secreta.
        user_id: claim ``sub`` del token validat. No ha de sortir mai de la petició.
        data: columnes a actualitzar. No pot incloure ``id``.

    Returns:
        Les files actualitzades (com a molt una).

    Raises:
        ValueError: si ``user_id`` és buit o ``data`` intenta canviar l'``id``.
        PostgrestAPIError: si PostgREST rebutja l'actualització.
    """
    if not user_id:
        raise ValueError("Cal l'identificador de l'usuari del token")
    if "id" in data:
        raise ValueError("No es pot modificar l'identificador del perfil")

    response = admin_client.table("profiles").update(data).eq("id", user_id).execute()
    return response.data
