from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import Client, PostgrestAPIError

from .deps import get_admin_client, get_current_user, get_user_client

router = APIRouter()


class CashMovementRequest(BaseModel):
    """Input for a simulated cash movement."""

    type: Literal["ingres", "retirada", "compra", "venda"]
    amount: Decimal = Field(gt=0)


@router.get("/balance")
def get_balance(
    user=Depends(get_current_user),
    db: Client = Depends(get_user_client),
):
    """Retorna el saldo simulat del compte virtual de l'usuari autenticat."""
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


@router.get("/movements")
def get_cash_movements(
    user=Depends(get_current_user),
    db: Client = Depends(get_user_client),
):
    """Retorna únicament l'historial de l'usuari autenticat."""
    try:
        response = (
            db.table("cash_movements")
            .select("id, user_id, type, amount, balance_after, created_at")
            .eq("user_id", user["sub"])
            .order("created_at", desc=True)
            .execute()
        )
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar l'historial"
        ) from e
    return response.data


@router.post("/movements", status_code=201)
def create_cash_movement(
    movement: CashMovementRequest,
    user=Depends(get_current_user),
    db: Client = Depends(get_admin_client),
):
    """Processa un moviment simulat mitjançant la funció SQL atòmica."""
    debit_types = {"retirada", "compra"}
    signed_amount = (
        -movement.amount if movement.type in debit_types else movement.amount
    )
    try:
        response = db.rpc(
            "process_cash_movement",
            {
                "p_user_id": user["sub"],
                "p_type": movement.type,
                "p_amount": signed_amount,
            },
        ).execute()
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=400, detail="No s'ha pogut processar el moviment"
        ) from e
    return {"type": movement.type, "amount": signed_amount, "balance": response.data}