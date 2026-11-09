from fastapi import APIRouter, Depends, HTTPException
from supabase import Client, PostgrestAPIError

from core.onboarding import get_onboarding_status
from core.verification import get_verification_status

from .deps import get_current_user, get_user_client

router = APIRouter()


@router.get("/me")
def get_user_profile(
    user=Depends(get_current_user),
    db: Client = Depends(get_user_client),
):
    """Aquest endpoint està protegit. Retorna el perfil de la taula profiles,
    l'estat de cada pas de l'onboarding i l'estat de la verificació, deduïts
    d'aquest perfil."""
    try:
        response = db.table("profiles").select("*").eq("id", user["sub"]).execute()
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el perfil"
        ) from e
    perfil = response.data[0] if response.data else {}
    return {
        "user": user,
        "perfil": perfil,
        "onboarding": get_onboarding_status(perfil),
        "verificacio": get_verification_status(perfil),
    }
