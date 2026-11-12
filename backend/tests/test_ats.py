"""Deterministic ATS scoring (FR-ANA-04/05/06)."""
from app.services.ats_service import calculate_ats_score


def test_required_and_preferred_formula():
    r = calculate_ats_score(["Python", "SQL"], ["Docker", "AWS"], "python and docker experience")
    # 70 * 1/2 + 30 * 1/2
    assert r["score"] == 50.0
    assert r["matched_required"] == ["Python"] and r["missing_required"] == ["SQL"]
    assert r["matched_preferred"] == ["Docker"] and r["missing_preferred"] == ["AWS"]


def test_no_preferred_uses_100_scale():
    r = calculate_ats_score(["Python", "SQL"], [], "I know Python")
    assert r["score"] == 50.0


def test_full_match_is_100_and_none_is_0():
    assert calculate_ats_score(["Python"], ["Docker"], "python docker")["score"] == 100.0
    assert calculate_ats_score(["Python"], ["Docker"], "nothing relevant")["score"] == 0.0


def test_score_is_deterministic():
    args = (["Python", "SQL"], ["Docker"], "python sql")
    assert calculate_ats_score(*args) == calculate_ats_score(*args)
