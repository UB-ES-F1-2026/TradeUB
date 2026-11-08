"""Estat de l'onboarding deduït de la fila de l'usuari a la taula profiles.

Cada pas té una regla que, a partir del perfil, decideix si està completat.
L'ordre de ``ONBOARDING_STEPS`` és l'ordre en què l'usuari els ha de fer i
els identificadors coincideixen amb els del frontend (``stores/onboarding.js``).

De moment cap pas té dades a ``profiles``, així que totes les regles retornen
``False``. Les tasques de backend de US2.2, US2.3 i US2.4 hi afegeixen la regla
del seu pas quan creen les columnes corresponents.
"""

from collections.abc import Callable

STATUS_PENDING = "pendent"
STATUS_COMPLETED = "completat"

StepRule = Callable[[dict], bool]


def _personal_data_completed(profile: dict) -> bool:
    """US2.2: es completarà quan tots els camps de dades personals tinguin valor."""
    return False


def _investor_questionnaire_completed(profile: dict) -> bool:
    """US2.3: es completarà quan hi hagi un perfil d'inversor desat."""
    return False


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
