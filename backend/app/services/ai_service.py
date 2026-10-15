import requests
import json
import re
from typing import Dict, Any, Optional
from app.config import OLLAMA_URL, OLLAMA_MODEL

def parse_natural_language_search(query: str) -> Dict[str, Any]:
    """
    FR-SCH-02 / FR-SCH-03: AI converts natural-language queries into structured search schema.
    FR-SCH-04: Backend validates parameters.
    NFR-AVAIL-01: Falls back seamlessly to rule-based NLP extraction if Ollama is unavailable.
    """
    clean_query = query.strip()
    if not clean_query:
        return {}

    # Attempt calling Ollama if available
    try:
        prompt = (
            f"You are a job search assistant. Parse this query into JSON with keys: "
            f"title (string), company (string), location (string), job_type (string, e.g. Full-time, Remote, Internship), "
            f"skills (list of strings). Output ONLY valid JSON.\nQuery: \"{clean_query}\""
        )
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=5.0  # Quick timeout to prevent UI lag
        )
        if response.status_code == 200:
            result_json = response.json().get("response", "{}")
            parsed = json.loads(result_json)
            if isinstance(parsed, dict):
                return validate_and_clean_search_params(parsed)
    except Exception:
        # Fallback to local heuristic extractor (NFR-AVAIL-01)
        pass

    return local_heuristic_search_parser(clean_query)

def local_heuristic_search_parser(query: str) -> Dict[str, Any]:
    """Smart offline parser for natural language job search queries."""
    q_lower = query.lower()
    params = {}

    # Detect job type
    job_types = ["full-time", "part-time", "contract", "internship", "remote"]
    for jt in job_types:
        if jt in q_lower:
            params["job_type"] = jt.capitalize() if jt != "full-time" else "Full-time"
            break

    # Detect remote location
    if "remote" in q_lower and "job_type" not in params:
        params["location"] = "Remote"
    elif "in " in q_lower:
        # Match "in <City>"
        m = re.search(r'\bin\s+([a-zA-Z\s]+?)(?:\s+with|\s+for|\s+at|$)', query, re.IGNORECASE)
        if m:
            params["location"] = m.group(1).strip()

    # Common technical skills
    common_skills = [
        "python", "react", "javascript", "typescript", "node", "django", "fastapi",
        "java", "c++", "c#", "golang", "go", "sql", "postgresql", "docker", "kubernetes",
        "aws", "azure", "machine learning", "ai", "figma", "html", "css"
    ]
    found_skills = []
    for skill in common_skills:
        if re.search(r'\b' + re.escape(skill) + r'\b', q_lower):
            found_skills.append(skill.title() if len(skill) > 3 else skill.upper())
    if found_skills:
        params["skills"] = found_skills

    # Detect title
    title_terms = ["engineer", "developer", "designer", "manager", "architect", "intern", "scientist"]
    for term in title_terms:
        if term in q_lower:
            # Capture preceding word or full phrase
            m = re.search(r'([a-zA-Z\s]*' + term + r'[a-zA-Z\s]*)', query, re.IGNORECASE)
            if m:
                extracted = m.group(1).strip()
                # Exclude common stopwords
                extracted = re.sub(r'^(looking for|searching for|want a|find a|a|an)\s+', '', extracted, flags=re.I)
                params["title"] = extracted
                break

    if not params:
        params["keyword"] = query

    return params

def validate_and_clean_search_params(params: dict) -> dict:
    """FR-SCH-04: Backend validates AI-generated search parameters."""
    cleaned = {}
    if params.get("title") and isinstance(params["title"], str):
        cleaned["title"] = params["title"].strip()
    if params.get("company") and isinstance(params["company"], str):
        cleaned["company"] = params["company"].strip()
    if params.get("location") and isinstance(params["location"], str):
        cleaned["location"] = params["location"].strip()
    if params.get("job_type") and isinstance(params["job_type"], str):
        cleaned["job_type"] = params["job_type"].strip()
    if params.get("skills") and isinstance(params["skills"], list):
        cleaned["skills"] = [str(s).strip() for s in params["skills"] if str(s).strip()]
    return cleaned
