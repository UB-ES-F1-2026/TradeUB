"""Càlcul del perfil d'inversor a partir de les respostes del qüestionari.

És el càlcul definitiu: el perfil que es desa a profiles és el que surt d'aquí,
no el que pugui calcular el navegador. Ha de puntuar igual que
``frontend/src/utils/investorProfile.js`` (#46), i les preguntes i opcions
han de coincidir amb ``frontend/src/utils/investorQuestions.js``.
"""

PROFILE_BEGINNER = "principiant"
PROFILE_INTERMEDIATE = "intermedi"
PROFILE_ADVANCED = "avancat"

# Valors que admet la columna perfil_inversor
# (supabase/migrations/20261109120000_profiles_investor_profile.sql)
INVESTOR_PROFILES = (PROFILE_BEGINNER, PROFILE_INTERMEDIATE, PROFILE_ADVANCED)

# Id de cada pregunta i els ids de les seves opcions, en el mateix ordre que al
# frontend: de menys a més experiència. L'ordre és la puntuació de l'opció.
INVESTOR_QUESTIONS: dict[str, tuple[str, ...]] = {
    "experiencia": ("cap", "poca", "habitual"),
    "coneixement": ("baix", "mitja", "alt"),
    "seguiment": ("mai", "setmanal", "diari"),
    "caiguda": ("vendre", "esperar", "comprar"),
    "horitzo": ("curt", "mitja", "llarg"),
}

# Trams sobre la puntuació màxima: fins al 30 % principiant, fins al 70 %
# intermedi, la resta avançat
BEGINNER_MAX_RATIO = 0.3
INTERMEDIATE_MAX_RATIO = 0.7


def max_score() -> int:
    """Puntuació màxima del qüestionari: 10 amb 5 preguntes de 3 opcions."""
    return sum(len(options) - 1 for options in INVESTOR_QUESTIONS.values())


def calculate_score(answers: dict[str, str]) -> int:
    """Suma la posició (0, 1, 2...) de l'opció triada a cada pregunta.

    Args:
        answers: id de pregunta → id d'opció. Les claus que no són preguntes
            s'ignoren.

    Returns:
        La puntuació, entre 0 i ``max_score()``.

    Raises:
        ValueError: si falta alguna pregunta o una resposta no és cap de les
            seves opcions. L'endpoint ja ho valida abans; aquí és perquè el
            càlcul no pugui retornar mai un perfil amb respostes incompletes.
    """
    score = 0
    for question_id, options in INVESTOR_QUESTIONS.items():
        answer = answers.get(question_id)
        if answer not in options:
            raise ValueError(f"Resposta no vàlida a la pregunta {question_id!r}")
        score += options.index(answer)
    return score


def profile_for_score(score: int, maximum: int) -> str:
    """Tradueix una puntuació al perfil segons el tram on cau.

    Fa la mateixa divisió que el frontend perquè els límits (3/10 i 7/10)
    caiguin al mateix tram en tots dos llocs.
    """
    ratio = score / maximum
    if ratio <= BEGINNER_MAX_RATIO:
        return PROFILE_BEGINNER
    if ratio <= INTERMEDIATE_MAX_RATIO:
        return PROFILE_INTERMEDIATE
    return PROFILE_ADVANCED


def calculate_investor_profile(answers: dict[str, str]) -> str:
    """Avalua les 5 respostes i retorna el perfil d'inversor.

    Args:
        answers: id de pregunta → id d'opció.

    Returns:
        ``"principiant"``, ``"intermedi"`` o ``"avancat"``.

    Raises:
        ValueError: si les respostes no són completes o vàlides.
    """
    return profile_for_score(calculate_score(answers), max_score())
