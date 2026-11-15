from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client, PostgrestAPIError

from core.cash_movements import DEPOSIT, process_cash_movement

from .deps import (
    get_admin_client,
    get_current_user,
    get_user_client,
    require_verified_user,
)

router = APIRouter()


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


# Límits de cada ingrés (US3.2)
MIN_DEPOSIT = Decimal(1)
MAX_DEPOSIT = Decimal(10000)
MIN_DEPOSIT_ERROR = "L'import mínim d'ingrés és d'1 €."
MAX_DEPOSIT_ERROR = "L'import màxim per operació és de 10.000 €."
DEPOSIT_ERROR = "No s'ha pogut processar el dipòsit. El teu saldo no ha canviat."


class Deposit(BaseModel):
    """Import de l'ingrés, en euros i amb dos decimals com a màxim.

    Més decimals, un valor que no sigui un número, infinit o NaN retornen el
    422 de Pydantic: el formulari no deixa escriure'ls. El mínim i el màxim es
    comproven a l'endpoint per retornar el missatge exacte.
    """

    amount: Decimal = Field(decimal_places=2)


@router.post("/deposits", status_code=status.HTTP_201_CREATED)
def create_deposit(
    data: Deposit,
    user=Depends(require_verified_user),
    admin: Client = Depends(get_admin_client),
):
    """Ingressa diners ficticis al compte de l'usuari verificat (US3.2).

    El saldo i el moviment s'actualitzen alhora amb ``process_cash_movement``.
    L'ingrés no demana PIN.

    Returns:
        ``{"balance": ...}`` amb el saldo després de l'ingrés.

    Raises:
        HTTPException: 422 si l'import no és vàlid o està fora dels límits,
            403 si l'usuari no està verificat i 500 si la base de dades no
            l'ha pogut processar (el saldo no canvia).
    """
    if data.amount < MIN_DEPOSIT:
        raise HTTPException(status_code=422, detail=MIN_DEPOSIT_ERROR)
    if data.amount > MAX_DEPOSIT:
        raise HTTPException(status_code=422, detail=MAX_DEPOSIT_ERROR)

    try:
        balance = process_cash_movement(admin, user["sub"], DEPOSIT, data.amount)
    except PostgrestAPIError as e:
        raise HTTPException(status_code=500, detail=DEPOSIT_ERROR) from e
    return {"balance": balance}
