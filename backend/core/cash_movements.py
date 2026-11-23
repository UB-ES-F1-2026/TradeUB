"""Moviments d'efectiu del compte virtual (US3.2, US3.3).

Totes les operacions amb diners ficticis passen per la funció de Postgres
``process_cash_movement`` (supabase/migrations/20261119180000_cash_movements_iban_masked.sql),
que bloqueja la fila d'``accounts``, actualitza el saldo i registra el
moviment en una sola transacció. Si falla, no es desa cap canvi.
"""

from decimal import Decimal

from supabase import Client

DEPOSIT = "ingres"
WITHDRAWAL = "retirada"
# Els registren buy_asset (US6.1) i sell_asset (US6.2) des de Postgres
BUY = "compra"
SELL = "venda"

# Codi d'error de process_cash_movement quan el saldo quedaria negatiu
INSUFFICIENT_BALANCE_CODE = "P0003"


def process_cash_movement(
    admin_client: Client,
    user_id: str,
    movement_type: str,
    amount: Decimal,
    iban_masked: str | None = None,
) -> Decimal:
    """Aplica un moviment al compte de l'usuari i en retorna el saldo nou.

    Args:
        admin_client: client de Supabase amb la clau secreta (la funció només
            la pot executar ``service_role``).
        user_id: claim ``sub`` del token validat, mai un valor de la petició.
        movement_type: ``ingres``, ``retirada``, ``compra`` o ``venda``.
        amount: import amb signe (positiu per a ingressos i vendes).
        iban_masked: IBAN emmascarat de destinació. Obligatori a les
            retirades; mai l'IBAN sencer.

    Returns:
        El saldo del compte després del moviment.

    Raises:
        PostgrestAPIError: si la funció rebutja el moviment (per exemple amb
            ``INSUFFICIENT_BALANCE_CODE``) o falla la base de dades. En aquest
            cas el saldo no canvia.
    """
    # L'import viatja com a text perquè Postgres el llegeixi com a numeric
    # exacte, sense passar per un float.
    params = {"p_user_id": user_id, "p_type": movement_type, "p_amount": str(amount)}
    if iban_masked is not None:
        params["p_iban_masked"] = iban_masked
    response = admin_client.rpc("process_cash_movement", params).execute()
    return Decimal(str(response.data))


def get_account_balance(admin_client: Client, user_id: str) -> Decimal | None:
    """Llegeix el saldo actual del compte de l'usuari.

    Returns:
        El saldo, o None si l'usuari no té compte.

    Raises:
        PostgrestAPIError: si PostgREST rebutja la consulta.
    """
    response = (
        admin_client.table("accounts")
        .select("balance")
        .eq("user_id", user_id)
        .execute()
    )
    return Decimal(str(response.data[0]["balance"])) if response.data else None
