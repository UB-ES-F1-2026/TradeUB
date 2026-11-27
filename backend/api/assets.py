import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from supabase import Client, PostgrestAPIError

from .deps import get_admin_client

router = APIRouter()

# L'id és el que demana POST /orders/buy per comprar l'actiu triat a la cerca (US6.1).
# El preu i la variació els calcula Postgres a asset_quotes (#191), mai Python, perquè la cerca,
# la compra i la venda donin el mateix preu.
ASSET_COLUMNS = "id, name, ticker, type, price, price_at, daily_change_pct, market_open"


@router.get("")
def search_assets(
    response: Response,
    q: str = Query(default=""),
    db: Client = Depends(get_admin_client),
):
    """Cerca actius simulats pel nom, ticker o ISIN, amb la cotització actual.

    Llegeix la vista ``asset_quotes``, que només pot llegir el backend
    (``service_role``): per això fa servir el client d'administració, que ja
    exigeix un token validat. És el catàleg comú, no dades de l'usuari.

    El frontend hi fa una petició cada segon: una sola consulta per petició i
    sense memòria cau (``Cache-Control: no-store``).

    Returns:
        Llista de ``{"id", "name", "ticker", "type", "price", "price_at",
        "daily_change_pct", "market_open"}`` ordenada pel nom.

    Raises:
        HTTPException: 500 si no es pot llegir la cotització.
    """
    response.headers["Cache-Control"] = "no-store"

    # Conservem només caràcters segurs (lletres, números, espais, guions, punts i &)
    # per evitar trencar la sintaxi de .or_() o injectar comodins (% o _).
    query = re.sub(r"[^\w\s.&-]", "", q, flags=re.UNICODE).strip()

    try:
        assets_query = db.table("asset_quotes").select(ASSET_COLUMNS)
        if len(query) >= 2:
            pattern = f"%{query}%"
            assets_query = assets_query.or_(
                f"name.ilike.{pattern},ticker.ilike.{pattern},isin.ilike.{query}"
            )
        result = assets_query.order("name").execute()
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el catàleg d'actius"
        ) from e

    return result.data
