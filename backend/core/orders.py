"""Ordres de compra d'actius simulats (US6.1).

La compra es fa amb la funció de Postgres ``buy_asset``
(supabase/migrations/20261121130000_buy_asset.sql), que calcula el cost i la
comissió amb el preu del catàleg, registra el moviment de compra i actualitza
la posició en una sola transacció. Si falla, no es desa cap canvi.
"""

from decimal import Decimal

from supabase import Client

# Codis d'error que llança buy_asset (o process_cash_movement des d'ella)
INVALID_UNITS_CODE = "22023"
INSUFFICIENT_BALANCE_CODE = "P0003"
ASSET_NOT_FOUND_CODE = "P0004"

BUY_RESULT_FIELDS = ("balance", "units", "avg_price", "cost", "commission", "total")


def buy_asset(
    admin_client: Client, user_id: str, asset_id: int, units: int
) -> dict[str, Decimal]:
    """Compra unitats d'un actiu per a l'usuari i en retorna el resultat.

    Args:
        admin_client: client de Supabase amb la clau secreta (la funció només
            la pot executar ``service_role``).
        user_id: claim ``sub`` del token validat, mai un valor de la petició.
        asset_id: identificador de l'actiu a ``assets``.
        units: unitats enteres a comprar.

    Returns:
        Diccionari amb ``balance``, ``units``, ``avg_price``, ``cost``,
        ``commission`` i ``total`` com a ``Decimal``.

    Raises:
        PostgrestAPIError: si la funció rebutja la compra o falla la base de
            dades. En aquest cas no es desa cap canvi.
    """
    response = admin_client.rpc(
        "buy_asset",
        # Les unitats viatgen com a text perquè Postgres les llegeixi com a
        # numeric exacte.
        {"p_user_id": user_id, "p_asset_id": asset_id, "p_units": str(units)},
    ).execute()
    return {field: Decimal(str(response.data[field])) for field in BUY_RESULT_FIELDS}
