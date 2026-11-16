import re

from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client, PostgrestAPIError

from .deps import get_current_user, get_user_client

router = APIRouter()

ASSET_COLUMNS = "name, ticker, type, close_price_eur, daily_change_pct, price_date"


@router.get("")
def search_assets(
    q: str = Query(default=""),
    _user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_client),
):
    """Cerca actius simulats pel nom, ticker o ISIN."""
    # Conservem només caràcters segurs (lletres, números, espais, guions, punts i &)
    # per evitar trencar la sintaxi de .or_() o injectar comodins (% o _).
    query = re.sub(r"[^\w\s.&-]", "", q, flags=re.UNICODE).strip()

    try:
        assets_query = db.table("assets").select(ASSET_COLUMNS)
        if len(query) >= 2:
            pattern = f"%{query}%"
            assets_query = assets_query.or_(
                f"name.ilike.{pattern},ticker.ilike.{pattern},isin.ilike.{query}"
            )
        response = assets_query.order("name").execute()
    except PostgrestAPIError as e:
        raise HTTPException(
            status_code=500, detail="No s'ha pogut recuperar el catàleg d'actius"
        ) from e

    return response.data