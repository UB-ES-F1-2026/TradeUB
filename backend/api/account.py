from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from supabase import Client, PostgrestAPIError

from core.cash_movements import DEPOSIT, process_cash_movement

from .deps import get_admin_client, get_user_client, require_verified_user

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


MOVEMENTS_PAGE_SIZE = 20


def movement_concept(row: dict) -> str:
    """Concepte de l'historial (US3.5), generat al servidor i no desat.

    La retirada mostra l'IBAN emmascarat que #116 desa al moviment, perquè el
    concepte no canviï si l'usuari canvia d'IBAN més endavant.
    """
    if row["type"] == "ingres":
        return "Ingrés de diners"
    if row["type"] == "retirada":
        iban = row.get("iban_masked")
        return f"Retirada a ES•• {iban[-4:]}" if iban else "Retirada de diners"
    # Compra i venda: les afegiran US6.1 i US6.2
    return "Moviment d'efectiu"


@router.get("/movements")
def list_movements(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    movement_type: Literal["ingres", "retirada"] | None = Query(None, alias="type"),
    limit: int = Query(MOVEMENTS_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(require_verified_user),
    db: Client = Depends(get_user_client),
):
    """Historial de moviments d'efectiu de l'usuari verificat (US3.5).

    Del més nou al més antic. ``from`` i ``to`` són dates incloses i es poden
    combinar amb ``type``.

    Returns:
        ``{"movements": [...], "has_more": bool}``. Cada moviment té
        ``created_at``, ``concept``, ``amount``, ``type`` i ``balance_after``.

    Raises:
        HTTPException: 422 si ``from`` és posterior a ``to``, 403 si l'usuari
            no està verificat i 500 si no es pot llegir l'historial.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=422,
            detail="La data d'inici no pot ser posterior a la data de fi.",
        )

    # select("*") i no les columnes: iban_masked l'afegeix #116 i, mentre no
    # existeixi, demanar-la faria fallar la consulta.
    query = db.table("cash_movements").select("*").eq("user_id", user["sub"])
    # shortcut: les dates es tallen a mitjanit UTC, no a l'hora de Madrid;
    # un moviment entre les 00:00 i la 01:00/02:00 local cau al dia anterior.
    if date_from:
        query = query.gte(
            "created_at", datetime.combine(date_from, time(tzinfo=UTC)).isoformat()
        )
    if date_to:
        # time.max i no el dia següent: amb 9999-12-31 sumar un dia desborda
        end_of_day = datetime.combine(date_to, time.max, tzinfo=UTC)
        query = query.lte("created_at", end_of_day.isoformat())
    if movement_type:
        query = query.eq("type", movement_type)

    try:
        # Es demana una fila de més per saber si hi ha pàgina següent.
        response = (
            query.order("created_at", desc=True)
            # Desempat perquè dues files amb la mateixa data no canviïn de pàgina
            .order("id", desc=True)
            .range(offset, offset + limit)
            .execute()
        )
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar l'historial"
        ) from e

    rows = response.data
    return {
        "movements": [
            {
                "created_at": row["created_at"],
                "concept": movement_concept(row),
                "amount": row["amount"],
                "type": row["type"],
                "balance_after": row["balance_after"],
            }
            for row in rows[:limit]
        ],
        "has_more": len(rows) > limit,
    }
