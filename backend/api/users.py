from fastapi import APIRouter, Depends, HTTPException
from supabase import Client, PostgrestAPIError

from .deps import get_current_user, get_user_client

router = APIRouter()


@router.get("/me")
def get_user_profile(
    user=Depends(get_current_user),
    db: Client = Depends(get_user_client),
):
    """Aquest endpoint està protegit. Retorna el perfil públic des de la taula profiles."""
    try:
        response = db.table("profiles").select("*").eq("id", user["sub"]).execute()
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el perfil"
        ) from e
    perfil = response.data[0] if response.data else {}
    return {"user": user, "perfil": perfil}
