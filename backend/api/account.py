from fastapi import APIRouter, Depends, HTTPException
from supabase import Client, PostgrestAPIError

from .deps import get_user_client, require_verified_user

router = APIRouter()


@router.get("/balance")
def get_balance(
    user=Depends(require_verified_user),
    db: Client = Depends(get_user_client),
):
    """Retorna el saldo simulat del compte virtual de l'usuari verificat (US2.4)."""
    try:
        response = (
            db.table("accounts")
            .select("balance, currency, updated_at")
            .eq("user_id", user["sub"])
            .execute()
        )
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el saldo"
        ) from e
    if not response.data:
        raise HTTPException(status_code=404, detail="Compte no trobat")
    return response.data[0]
