"""Unit tests for AI job search parsing + ranking (no database needed)."""
from datetime import datetime
from types import SimpleNamespace as NS

import pytest

from app.services import ai_service as ai
from app.services.ai_service import local_heuristic_search_parser as parse, recommend_and_rank_jobs as rank


def job(id, title, company, location, job_type, required, preferred=(), desc="", level=""):
    skills = [NS(skill_name=s, is_required=True) for s in required] + [NS(skill_name=s, is_required=False) for s in preferred]
    return NS(id=id, title=title, company=company, location=location, job_type=job_type, description=desc,
              experience_level=level, skills=skills, created_at=datetime(2026, 1, 1))


@pytest.fixture
def jobs():
    return [
        job(1, "Backend Cloud Engineer", "CloudScale Systems", "Remote (US / Canada)", "Full-time",
            ["Python", "FastAPI", "PostgreSQL", "Docker"], ["Redis", "AWS", "Kubernetes"],
            "Hyper-scale microservices, clean APIs and automated testing.", "Entry to Mid-Level"),
        job(2, "Frontend React Developer", "CloudScale Systems", "San Francisco, CA / Hybrid", "Full-time",
            ["React", "JavaScript", "TypeScript", "CSS"], ["Tailwind", "GraphQL"],
            "Dashboards and component libraries.", "Junior / Mid"),
        job(3, "Data Analyst Intern", "Acme Analytics", "Austin, TX", "Internship",
            ["SQL", "Python"], ["Pandas"], "Google Cloud reporting and dashboards.", "Entry"),
        job(4, "Senior Java Developer", "Globex", "New York, NY", "Full-time",
            ["Java", "Spring Boot", "C++"], [], "Payments platform.", "Senior"),
        job(5, ".NET Engineer", "Initech", "Remote", "Contract", ["C#", ".NET"], [], "Enterprise apps.", "Mid"),
    ]


def ids(results):
    return [r["job"].id for r in results]


# ---- skill detection --------------------------------------------------------------------------
def test_symbol_skills_are_detected():
    assert set(ai.find_skills_in_text("looking for C++ and C# work, plus .NET")) >= {"c++", "c#", ".net"}


def test_java_does_not_match_javascript_and_go_not_in_google():
    assert ai.find_skills_in_text("javascript developer") == ["javascript"]
    assert "go" not in ai.find_skills_in_text("I want to go work at Google")
    assert "go" in ai.find_skills_in_text("Golang backend")
    assert "go" in ai.find_skills_in_text("Rust or Go developer")


def test_aliases_normalise():
    assert ai.canon_skill("React.js") == "react" and ai.canon_skill("Postgres") == "postgresql"
    assert "react" in ai.find_skills_in_text("reactjs engineer")


# ---- heuristic parser --------------------------------------------------------------------------
def test_remote_is_not_a_company():
    p = parse("Looking for Remote Python jobs")
    assert p.get("location") == "Remote" and "company" not in p and p["skills"] == ["Python"]


def test_parser_extracts_location_company_type_title():
    p = parse("full-time backend engineer in Austin, TX at Acme Analytics with Python")
    assert p["job_type"] == "Full-time" and p["location"].startswith("Austin") and p["company"] == "Acme Analytics"
    assert "backend" in p["title"] and p["skills"] == ["Python"]


def test_experience_in_skill_is_not_a_location():
    assert "location" not in parse("developer with experience in Python")


# ---- ranking: relevance ---------------------------------------------------------------------------
def test_query_drops_irrelevant_jobs(jobs):
    out = rank(jobs, query="react developer")
    assert ids(out) == [2]


def test_backend_engineer_does_not_return_frontend(jobs):
    out = rank(jobs, query="backend engineer")
    assert ids(out)[0] == 1 and 2 not in ids(out)


def test_no_substring_false_positives(jobs):
    # "go" / "java" must not match Google Cloud or JavaScript jobs
    assert ids(rank(jobs, query="Java developer")) == [4]
    assert 3 not in ids(rank(jobs, query="Go developer"))


def test_skill_aliases_match_job_skills(jobs):
    assert ids(rank(jobs, query="reactjs jobs"))[0] == 2
    assert ids(rank(jobs, query="postgres python backend"))[0] == 1


