import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()

# Comprovar variables d'entorn obligatories
required_env = ("SUPABASE_URL", "SUPABASE_KEY", "SUPABASE_SECRET_KEY")

missing_env = [var for var in required_env if not os.getenv(var)]

if missing_env:
    raise RuntimeError(
        f"Falten variables d'entorn: {', '.join(missing_env)}. Comprovar .env.example"
    )

# Eliminar el possible / final de la URL
SUPABASE_URL = os.getenv("SUPABASE_URL").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
# Clau secreta: salta el RLS. Només per al servidor, mai al frontend.
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

# Validar la URL de Supabase
parsed_url = urlparse(SUPABASE_URL)
if (
    parsed_url.scheme not in ("http", "https")
    or not parsed_url.netloc
    or parsed_url.path
):
    raise RuntimeError("SUPABASE_URL no és una URL vàlida, comprovar .env.example")


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def create_user_client(access_token: str) -> Client:
    """Crea un client de Supabase que actua en nom de l'usuari del token.

    Aquest client envia el JWT del usuari per tal que el RLS funcioni correctament.

    Args:
        access_token: JWT de l'usuari autenticat.

    Returns:
        Client de Supabase amb el JWT de l'usuari.
    """
    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"},
            auto_refresh_token=False,
            persist_session=False,
        ),
    )


def create_admin_client() -> Client:
    """Crea un client de Supabase amb la clau secreta del projecte.

    Aquest client salta el RLS, així que només l'ha de fer servir el servidor
    i sempre a través de ``core.profiles`` perquè escrigui a la fila de
    l'usuari del token.

    Returns:
        Client de Supabase amb permisos d'administració.
    """
    return create_client(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY,
        options=ClientOptions(auto_refresh_token=False, persist_session=False),
    )
