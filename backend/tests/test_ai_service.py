"""Gemini calling: request shape, model fallback, error handling, heuristic fallback (network mocked)."""
import json

import pytest
import requests

from app.services import ai_service

KEY = "test-key-123"


class Resp:
    def __init__(self, status=200, body=None, text=""):
        self.status_code, self._body, self.text = status, body, text or json.dumps(body or {})

    def json(self):
        return self._body


def gemini_ok(text):
    return Resp(200, {"candidates": [{"content": {"parts": [{"text": text}]}}]})


@pytest.fixture
def calls(monkeypatch):
    monkeypatch.setattr(ai_service, "GEMINI_API_KEY", KEY)
    monkeypatch.setattr(ai_service, "GEMINI_MODEL", "gemini-retired-model")
    log = []
    return log


def patch_post(monkeypatch, log, responder):
    def fake_post(url, json=None, headers=None, timeout=None):
        log.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return responder(url)
    monkeypatch.setattr(ai_service.requests, "post", fake_post)


def test_no_key_means_no_network(monkeypatch):
    monkeypatch.setattr(ai_service, "GEMINI_API_KEY", "")
    monkeypatch.setattr(ai_service.requests, "post", lambda *a, **k: pytest.fail("network call without key"))
    assert ai_service.call_best_ai_json("hi") is None


def test_request_shape_and_json_parsing(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: gemini_ok('{"skills": ["Python"]}'))
    out = ai_service.call_best_ai_json("extract", system_prompt="be a recruiter")
    assert out == {"skills": ["Python"]}

    c = calls[0]
    assert "models/gemini-retired-model:generateContent" in c["url"]
    assert c["headers"]["x-goog-api-key"] == KEY
    assert KEY not in c["url"]                      # key must not leak into URLs/logs
    assert c["json"]["contents"][0]["parts"][0]["text"] == "extract"
    assert c["json"]["systemInstruction"]["parts"][0]["text"] == "be a recruiter"
    assert c["json"]["generationConfig"]["responseMimeType"] == "application/json"


def test_json_wrapped_in_prose_is_still_parsed(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: gemini_ok('Sure! ```json\n{"a": 1}\n``` done'))
    assert ai_service.call_best_ai_json("x") == {"a": 1}


def test_retired_model_falls_back_to_next_model(monkeypatch, calls, capsys):
    def responder(url):
        if "gemini-retired-model" in url:
            return Resp(404, text='{"error": "model not found"}')
        return gemini_ok('{"ok": true}')
    patch_post(monkeypatch, calls, responder)
    assert ai_service.call_best_ai_json("x") == {"ok": True}
    assert "gemini-retired-model" in calls[0]["url"]
    assert "gemini-flash-lite-latest" in calls[1]["url"]
    out = capsys.readouterr().out
    assert "HTTP 404" in out and KEY not in out


def test_all_models_failing_returns_none(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: Resp(500, text="boom"))
    assert ai_service.call_best_ai_json("x") is None


def test_network_error_returns_none_and_never_raises(monkeypatch, calls, capsys):
    def boom(url):
        raise requests.exceptions.ConnectTimeout("slow")
    patch_post(monkeypatch, calls, boom)
    assert ai_service.call_best_ai_json("x") is None
    assert "ConnectTimeout" in capsys.readouterr().out


def test_garbage_response_returns_none(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: gemini_ok("not json at all"))
    assert ai_service.call_best_ai_json("x") is None


def test_skill_extraction_uses_gemini_when_available(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: gemini_ok('{"skills": ["Rust", " Go "]}'))
    assert ai_service.extract_skills_from_text("some resume text") == ["Rust", "Go"]


def test_skill_extraction_falls_back_to_taxonomy_when_gemini_fails(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: Resp(500, text="down"))
    assert "Python" in ai_service.extract_skills_from_text("I build things in Python and Docker")


def test_search_parsing_falls_back_to_heuristics_when_gemini_fails(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: Resp(500, text="down"))
    out = ai_service.parse_natural_language_search("remote junior python roles")
    assert isinstance(out, dict) and out  # heuristic parser still produces something


def test_search_parsing_uses_gemini_result(monkeypatch, calls):
    patch_post(monkeypatch, calls, lambda url: gemini_ok(
        '{"title": "Backend Engineer", "location": "Remote", "skills": ["Python"], "job_type": "Full-time"}'))
    out = ai_service.parse_natural_language_search("backend engineer remote python")
    assert len(calls) >= 1
    assert "Python" in json.dumps(out)


def test_extract_skills_without_ai_makes_no_network_call(monkeypatch, calls):
    monkeypatch.setattr(ai_service.requests, "post", lambda *a, **k: pytest.fail("LLM called with use_ai=False"))
    assert "Python" in ai_service.extract_skills_from_text("I use Python daily", use_ai=False)


def test_ai_search_endpoint_makes_a_single_gemini_call(client, student, monkeypatch, calls):
    """Regression: search used to make two sequential LLM calls (query parse + resume skills)."""
    patch_post(monkeypatch, calls, lambda url: gemini_ok('{"keyword": "python", "skills": ["Python"]}'))
    r = client.get("/api/jobs/ai-search", params={"q": "remote junior python roles"}, headers=student)
    assert r.status_code == 200
    assert len(calls) == 1
