"""Tests de l'estat de la verificació simulada (core/verification.py)."""

from datetime import UTC, datetime, timedelta

import pytest

from core.onboarding import STATUS_COMPLETED, STATUS_PENDING, get_onboarding_status
from core.verification import (
    REVIEW_SECONDS,
    STATUS_IN_REVIEW,
    STATUS_VERIFIED,
    TERMS_VERSION,
    get_identity_status,
    get_verification_status,
    has_accepted_current_terms,
    is_fully_verified,
)
from core.verification import (
    STATUS_PENDING as IDENTITY_PENDING,
)

SENT_AT = datetime(2026, 11, 9, 12, 0, 0, tzinfo=UTC)
AFTER_REVIEW = SENT_AT + timedelta(seconds=REVIEW_SECONDS)

VERIFIED_PROFILE = {
    "dni_enviat_at": "2026-11-09T12:00:00+00:00",
    "termes_versio": TERMS_VERSION,
    "termes_acceptats_at": "2026-11-09T12:00:20+00:00",
}


@pytest.mark.parametrize(
    "profile",
    [{}, {"dni_enviat_at": None}, {"dni_enviat_at": ""}, {"dni_enviat_at": "no-data"}],
    ids=["no-row", "null", "empty", "invalid"],
)
def test_pending_without_document(profile):
    """Sense moment d'enviament vàlid, la verificació està pendent."""
    assert get_identity_status(profile, AFTER_REVIEW) == IDENTITY_PENDING


@pytest.mark.parametrize(
    "now, expected",
    [
        (SENT_AT, STATUS_IN_REVIEW),
        (AFTER_REVIEW - timedelta(microseconds=1), STATUS_IN_REVIEW),
        (AFTER_REVIEW, STATUS_VERIFIED),
        (SENT_AT + timedelta(days=1), STATUS_VERIFIED),
    ],
    ids=["just-sent", "last-instant", "after-15s", "next-day"],
)
def test_review_lasts_review_seconds(now, expected):
    """En revisió durant els 15 s posteriors a l'enviament i després verificat."""
    profile = {"dni_enviat_at": "2026-11-09T12:00:00+00:00"}

    assert get_identity_status(profile, now) == expected


@pytest.mark.parametrize(
    "sent_at",
    [
        "2026-11-09T12:00:00.123456+00:00",
        "2026-11-09T13:00:00+01:00",
        "2026-11-09T12:00:00",
        SENT_AT,
    ],
    ids=["microseconds", "other-timezone", "no-timezone", "datetime"],
)
def test_accepts_postgrest_timestamp_formats(sent_at):
    """Els formats de timestamptz es comparen en UTC."""
    profile = {"dni_enviat_at": sent_at}

    assert get_identity_status(profile, SENT_AT + timedelta(seconds=1)) == (
        STATUS_IN_REVIEW
    )
    assert get_identity_status(profile, AFTER_REVIEW + timedelta(seconds=1)) == (
        STATUS_VERIFIED
    )


@pytest.mark.parametrize(
    "profile, expected",
    [
        ({}, False),
        ({"termes_versio": TERMS_VERSION}, False),
        ({"termes_versio": "2020-01", "termes_acceptats_at": "2026-11-09"}, False),
        ({"termes_versio": TERMS_VERSION, "termes_acceptats_at": "2026-11-09"}, True),
    ],
    ids=["none", "without-date", "old-version", "current-version"],
)
def test_terms_accepted_only_for_current_version(profile, expected):
    """Només compta l'acceptació de la versió vigent dels termes."""
    assert has_accepted_current_terms(profile) is expected


def test_fully_verified_needs_identity_and_terms():
    """Cal la identitat verificada i els termes vigents alhora."""
    assert is_fully_verified(VERIFIED_PROFILE, AFTER_REVIEW)
    # En revisió, encara que hi hagi termes
    assert not is_fully_verified(VERIFIED_PROFILE, SENT_AT)
    # Verificat, sense termes
    assert not is_fully_verified(
        {"dni_enviat_at": VERIFIED_PROFILE["dni_enviat_at"]}, AFTER_REVIEW
    )


def test_verification_status_shape():
    """La resposta inclou l'estat, l'enviament, els termes i la versió vigent."""
    assert get_verification_status(VERIFIED_PROFILE, AFTER_REVIEW) == {
        "estat": STATUS_VERIFIED,
        "document_enviat_at": "2026-11-09T12:00:00+00:00",
        "termes_versio": TERMS_VERSION,
        "termes_acceptats_at": "2026-11-09T12:00:20+00:00",
        "termes_versio_vigent": TERMS_VERSION,
        "termes_acceptats": True,
    }
    assert get_verification_status({}) == {
        "estat": IDENTITY_PENDING,
        "document_enviat_at": None,
        "termes_versio": None,
        "termes_acceptats_at": None,
        "termes_versio_vigent": TERMS_VERSION,
        "termes_acceptats": False,
    }


def test_onboarding_step_completed_when_fully_verified():
    """El pas verificacio-identitat surt completat amb identitat i termes."""

    def step_status(profile):
        steps = get_onboarding_status(profile)["steps"]
        return next(s["status"] for s in steps if s["id"] == "verificacio-identitat")

    # get_onboarding_status fa servir l'hora real: l'enviament ha de ser passat
    sent_long_ago = {**VERIFIED_PROFILE, "dni_enviat_at": "2020-01-01T00:00:00+00:00"}
    assert step_status(sent_long_ago) == STATUS_COMPLETED
    without_terms = {"dni_enviat_at": sent_long_ago["dni_enviat_at"]}
    assert step_status(without_terms) == STATUS_PENDING
    assert step_status({}) == STATUS_PENDING
