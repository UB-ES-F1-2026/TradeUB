"""Ordres de compra i venda d'actius simulats (US6.1, US6.2, US6.5).

La compra i la venda es fan amb les funcions de Postgres ``buy_asset`` i
``sell_asset``. Les van crear supabase/migrations/20261121130000_buy_asset.sql
i supabase/migrations/20261123120000_sell_asset.sql, i la versió vigent és a
supabase/migrations/20261125120000_orders_create.sql. Calculen l'import i la
comissió amb el preu del catàleg, registren el moviment d'efectiu,
actualitzen la posició i desen l'ordre executada a ``orders`` en una sola
transacció. Si fallen, no es desa cap canvi.
"""

from decimal import Decimal

from supabase import Client

# Codis d'error que llancen buy_asset i sell_asset (o process_cash_movement
# des d'elles)
INVALID_UNITS_CODE = "22023"
INSUFFICIENT_BALANCE_CODE = "P0003"
ASSET_NOT_FOUND_CODE = "P0004"
INSUFFICIENT_UNITS_CODE = "P0005"

BUY_RESULT_FIELDS = ("balance", "units", "avg_price", "cost", "commission", "total")
SELL_RESULT_FIELDS = ("balance", "units", "avg_price", "amount", "commission", "net")


def _run_order(
    admin_client: Client,
    function: str,
    user_id: str,
    asset_id: int,
    units: int,
    fields: tuple[str, ...],
) -> dict[str, Decimal]:
    response = admin_client.rpc(
        function,
        # Les unitats viatgen com a text perquè Postgres les llegeixi com a
        # numeric exacte.
        {"p_user_id": user_id, "p_asset_id": asset_id, "p_units": str(units)},
    ).execute()
    return {field: Decimal(str(response.data[field])) for field in fields}


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
    return _run_order(
        admin_client, "buy_asset", user_id, asset_id, units, BUY_RESULT_FIELDS
    )


def sell_asset(
    admin_client: Client, user_id: str, asset_id: int, units: int
) -> dict[str, Decimal]:
    """Ven unitats d'una posició de l'usuari i en retorna el resultat.

    Args:
        admin_client: client de Supabase amb la clau secreta (la funció només
            la pot executar ``service_role``).
        user_id: claim ``sub`` del token validat, mai un valor de la petició.
        asset_id: identificador de l'actiu a ``assets``.
        units: unitats enteres a vendre.

    Returns:
        Diccionari amb ``balance``, ``units`` (les que queden, 0 si s'ha
        venut tot), ``avg_price``, ``amount``, ``commission`` i ``net`` com a
        ``Decimal``.

    Raises:
        PostgrestAPIError: si la funció rebutja la venda (per exemple amb
            ``INSUFFICIENT_UNITS_CODE``) o falla la base de dades. En aquest
            cas no es desa cap canvi.
    """
    return _run_order(
        admin_client, "sell_asset", user_id, asset_id, units, SELL_RESULT_FIELDS
    )
