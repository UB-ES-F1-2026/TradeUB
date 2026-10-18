"""Endpoints per configurar i verificar autenticació TOTP amb Supabase MFA."""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.config import SUPABASE_KEY, SUPABASE_URL

from .deps import get_access_token

router = APIRouter()
AUTH_URL = f"{SUPABASE_URL}/auth/v1"
INVALID_CODE_MESSAGE = "El codi d'autenticació és incorrecte"


class MfaCode(BaseModel):
    factor_id: str = Field(min_length=1)
    code: str = Field(pattern=r"^\d{6}$")


def _supabase_headers(access_token: str) -> dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def _raise_supabase_error(response: httpx.Response, default_detail: str) -> None:
    if response.is_success:
        return
    try:
        detail = response.json().get("msg") or response.json().get("message")
    except ValueError:
        detail = None
    raise HTTPException(
        status_code=502,
        detail=detail or default_detail,
    )


@router.post("/enroll")
def enroll_totp(access_token: str = Depends(get_access_token)):
    """Crea un factor TOTP i retorna l'URI que el client pot convertir en QR."""
    try:
        response = httpx.post(
            f"{AUTH_URL}/factors",
            headers=_supabase_headers(access_token),
            json={"factor_type": "totp", "friendly_name": "TradeUB"},
            timeout=10.0,
        )
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=503,
            detail="No s'ha pogut connectar amb el servei d'autenticació",
        ) from error

    _raise_supabase_error(response, "No s'ha pogut activar l'autenticació de doble factor")
    data = response.json()
    totp = data.get("totp") or {}
    uri = totp.get("uri")
    if not data.get("id") or not uri:
        raise HTTPException(
            status_code=502,
            detail="La resposta del servei d'autenticació no conté les dades TOTP",
        )
    return {"factor_id": data["id"], "uri": uri, "secret": totp.get("secret")}


@router.post("/verify")
def verify_totp(payload: MfaCode, access_token: str = Depends(get_access_token)):
    """Verifica el codi TOTP i deixa el factor en estat verificat."""
    headers = _supabase_headers(access_token)
    try:
        challenge = httpx.post(
            f"{AUTH_URL}/factors/{payload.factor_id}/challenge",
            headers=headers,
            timeout=10.0,
        )
        _raise_supabase_error(challenge, "No s'ha pogut iniciar la verificació TOTP")
        challenge_id = challenge.json().get("id")
        if not challenge_id:
            raise HTTPException(
                status_code=502,
                detail="La resposta del servei d'autenticació no conté el challenge",
            )

        verification = httpx.post(
            f"{AUTH_URL}/factors/{payload.factor_id}/verify",
            headers=headers,
            json={"challenge_id": challenge_id, "code": payload.code},
            timeout=10.0,
        )
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=503,
            detail="No s'ha pogut connectar amb el servei d'autenticació",
        ) from error

    if not verification.is_success:
        raise HTTPException(status_code=400, detail=INVALID_CODE_MESSAGE)
    return {"verified": True}