def test_cpp_and_dotnet_queries_work(jobs):
    assert 4 in ids(rank(jobs, query="C++ engineer"))
    assert ids(rank(jobs, query="C# .NET jobs"))[0] == 5


def test_more_complete_match_ranks_higher(jobs):
    out = rank(jobs, query="python docker fastapi")
    assert ids(out)[0] == 1 and out[0]["match_score"] > 85


def test_perfect_match_scores_high_without_resume(jobs):
    out = rank(jobs, query="backend engineer python")
    assert out[0]["job"].id == 1 and out[0]["match_level"] == "High Match"


# ---- ranking: constraints ---------------------------------------------------------------------------
def test_remote_query_only_returns_remote_jobs(jobs):
    assert set(ids(rank(jobs, query="remote jobs"))) == {1, 5}


def test_location_in_prompt_is_enforced(jobs):
    assert ids(rank(jobs, query="python jobs in Austin")) == [3]


def test_internship_and_level(jobs):
    assert ids(rank(jobs, query="internship"))[0] == 3
    assert ids(rank(jobs, query="senior developer"))[0] == 4


def test_fallback_when_constraint_cannot_be_met(jobs):
    out = rank(jobs, query="react developer in Tokyo")
    assert ids(out) == [2] and "closest" in out[0]["reasoning"]


def test_company_in_prompt(jobs):
    assert set(ids(rank(jobs, query="jobs at CloudScale Systems"))) == {1, 2}


def test_gibberish_returns_nothing(jobs):
    assert rank(jobs, query="xyzzy quantum basket weaving") == []


# ---- ranking: explicit filters are hard filters ---------------------------------------------------
def test_explicit_filters_exclude(jobs):
    assert set(ids(rank(jobs, location_filter="Remote"))) == {1, 5}
    assert ids(rank(jobs, job_type_filter="Internship")) == [3]
    assert set(ids(rank(jobs, job_type_filter="Remote"))) == {1, 5}
    assert ids(rank(jobs, skill_filter="Docker")) == [1]
    assert ids(rank(jobs, skill_filter="react.js")) == [2]
    assert ids(rank(jobs, keyword_filter="react developer")) == [2]
    assert ids(rank(jobs, keyword_filter="frontend")) == [2]
    assert ids(rank(jobs, location_filter="San Francisco", job_type_filter="Full-time")) == [2]
    assert rank(jobs, location_filter="Tokyo") == []


def test_ui_filter_beats_conflicting_location_in_prompt(jobs):
    assert ids(rank(jobs, query="python jobs in Tokyo", location_filter="Austin")) == [3]


# ---- personalisation ---------------------------------------------------------------------------------
def test_resume_boosts_but_does_not_resurrect_irrelevant_jobs(jobs):
    out = rank(jobs, query="engineer", resume_text="Experienced with React JavaScript TypeScript CSS")
    assert 2 in ids(out)
    assert out[0]["job"].id == 2  # same relevance for all engineer roles -> resume decides
    assert 3 not in ids(out)


def test_recommendation_mode_uses_resume_and_candidate_skills(jobs):
    out = rank(jobs, candidate_skills="Python, FastAPI, PostgreSQL, Docker")
    assert ids(out)[0] == 1 and out[0]["match_score"] >= 70
    assert out[0]["matched_skills"] and "Redis" in out[0]["missing_skills"] + out[0]["matched_skills"]


def test_stopword_only_query_behaves_like_recommendations(jobs):
    assert len(rank(jobs, query="find me jobs please", candidate_skills="React")) == len(jobs)


# ---- gemini merge ---------------------------------------------------------------------------------------
def test_gemini_result_is_merged_with_heuristics(monkeypatch):
    monkeypatch.setattr(ai, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(ai, "call_best_ai_json", lambda *a, **k: {"title": "Backend Engineer", "skills": [], "location": None})
    parsed, issues = ai.parse_search_with_feedback("remote backend engineer with Python")
    assert parsed["title"] == "Backend Engineer" and parsed["skills"] == ["Python"] and parsed["location"] == "Remote"
    assert issues == []


def test_constraint_only_prompt_with_no_match_returns_nothing(jobs):
    assert rank(jobs, query="a job at Google") == []
    assert rank(jobs, query="jobs in Tokyo") == []
