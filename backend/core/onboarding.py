"""Estat de l'onboarding deduït de la fila de l'usuari a la taula profiles.

Cada pas té una regla que, a partir del perfil, decideix si està completat.
L'ordre de ``ONBOARDING_STEPS`` és l'ordre en què l'usuari els ha de fer i
els identificadors coincideixen amb els del frontend (``stores/onboarding.js``).

Les tasques de backend de US2.2, US2.3 i US2.4 hi afegeixen la regla del seu
pas quan creen les columnes corresponents. Mentre no la tenen, retorna ``False``.
"""

from collections.abc import Callable

from core.investor_profile import INVESTOR_PROFILES

STATUS_PENDING = "pendent"
STATUS_COMPLETED = "completat"

StepRule = Callable[[dict], bool]

# Columnes de profiles del pas de dades personals
# (supabase/migrations/20261108120000_profiles_personal_data.sql)
PERSONAL_DATA_COLUMNS = (
    "nom",
    "cognoms",
    "data_naixement",
    "telefon",
    "nif",
    "carrer",
    "codi_postal",
    "poblacio",
    "residencia_fiscal",
)


def _personal_data_completed(profile: dict) -> bool:
    """US2.2: completat quan totes les columnes de dades personals tenen valor.

    Una columna sense valor és NULL (o no hi és, si no hi ha fila) o un text
    buit o només d'espais.
    """
    return all(
        str(profile.get(column) or "").strip() for column in PERSONAL_DATA_COLUMNS
    )


# Columna de profiles amb el perfil d'inversor calculat pel backend
# (supabase/migrations/20261109120000_profiles_investor_profile.sql)
INVESTOR_PROFILE_COLUMN = "perfil_inversor"


def _investor_questionnaire_completed(profile: dict) -> bool:
    """US2.3: completat quan hi ha un perfil d'inversor desat.

    Només compten els perfils que pot assignar el càlcul. Qualsevol altre
    valor (NULL, buit o desconegut) vol dir que el qüestionari no s'ha fet
    per l'endpoint.
    """
    return profile.get(INVESTOR_PROFILE_COLUMN) in INVESTOR_PROFILES


def _identity_verification_completed(profile: dict) -> bool:
    """US2.4: es completarà amb la identitat verificada i els termes acceptats."""
    return False


ONBOARDING_STEPS: tuple[tuple[str, StepRule], ...] = (
    ("dades-personals", _personal_data_completed),
    ("questionari-inversor", _investor_questionnaire_completed),
    ("verificacio-identitat", _identity_verification_completed),
)


def get_onboarding_status(profile: dict) -> dict:
    """Calcula l'estat de cada pas de l'onboarding a partir del perfil.

    Args:
        profile: fila de l'usuari a profiles, o un diccionari buit si no n'hi ha.

    Returns:
        Diccionari ``{"steps": [{"id": ..., "status": ...}, ...]}`` amb els
        passos en ordre i l'estat ``pendent`` o ``completat``.
    """
    return {
        "steps": [
            {
                "id": step_id,
                "status": STATUS_COMPLETED if is_completed(profile) else STATUS_PENDING,
            }
            for step_id, is_completed in ONBOARDING_STEPS
        ]
    }
