"""Moviments d'efectiu del compte virtual (US3.2).

Totes les operacions amb diners ficticis passen per la funció de Postgres
``process_cash_movement`` (supabase/migrations/20261113190000_cash_movements_create.sql),
que bloqueja la fila d'``accounts``, actualitza el saldo i registra el
moviment en una sola transacció. Si falla, no es desa cap canvi.
"""

from decimal import Decimal

from supabase import Client

DEPOSIT = "ingres"


def process_cash_movement(
    admin_client: Client, user_id: str, movement_type: str, amount: Decimal
) -> Decimal:
    """Aplica un moviment al compte de l'usuari i en retorna el saldo nou.

    Args:
        admin_client: client de Supabase amb la clau secreta (la funció només
            la pot executar ``service_role``).
        user_id: claim ``sub`` del token validat, mai un valor de la petició.
        movement_type: ``ingres``, ``retirada``, ``compra`` o ``venda``.
        amount: import amb signe (positiu per a ingressos i vendes).

    Returns:
        El saldo del compte després del moviment.

    Raises:
        PostgrestAPIError: si la funció rebutja el moviment o falla la base
            de dades. En aquest cas el saldo no canvia.
    """
    response = admin_client.rpc(
        "process_cash_movement",
        # L'import viatja com a text perquè Postgres el llegeixi com a numeric
        # exacte, sense passar per un float.
        {"p_user_id": user_id, "p_type": movement_type, "p_amount": str(amount)},
    ).execute()
    return Decimal(str(response.data))
