from fastapi import APIRouter, Depends, HTTPException, Header
from core.config import supabase

router = APIRouter()


def get_current_user(authorization: str = Header(None)):
    """Valida el token JWT enviat pel Vue i retorna l'usuari de Supabase."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token no proporcionat o invàlid")

    token = authorization.split(" ")[1]
    # Supabase verifica el token i retorna les dades de l'usuari
    user_response = supabase.auth.get_user(token)

    if not user_response.user:
        raise HTTPException(status_code=401, detail="Token expirat o invàlid")

    return user_response.user


@router.get("/me")
def get_user_profile(user=Depends(get_current_user)):
    """Aquest endpoint està protegit. Retorna el perfil públic des de la taula profiles."""
    try:
        response = supabase.table("profiles").select("*").eq("id", user.id).execute()
        perfil = response.data[0] if response.data else {}
        return {"user": user.model_dump(), "perfil": perfil}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))