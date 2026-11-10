"""Verificació simulada del DNI i acceptació dels termes (US2.4).

No hi ha cap temporitzador al servidor: l'estat es calcula cada cop a partir
del moment en què l'usuari ha enviat el document (columna ``dni_enviat_at``).
Durant els ``REVIEW_SECONDS`` posteriors està en revisió i després verificat.

Les columnes són les de
``supabase/migrations/20261109130000_profiles_identity_verification.sql``.
"""

from datetime import UTC, datetime, timedelta

STATUS_PENDING = "pendent"
STATUS_IN_REVIEW = "en-revisio"
STATUS_VERIFIED = "verificat"

REVIEW_SECONDS = 15

# Versió vigent dels termes i condicions. Si canvia, els usuaris que havien
# acceptat una versió anterior les han de tornar a acceptar.
TERMS_VERSION = "2026-11"


def _parse_timestamp(value) -> datetime | None:
    """Converteix el timestamptz que retorna PostgREST en un datetime amb zona."""
    if not value:
        return None
    if isinstance(value, datetime):
        moment = value
    else:
        try:
            moment = datetime.fromisoformat(str(value))
        except ValueError:
            return None
    # Un valor sense zona horària es tracta com a UTC
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def get_identity_status(profile: dict, now: datetime | None = None) -> str:
    """Estat de la verificació del DNI a partir del moment de l'enviament.

    Args:
        profile: fila de l'usuari a profiles, o un diccionari buit.
        now: moment de referència (per defecte, l'hora actual en UTC).

    Returns:
        ``pendent`` si no s'ha enviat cap document, ``en-revisio`` durant els
        ``REVIEW_SECONDS`` posteriors a l'enviament i ``verificat`` després.
    """
    sent_at = _parse_timestamp(profile.get("dni_enviat_at"))
    if sent_at is None:
        return STATUS_PENDING
    now = now or datetime.now(UTC)
    if now < sent_at + timedelta(seconds=REVIEW_SECONDS):
        return STATUS_IN_REVIEW
    return STATUS_VERIFIED


def is_identity_verified(profile: dict, now: datetime | None = None) -> bool:
    """Indica si la identitat de l'usuari ja consta com a verificada."""
    return get_identity_status(profile, now) == STATUS_VERIFIED


def has_accepted_current_terms(profile: dict) -> bool:
    """Indica si l'usuari ha acceptat la versió vigent dels termes."""
    return (
        profile.get("termes_versio") == TERMS_VERSION
        and bool(profile.get("termes_acceptats_at"))
    )


def is_fully_verified(profile: dict, now: datetime | None = None) -> bool:
    """Identitat verificada i termes vigents acceptats: l'usuari pot operar."""
    return is_identity_verified(profile, now) and has_accepted_current_terms(profile)


def get_verification_status(profile: dict, now: datetime | None = None) -> dict:
    """Estat de la verificació tal com el retorna l'API.

    Args:
        profile: fila de l'usuari a profiles, o un diccionari buit.
        now: moment de referència (per defecte, l'hora actual en UTC).

    Returns:
        Diccionari amb l'estat del DNI, el moment de l'enviament, la versió
        dels termes acceptada (i quan), la versió vigent i si l'usuari ha
        acceptat la versió vigent.
    """
    return {
        "estat": get_identity_status(profile, now),
        "document_enviat_at": profile.get("dni_enviat_at"),
        "termes_versio": profile.get("termes_versio"),
        "termes_acceptats_at": profile.get("termes_acceptats_at"),
        "termes_versio_vigent": TERMS_VERSION,
        "termes_acceptats": has_accepted_current_terms(profile),
    }
