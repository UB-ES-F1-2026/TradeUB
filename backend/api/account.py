from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client, PostgrestAPIError

from core.cash_movements import (
    DEPOSIT,
    INSUFFICIENT_BALANCE_CODE,
    WITHDRAWAL,
    get_account_balance,
    process_cash_movement,
)
from core.iban import mask_iban
from core.profiles import IBAN_COLUMN, get_own_profile

from .deps import (
    get_admin_client,
    get_user_client,
    require_pin,
    require_verified_user,
)

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


# Errors de la retirada (US3.3)
MIN_WITHDRAWAL = Decimal(1)
MIN_WITHDRAWAL_ERROR = "L'import mínim de retirada és d'1 €."
NO_IBAN_ERROR = "Cal vincular un IBAN per retirar diners."
INSUFFICIENT_BALANCE_ERROR = "Saldo insuficient. Et falten {missing} € per completar l'operació"
WITHDRAWAL_ERROR = "No s'ha pogut processar la retirada. El teu saldo no ha canviat."


def format_euros(amount: Decimal) -> str:
    """Import amb el format català: punt de milers i coma decimal (1.234,50)."""
    return f"{amount:,.2f}".replace(",", " ").replace(".", ",").replace(" ", ".")


class Withdrawal(BaseModel):
    """Import de la retirada, en euros i amb dos decimals com a màxim.

    Igual que a l'ingrés, més decimals o un valor que no sigui un número
    retornen el 422 de Pydantic, i el mínim es comprova a l'endpoint per
    retornar el missatge exacte. No hi ha màxim: el límit és el saldo.
    """

    amount: Decimal = Field(decimal_places=2)


@router.post("/withdrawals", status_code=status.HTTP_201_CREATED)
def create_withdrawal(
    data: Withdrawal,
    user=Depends(require_pin),
    admin: Client = Depends(get_admin_client),
):
    """Retira diners ficticis cap a l'IBAN vinculat de l'usuari (US3.3).

    Demana el PIN a la capçalera ``X-PIN`` (``require_pin``, que ja exigeix
    l'usuari verificat). El saldo es comprova dins de ``process_cash_movement``,
    amb la fila del compte bloquejada, perquè dues retirades seguides no el
    deixin negatiu. El moviment desa l'IBAN emmascarat del moment.

    Returns:
        ``{"balance": ...}`` amb el saldo després de la retirada.

    Raises:
        HTTPException: 422 si l'import no és vàlid o és inferior al mínim,
            l'usuari no té IBAN vinculat o no té prou saldo; 403 si no està
            verificat o el PIN falta o és incorrecte; i 500 si la base de
            dades no l'ha pogut processar (el saldo no canvia).
    """
    if data.amount < MIN_WITHDRAWAL:
        raise HTTPException(status_code=422, detail=MIN_WITHDRAWAL_ERROR)

    try:
        iban = get_own_profile(admin, user["sub"]).get(IBAN_COLUMN)
    except PostgrestAPIError as e:
        raise HTTPException(status_code=500, detail=WITHDRAWAL_ERROR) from e
    if not iban:
        # El formulari no hi deixa arribar, però el backend ho comprova igualment
        raise HTTPException(status_code=422, detail=NO_IBAN_ERROR)

    try:
        balance = process_cash_movement(
            admin, user["sub"], WITHDRAWAL, -data.amount, mask_iban(iban)
        )
    except PostgrestAPIError as e:
        if e.code != INSUFFICIENT_BALANCE_CODE:
            raise HTTPException(status_code=500, detail=WITHDRAWAL_ERROR) from e
        raise HTTPException(
            status_code=422, detail=_insufficient_balance_message(admin, user, data)
        ) from e
    return {"balance": balance}


def _insufficient_balance_message(admin: Client, user: dict, data: Withdrawal) -> str:
    """Missatge de saldo insuficient amb l'import que falta.

    La funció ja ha rebutjat la retirada; el saldo es torna a llegir només per
    calcular quant falta. Si entremig ha entrat un ingrés i ja no faltaria
    res, es mostra el mínim (0,01 €) en lloc d'un import negatiu.

    Raises:
        HTTPException: 500 si no es pot llegir el saldo.
    """
    try:
        current = get_account_balance(admin, user["sub"])
    except PostgrestAPIError as e:
        raise HTTPException(status_code=500, detail=WITHDRAWAL_ERROR) from e
    if current is None:
        raise HTTPException(status_code=500, detail=WITHDRAWAL_ERROR)
    missing = max(data.amount - current, Decimal("0.01"))
    return INSUFFICIENT_BALANCE_ERROR.format(missing=format_euros(missing))
