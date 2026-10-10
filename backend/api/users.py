from core.config import supabase
from fastapi import APIRouter, Depends, HTTPException

from .deps import get_current_user

router = APIRouter()


@router.get("/me")
def get_user_profile(user=Depends(get_current_user)):
    """Aquest endpoint està protegit. Retorna el perfil públic des de la taula profiles."""
    try:
        response = (
            supabase.table("profiles").select("*").eq("id", user["sub"]).execute()
        )
        perfil = response.data[0] if response.data else {}
        return {"user": user, "perfil": perfil}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
