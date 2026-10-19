import os
from urllib.parse import urlparse

from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()

# Comprovar variables d'entorn obligatories
required_env = ("SUPABASE_URL", "SUPABASE_KEY")

missing_env = [var for var in required_env if not os.getenv(var)]

if missing_env:
    raise RuntimeError(
        f"Falten variables d'entorn: {', '.join(missing_env)}. Comprovar .env.example"
    )

# Eliminar el possible / final de la URL
SUPABASE_URL = os.getenv("SUPABASE_URL").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

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
