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

from .deps import get_admin_client, require_pin

router = APIRouter()

INSUFFICIENT_BALANCE_ERROR = "No tens saldo suficient per fer aquesta compra."
ASSET_NOT_FOUND_ERROR = "Actiu no trobat"
INVALID_UNITS_ERROR = "Les unitats han de ser un nombre enter positiu."
BUY_ERROR = "No s'ha pogut processar la compra. El teu saldo no ha canviat."
INSUFFICIENT_UNITS_ERROR = "No tens prou unitats d'aquest actiu per vendre."
SELL_ERROR = "No s'ha pogut processar la venda. El teu saldo no ha canviat."


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
        ``balance``, ``units`` i ``avg_price`` després de la compra, i el
        ``cost``, la ``commission`` i el ``total`` cobrat.

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
        ``balance``, ``units`` (0 si s'ha venut tot) i ``avg_price`` després
        de la venda, i l'``amount`` brut, la ``commission`` i l'import ``net``
        ingressat.

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
