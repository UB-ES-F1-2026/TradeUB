from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from supabase import Client, PostgrestAPIError

from core.cash_movements import (
    BUY,
    DEPOSIT,
    INSUFFICIENT_BALANCE_CODE,
    SELL,
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


@router.get("/positions")
def list_positions(
    user=Depends(require_verified_user),
    db: Client = Depends(get_user_client),
):
    """Posicions de l'usuari verificat: actiu i unitats (US6.2).

    La pantalla de venda les fa servir per saber quins actius es poden vendre
    i quantes unitats com a màxim. Es filtra pel ``sub`` del token, i la RLS de
    ``positions`` tampoc deixa llegir les d'un altre usuari.

    Returns:
        Llista de ``{"asset_id", "units"}``. ``units`` és un enter: les
        posicions només admeten unitats enteres (#126). Sense posicions,
        llista buida.

    Raises:
        HTTPException: 403 si l'usuari no està verificat i 500 si no es poden
            llegir les posicions.
    """
    try:
        response = (
            db.table("positions")
            .select("asset_id, units")
            .eq("user_id", user["sub"])
            .execute()
        )
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'han pogut recuperar les posicions"
        ) from e
    # PostgREST retorna el numeric com a número o com a text ("3.00000000")
    return [
        {"asset_id": row["asset_id"], "units": int(Decimal(str(row["units"])))}
        for row in response.data
    ]


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


MOVEMENTS_PAGE_SIZE = 20
MOVEMENTS_COLUMNS = "*, orders(id, units, assets(ticker))"


def movement_order(row: dict) -> dict | None:
    """Ordre de compra o venda (US6.5) enllaçada al moviment, si en té.

    ``cash_movement_id`` és únic a ``orders``, així que PostgREST retorna
    l'embed com un objecte o null. Si mai arribés com a llista, se'n pren la
    primera fila.
    """
    order = row.get("orders")
    if isinstance(order, list):
        return order[0] if order else None
    return order


def format_units(units) -> str:
    """Unitats sense zeros sobrants i amb coma decimal ("3", "2,5")."""
    return f"{Decimal(str(units)).normalize():f}".replace(".", ",")


def movement_concept(row: dict) -> str:
    """Concepte de l'historial (US3.5), generat al servidor i no desat.

    La retirada mostra l'IBAN emmascarat que #116 desa al moviment, perquè el
    concepte no canviï si l'usuari canvia d'IBAN més endavant. La compra i la
    venda amb ordre (US6.5) mostren les unitats i el ticker de l'actiu; les
    anteriors a US6.5 no tenen ordre i mantenen el concepte genèric.
    """
    if row["type"] == DEPOSIT:
        return "Ingrés de diners"
    if row["type"] == WITHDRAWAL:
        iban = row.get("iban_masked")
        return f"Retirada a ES•• {iban[-4:]}" if iban else "Retirada de diners"
    if row["type"] in (BUY, SELL):
        order = movement_order(row)
        label = "Compra" if row["type"] == BUY else "Venda"
        if order:
            ticker = order["assets"]["ticker"]
            return f"{label} de {format_units(order['units'])} {ticker}"
        return f"{label} d'actius"
    return "Moviment d'efectiu"


@router.get("/movements")
def list_movements(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    movement_type: Literal["ingres", "retirada", "compra", "venda"] | None = Query(
        None, alias="type"
    ),
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
        ``id``, ``created_at``, ``concept``, ``amount``, ``type``,
        ``balance_after`` i ``order_id`` (null si no és d'una compra o venda
        amb ordre).

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
    # existeixi, demanar-la faria fallar la consulta. L'ordre de cada moviment
    # (US6.5) arriba amb un embed per la FK cash_movement_id, sense una
    # consulta per fila.
    query = (
        db.table("cash_movements")
        .select(MOVEMENTS_COLUMNS)
        .eq("user_id", user["sub"])
    )
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
                "id": row["id"],
                "created_at": row["created_at"],
                "concept": movement_concept(row),
                "amount": row["amount"],
                "type": row["type"],
                "balance_after": row["balance_after"],
                "order_id": (movement_order(row) or {}).get("id"),
            }
            for row in rows[:limit]
        ],
        "has_more": len(rows) > limit,
    }
