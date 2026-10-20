"""Dependencies d'autenticació compartides per tots els endpoints protegits.

Valida localment el JWT emès per Supabase Auth verificant-ne la signatura
amb la clau pública publicada al JWKS del projecte (ES256). Els usuaris amb
un factor MFA verificat han d'accedir amb autenticació de nivell aal2.
"""

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError, PyJWKClient, PyJWKClientError
from supabase import Client
from supabase_auth.errors import AuthApiError

from core.config import SUPABASE_URL, create_user_client

security = HTTPBearer()

jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Valida el JWT de la capçalera i retorna els claims del token.

    Verifica la signatura ES256 amb la clau pública del JWKS de Supabase,
    comprova audience, issuer i caducitat. Si l'usuari té un factor MFA
    verificat, també exigeix que la sessió estigui a aal2. El frontend eleva
    la sessió directament amb ``supabase.auth.mfa.challengeAndVerify()``.

    Args:
        credentials: credencials Bearer extretes per HTTPBearer.

    Returns:
        Els claims del token JWT com a diccionari.

    Raises:
        HTTPException:
          401 si el token és invàlid o caducat, 403 si un usuari amb MFA
          activa no té aal2, i 503 si no es pot validar el token o consultar
          els factors MFA.
    """
    token = credentials.credentials
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
        )
    except PyJWKClientError as e:
        raise HTTPException(
            status_code=503, detail="No s'ha pogut validar el token a través del JWKS"
        ) from e
    except ExpiredSignatureError as e:
        raise HTTPException(
            status_code=401,
            detail="Token expirat",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail="Token invàlid",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    if claims.get("aal") != "aal2" and _has_verified_mfa_factor(token):
        raise HTTPException(
            status_code=403,
            detail="Cal completar la verificació en dos passos",
        )

    return claims


def _has_verified_mfa_factor(access_token: str) -> bool:
    """Comprova si l'usuari del token té un factor MFA verificat."""
    try:
        factors = create_user_client(access_token).auth.mfa.list_factors()
    except AuthApiError as e:
        raise HTTPException(
            status_code=503,
            detail="No s'han pogut consultar els factors de verificació",
        ) from e

    return bool(factors.totp)


def get_user_client(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    _claims: dict = Depends(get_current_user),
) -> Client:
    """Retorna un client de Supabase lligat al token validat de la petició.

    Args:
        credentials: credencials Bearer extretes per HTTPBearer.
        _claims: dependencia d'ordre que garanteix que el token s'ha validat.

    Returns:
        Client de Supabase amb el JWT de l'usuari.
    """
    token = credentials.credentials
    return create_user_client(token)
