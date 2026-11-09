"""Tests del càlcul del perfil d'inversor (core/investor_profile.py).

Els casos són els mateixos que frontend/src/tests/investorProfile.spec.js,
perquè el backend ha d'assignar el mateix perfil que el càlcul de la #46.
"""

import pytest

from core.investor_profile import (
    INVESTOR_PROFILES,
    INVESTOR_QUESTIONS,
    PROFILE_ADVANCED,
    PROFILE_BEGINNER,
    PROFILE_INTERMEDIATE,
    calculate_investor_profile,
    calculate_score,
    max_score,
)


def answers_with(positions):
    """Respon cada pregunta amb l'opció de la posició indicada (0, 1 o 2)."""
    return {
        question_id: options[position]
        for (question_id, options), position in zip(
            INVESTOR_QUESTIONS.items(), positions, strict=True
        )
    }


def test_questions_match_frontend():
    """Les preguntes i opcions són les de frontend/src/utils/investorQuestions.js."""
    assert INVESTOR_QUESTIONS == {
        "experiencia": ("cap", "poca", "habitual"),
        "coneixement": ("baix", "mitja", "alt"),
        "seguiment": ("mai", "setmanal", "diari"),
        "caiguda": ("vendre", "esperar", "comprar"),
        "horitzo": ("curt", "mitja", "llarg"),
    }


def test_profiles_match_database_check():
    """Els perfils són els que admet el check de perfil_inversor."""
    assert INVESTOR_PROFILES == ("principiant", "intermedi", "avancat")


@pytest.mark.parametrize(
    ("positions", "score"),
    [([0, 0, 0, 0, 0], 0), ([2, 1, 0, 1, 2], 6), ([2, 2, 2, 2, 2], 10)],
)
def test_score_adds_option_positions(positions, score):
    """Cada opció val la seva posició dins la pregunta."""
    assert calculate_score(answers_with(positions)) == score


def test_max_score_is_10():
    """Amb 5 preguntes de 3 opcions la puntuació màxima és 10."""
    assert max_score() == 10


@pytest.mark.parametrize(
    ("positions", "score", "profile"),
    [
        ([0, 0, 0, 0, 0], 0, PROFILE_BEGINNER),
        ([1, 1, 1, 0, 0], 3, PROFILE_BEGINNER),
        ([1, 1, 1, 1, 0], 4, PROFILE_INTERMEDIATE),
        ([2, 2, 1, 1, 1], 7, PROFILE_INTERMEDIATE),
        ([2, 2, 2, 1, 1], 8, PROFILE_ADVANCED),
        ([2, 2, 2, 2, 2], 10, PROFILE_ADVANCED),
    ],
)
def test_profile_for_each_range(positions, score, profile):
    """Fins a 3 punts principiant, fins a 7 intermedi i a partir de 8 avançat."""
    answers = answers_with(positions)

    assert calculate_score(answers) == score
    assert calculate_investor_profile(answers) == profile


@pytest.mark.parametrize("question_id", INVESTOR_QUESTIONS)
def test_missing_answer_raises(question_id):
    """Sense alguna de les respostes no es pot calcular el perfil."""
    answers = answers_with([1, 1, 1, 1, 1])
    del answers[question_id]

    with pytest.raises(ValueError):
        calculate_investor_profile(answers)


def test_unknown_option_raises():
    """Una resposta que no és cap de les opcions no puntua com a 0."""
    answers = {**answers_with([1, 1, 1, 1, 1]), "caiguda": "inventada"}

    with pytest.raises(ValueError):
        calculate_investor_profile(answers)


def test_option_of_another_question_raises():
    """'alt' és una opció de coneixement, no d'experiencia."""
    answers = {**answers_with([1, 1, 1, 1, 1]), "experiencia": "alt"}

    with pytest.raises(ValueError):
        calculate_score(answers)


def test_extra_keys_are_ignored():
    """Les claus que no són preguntes no afecten la puntuació."""
    answers = {**answers_with([2, 2, 2, 2, 2]), "bonus": "habitual"}

    assert calculate_score(answers) == 10
