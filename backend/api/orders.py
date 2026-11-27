from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase import Client, PostgrestAPIError

from core.orders import (
    ASSET_NOT_FOUND_CODE,
    INSUFFICIENT_BALANCE_CODE,
    INSUFFICIENT_UNITS_CODE,
    INVALID_UNITS_CODE,
    buy_asset,
    sell_asset,
)

from .deps import (
    get_admin_client,
    get_user_client,
    require_pin,
    require_verified_user,
)

router = APIRouter()

INSUFFICIENT_BALANCE_ERROR = "No tens saldo suficient per fer aquesta compra."
ASSET_NOT_FOUND_ERROR = "Actiu no trobat"
INVALID_UNITS_ERROR = "Les unitats han de ser un nombre enter positiu."
BUY_ERROR = "No s'ha pogut processar la compra. El teu saldo no ha canviat."
INSUFFICIENT_UNITS_ERROR = "No tens prou unitats d'aquest actiu per vendre."
SELL_ERROR = "No s'ha pogut processar la venda. El teu saldo no ha canviat."
ORDER_NOT_FOUND_ERROR = "Operació no trobada"
ORDER_ERROR = "No s'ha pogut recuperar l'operació"


class BuyOrder(BaseModel):
    """Actiu i unitats de la compra.

    Només s'admeten unitats enteres (#126): un valor decimal com 1.5 o un
    nombre <= 0 retornen el 422 de Pydantic.
    """

    asset_id: int = Field(gt=0)
    units: int = Field(gt=0)


@router.post("/buy", status_code=status.HTTP_201_CREATED)
def create_buy_order(
    data: BuyOrder,
    user=Depends(require_pin),
    admin: Client = Depends(get_admin_client),
):
    """Compra unitats d'un actiu simulat (US6.1).

    Demana el PIN, que ja inclou la comprovació d'usuari verificat. El cost,
    la comissió (el mínim entre l'1% del cost i 1 €), el moviment de compra i
    la posició es calculen i es desen alhora amb ``buy_asset``.

    Returns:
        L'``order_id`` de l'ordre desada i el ``price`` aplicat; ``balance``,
        ``units`` i ``avg_price`` després de la compra, i el ``cost``, la
        ``commission`` i el ``total`` cobrat.

    Raises:
        HTTPException: 403 si falta el PIN o l'usuari no està verificat, 404
            si l'actiu no existeix, 422 si les unitats no són vàlides o no hi
            ha saldo suficient, i 500 si la base de dades no l'ha pogut
            processar (no es desa cap canvi).
    """
    try:
        return buy_asset(admin, user["sub"], data.asset_id, data.units)
    except PostgrestAPIError as e:
        if e.code == INSUFFICIENT_BALANCE_CODE:
            raise HTTPException(
                status_code=422, detail=INSUFFICIENT_BALANCE_ERROR
            ) from e
        if e.code == ASSET_NOT_FOUND_CODE:
            raise HTTPException(status_code=404, detail=ASSET_NOT_FOUND_ERROR) from e
        if e.code == INVALID_UNITS_CODE:
            raise HTTPException(status_code=422, detail=INVALID_UNITS_ERROR) from e
        raise HTTPException(status_code=500, detail=BUY_ERROR) from e


class SellOrder(BaseModel):
    """Actiu i unitats de la venda.

    Només s'admeten unitats enteres (#128): un valor decimal com 1.5 o un
    nombre <= 0 retornen el 422 de Pydantic.
    """

    asset_id: int = Field(gt=0)
    units: int = Field(gt=0)


@router.post("/sell", status_code=status.HTTP_201_CREATED)
def create_sell_order(
    data: SellOrder,
    user=Depends(require_pin),
    admin: Client = Depends(get_admin_client),
):
    """Ven unitats d'una posició (US6.2).

    Demana el PIN, que ja inclou la comprovació d'usuari verificat. L'import,
    la comissió (el mínim entre l'1% de l'import i 1 €), el moviment de venda
    i la posició es calculen i es desen alhora amb ``sell_asset``. Si es venen
    totes les unitats, la posició s'esborra.

    Returns:
        L'``order_id`` de l'ordre desada i el ``price`` aplicat; ``balance``,
        ``units`` (0 si s'ha venut tot) i ``avg_price`` després de la venda,
        i l'``amount`` brut, la ``commission`` i l'import ``net`` ingressat.

    Raises:
        HTTPException: 403 si falta el PIN o l'usuari no està verificat, 404
            si l'actiu no existeix, 422 si les unitats no són vàlides o
            l'usuari no en té prou, i 500 si la base de dades no l'ha pogut
            processar (no es desa cap canvi).
    """
    try:
        return sell_asset(admin, user["sub"], data.asset_id, data.units)
    except PostgrestAPIError as e:
        if e.code == INSUFFICIENT_UNITS_CODE:
            raise HTTPException(
                status_code=422, detail=INSUFFICIENT_UNITS_ERROR
            ) from e
        if e.code == ASSET_NOT_FOUND_CODE:
            raise HTTPException(status_code=404, detail=ASSET_NOT_FOUND_ERROR) from e
        if e.code == INVALID_UNITS_CODE:
            raise HTTPException(status_code=422, detail=INVALID_UNITS_ERROR) from e
        raise HTTPException(status_code=500, detail=SELL_ERROR) from e


# Columnes del detall: l'actiu i el saldo posterior arriben amb embeds de
# PostgREST per les FK asset_id i cash_movement_id, en una sola consulta.
ORDER_DETAIL_COLUMNS = (
    "id, side, status, units, price, amount, commission, total, created_at, "
    "executed_at, assets(id, name, ticker), cash_movements(balance_after)"
)


@router.get("/{order_id}")
def get_order(
    order_id: UUID,
    user=Depends(require_verified_user),
    db: Client = Depends(get_user_client),
):
    """Detall d'una compra o venda de l'usuari verificat (US6.5).

    Es llegeix amb el client de l'usuari perquè s'apliqui la RLS d'``orders``
    i, a més, es filtra pel ``sub`` del token. Tot surt de la fila desada en
    executar l'ordre: no es recalcula res amb el preu actual de l'actiu.

    Returns:
        ``id``, ``side``, ``status``, ``asset`` (``id``, ``name``, ``ticker``),
        ``units``, ``price``, ``amount``, ``commission``, ``total``,
        ``created_at``, ``executed_at`` i ``balance_after`` (el saldo després
        del moviment de l'ordre).

    Raises:
        HTTPException: 422 si l'id no és un UUID, 403 si l'usuari no està
            verificat, 404 si l'ordre no existeix o és d'un altre usuari i 500
            si no es pot llegir.
    """
    try:
        response = (
            db.table("orders")
            .select(ORDER_DETAIL_COLUMNS)
            .eq("id", str(order_id))
            .eq("user_id", user["sub"])
            .execute()
        )
    except PostgrestAPIError as e:
        raise HTTPException(status_code=500, detail=ORDER_ERROR) from e
    if not response.data:
        raise HTTPException(status_code=404, detail=ORDER_NOT_FOUND_ERROR)

    row = response.data[0]
    movement = row.get("cash_movements") or {}
    return {
        "id": row["id"],
        "side": row["side"],
        "status": row["status"],
        "asset": row["assets"],
        "units": row["units"],
        "price": row["price"],
        "amount": row["amount"],
        "commission": row["commission"],
        "total": row["total"],
        "created_at": row["created_at"],
        "executed_at": row["executed_at"],
        "balance_after": movement.get("balance_after"),
    }
