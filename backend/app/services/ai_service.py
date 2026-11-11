import json
import re
import time
import socket
from typing import Dict, Any, List, Optional
import requests

from app.config import (
    GEMINI_API_KEY, GEMINI_MODEL,
    OPENAI_API_KEY, OPENAI_MODEL,
    GROQ_API_KEY, GROQ_MODEL,
    OLLAMA_URL, OLLAMA_MODEL
)
from app.services.ats_service import calculate_ats_score, match_skills_in_text

# Comprehensive skill taxonomy for local extraction and matching
POPULAR_TECH_SKILLS = [
    # Languages
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Golang", "Rust",
    "Ruby", "PHP", "Swift", "Kotlin", "SQL", "HTML", "CSS", "Bash", "Shell", "Scala",
    # Frontend
    "React", "React.js", "Next.js", "Vue", "Vue.js", "Angular", "Svelte", "Tailwind CSS",
    "Bootstrap", "Redux", "GraphQL", "Figma", "UI/UX", "Webpack", "Vite",
    # Backend & Frameworks
    "FastAPI", "Django", "Flask", "Node.js", "Express", "Express.js", "Spring Boot", "NestJS",
    "ASP.NET", ".NET", "Ruby on Rails", "Laravel", "REST API", "Microservices", "gRPC",
    # Databases & Storage
    "PostgreSQL", "Postgres", "MySQL", "SQLite", "MongoDB", "Redis", "Cassandra", "DynamoDB",
    "Elasticsearch", "Firebase", "Supabase", "SQL Server", "Oracle",
    # Cloud & DevOps
    "Docker", "Kubernetes", "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud",
    "CI/CD", "Git", "GitHub", "GitLab", "Terraform", "Ansible", "Linux", "Nginx", "Kafka",
    "RabbitMQ", "Prometheus", "Grafana",
    # AI / ML / Data
    "Machine Learning", "Deep Learning", "Artificial Intelligence", "AI", "NLP", "LLM",
    "PyTorch", "TensorFlow", "Scikit-Learn", "Pandas", "NumPy", "Data Science", "Computer Vision",
    # Other & Practices
    "Unit Testing", "Jest", "Pytest", "Agile", "Scrum", "System Design"
]

_ollama_cache = {"alive": None, "checked_at": 0}

def is_ollama_online() -> bool:
    """Ultra-fast (2ms) socket probe whether local Ollama is active."""
    if not OLLAMA_URL:
        return False
    now = time.time()
    if _ollama_cache["alive"] is not None and (now - _ollama_cache["checked_at"]) < 60:
        return _ollama_cache["alive"]
    _ollama_cache["checked_at"] = now
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.04)
        host = "127.0.0.1"
        port = 11434
        if "://" in OLLAMA_URL:
            part = OLLAMA_URL.split("://")[1].split("/")[0]
            if ":" in part:
                host, p_str = part.split(":")
                port = int(p_str)
            else:
                host = part
        if host == "localhost":
            host = "127.0.0.1"
        res = s.connect_ex((host, port))
        s.close()
        _ollama_cache["alive"] = (res == 0)
    except Exception:
        _ollama_cache["alive"] = False
    return _ollama_cache["alive"]

def _call_gemini_api(prompt: str, system_instruction: str = "") -> Optional[str]:
    """Call Google Gemini API (prioritizing Gemini Pro / user-selected model)."""
    # Fetch dynamically from config in case updated at runtime
    import app.config as cfg
    api_key = cfg.GEMINI_API_KEY
    if not api_key:
        return None

    # Priority list of models: User prefers Gemini Pro, followed by flash models
    model_candidates = []
    if cfg.GEMINI_MODEL:
        model_candidates.append(cfg.GEMINI_MODEL)
    model_candidates.extend(["gemini-1.5-pro", "gemini-2.0-flash", "gemini-1.5-flash"])
    # Unique candidates in order
    models = list(dict.fromkeys(model_candidates))

    for model_name in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json"
            }
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        try:
            resp = requests.post(url, json=payload, timeout=8.0)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
        except Exception:
            continue

    return None

def _call_openai_api(prompt: str, system_prompt: str = "") -> Optional[str]:
    """Call OpenAI Chat Completions API."""
    if not OPENAI_API_KEY:
        return None

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        resp = requests.post(
            url,
            headers=headers,
            json={
                "model": OPENAI_MODEL or "gpt-4o-mini",
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": 0.2
            },
            timeout=6.0
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        pass
    return None

def _call_groq_api(prompt: str, system_prompt: str = "") -> Optional[str]:
    """Call Groq API."""
    if not GROQ_API_KEY:
        return None

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    try:
        resp = requests.post(
            url,
            headers=headers,
            json={
                "model": GROQ_MODEL or "llama-3.3-70b-versatile",
                "messages": messages,
                "response_format": {"type": "json_object"},
                "temperature": 0.2
            },
            timeout=5.0
        )
        if resp.status_code == 200:
            return resp.json()["choices"][0]["message"]["content"]
    except Exception:
        pass
    return None

def _call_ollama(prompt: str) -> Optional[str]:
    """Call local Ollama only if it is actually online."""
    if not is_ollama_online():
        return None
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=2.0
        )
        if resp.status_code == 200:
            return resp.json().get("response", "{}")
    except Exception:
        pass
    return None

def call_best_ai_json(prompt: str, system_prompt: str = "") -> Optional[Dict[str, Any]]:
    """Tries the best available API in order: Gemini -> OpenAI -> Groq -> Ollama."""
    raw_json = None
    if GEMINI_API_KEY:
        raw_json = _call_gemini_api(prompt, system_prompt)
    if not raw_json and OPENAI_API_KEY:
        raw_json = _call_openai_api(prompt, system_prompt)
    if not raw_json and GROQ_API_KEY:
        raw_json = _call_groq_api(prompt, system_prompt)
    if not raw_json and is_ollama_online():
        raw_json = _call_ollama(f"{system_prompt}\n{prompt}")

    if raw_json:
        try:
            return json.loads(raw_json)
        except Exception:
            m = re.search(r'\{.*\}', raw_json, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass
    return None

def extract_skills_from_text(text: str) -> List[str]:
    """
    Extract technical skills from resume text using Gemini Pro (or other LLMs)
    with strict accuracy protections against false positives (e.g. 'C' letter bugs).
    """
    if not text or not text.strip():
        return []

    import app.config as cfg
    has_llm = bool(cfg.GEMINI_API_KEY or OPENAI_API_KEY or GROQ_API_KEY or is_ollama_online())

    if has_llm:
        prompt = (
            "Analyze the following resume text and extract ALL programming languages, frameworks, "
            "libraries, databases, cloud platforms, DevOps tools, and technical skills possessed by the candidate.\n\n"
            "STRICT ACCURACY RULES:\n"
            "1. DO NOT extract or output 'C' or 'C Language' unless the resume explicitly mentions "
            "'C language', 'C programming', 'ANSI C', or 'C/C++'.\n"
            "2. DO NOT treat single letter section titles (e.g., 'C.', 'Section C'), bullet points, "
            "middle initials, or letter grades ('Grade C') as the C programming language.\n"
            "3. Normalize variations to standard professional naming (e.g., 'React' or 'React.js', 'PostgreSQL', 'Docker').\n"
            "4. Return ONLY a valid JSON object with a single 'skills' key: {\"skills\": [\"Skill1\", \"Skill2\", ...]}\n\n"
            f"Resume Text:\n{text[:6000]}"
        )
        res = call_best_ai_json(prompt, system_prompt="You are an expert technical ATS resume parser.")
        if res and isinstance(res.get("skills"), list):
            cleaned = []
            for s in res["skills"]:
                val = str(s).strip()
                if not val:
                    continue
                # Double-check guard against single 'C' false positives
                if val.lower() == "c":
                    if not re.search(r'\b(?:c\s*programming|c\s*language|ansi\s*c|c\s*\/\s*c\+\+)\b', text, re.IGNORECASE):
                        continue
                cleaned.append(val)
            if cleaned:
                return cleaned

    # Deterministic taxonomy fallback with word boundaries (NEVER loose substring)
    lowered = " " + text.lower() + " "
    found = []
    for skill in POPULAR_TECH_SKILLS:
        s_norm = skill.lower()
        if s_norm in ("c", "c language"):
            if re.search(r'\b(?:c\s*programming|c\s*language|ansi\s*c|c\s*\/\s*c\+\+)\b', lowered):
                if "C" not in found:
                    found.append("C")
            continue

        if any(ch in skill for ch in ["+", "#", "."]):
            sym_pattern = r'(?:^|[\s,;/()|\[\]])' + re.escape(s_norm) + r'(?:$|[\s,;/()|\[\]])'
            if re.search(sym_pattern, lowered):
                if skill not in found:
                    found.append(skill)
            continue

        pattern = r'(?:\b|_)' + re.escape(s_norm) + r'(?:\b|_)'
        if re.search(pattern, lowered):
            canonical = "PostgreSQL" if s_norm in ("postgres", "postgresql") else skill
            if canonical not in found:
                found.append(canonical)

    return found

def parse_natural_language_search(query: str) -> Dict[str, Any]:
    """Parse user's natural language search query into structured parameters."""
    clean_query = query.strip()
    if not clean_query:
        return {}

    if GEMINI_API_KEY or OPENAI_API_KEY or GROQ_API_KEY or is_ollama_online():
        prompt = (
            f"You are a job search assistant. Parse this job query into structured JSON with keys: "
            f"\"title\" (string or null), \"company\" (string or null), \"location\" (string or null), "
            f"\"job_type\" (string e.g. Full-time, Remote, Internship, Part-time or null), "
            f"\"skills\" (list of string skills), \"keyword\" (string or null).\n"
            f"Query: \"{clean_query}\""
        )
        parsed = call_best_ai_json(prompt, system_prompt="Output only valid JSON.")
        if parsed and isinstance(parsed, dict):
            return validate_and_clean_search_params(parsed)

    return local_heuristic_search_parser(clean_query)

def local_heuristic_search_parser(query: str) -> Dict[str, Any]:
    """Smart offline parser for natural language job search queries."""
    q_lower = query.lower()
    params = {}

    job_types = ["full-time", "part-time", "contract", "internship", "remote"]
    for jt in job_types:
        if jt in q_lower:
            params["job_type"] = jt.capitalize() if jt != "full-time" else "Full-time"
            break

    if "remote" in q_lower and "job_type" not in params:
        params["location"] = "Remote"
    elif "in " in q_lower:
        m = re.search(r'\bin\s+([a-zA-Z\s]+?)(?:\s+with|\s+for|\s+at|$)', query, re.IGNORECASE)
        if m:
            params["location"] = m.group(1).strip()

    found_skills = []
    for skill in POPULAR_TECH_SKILLS:
        if re.search(r'\b' + re.escape(skill.lower()) + r'\b', q_lower):
            found_skills.append(skill)
    if found_skills:
        params["skills"] = found_skills

    title_terms = ["backend", "frontend", "full stack", "fullstack", "devops", "cloud", "engineer", "developer", "designer", "manager", "architect", "intern", "scientist"]
    for term in title_terms:
        if term in q_lower:
            m = re.search(r'([a-zA-Z\s]*' + re.escape(term) + r'[a-zA-Z\s]*)', query, re.IGNORECASE)
            if m:
                extracted = m.group(1).strip()
                extracted = re.sub(r'^(looking for|searching for|want a|find a|a|an)\s+', '', extracted, flags=re.I)
                params["title"] = extracted
                break

    if not params:
        params["keyword"] = query

    return params

def validate_and_clean_search_params(params: dict) -> dict:
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
    if params.get("keyword") and isinstance(params["keyword"], str):
        cleaned["keyword"] = params["keyword"].strip()
    return cleaned

def recommend_and_rank_jobs(
    jobs: List[Any],
    resume_text: str = "",
    candidate_skills: str = "",
    candidate_headline: str = "",
    query: str = "",
    location_filter: str = "",
    job_type_filter: str = "",
    skill_filter: str = ""
) -> List[Dict[str, Any]]:
    """Evaluates, scores, and ranks available jobs against a candidate's profile/resume and filters."""
    if not jobs:
        return []

    combined_resume = (resume_text or "") + "\n" + (candidate_skills or "") + "\n" + (candidate_headline or "")
    parsed_query = parse_natural_language_search(query) if query else {}

    cand_skill_list = set()
    if candidate_skills:
        for s in candidate_skills.split(","):
            if s.strip():
                cand_skill_list.add(s.strip().lower())
    for s in extract_skills_from_text(combined_resume):
        cand_skill_list.add(s.lower())

    results = []
    for job in jobs:
        req_skills = [s.skill_name for s in job.skills if s.is_required]
        pref_skills = [s.skill_name for s in job.skills if not s.is_required]

        ats_data = calculate_ats_score(req_skills, pref_skills, combined_resume)
        matched_req = ats_data["matched_required"]
        missing_req = ats_data["missing_required"]
        matched_pref = ats_data["matched_preferred"]
        missing_pref = ats_data["missing_preferred"]

        for mis in list(missing_req):
            if mis.lower() in cand_skill_list:
                missing_req.remove(mis)
                matched_req.append(mis)

        for mis in list(missing_pref):
            if mis.lower() in cand_skill_list:
                missing_pref.remove(mis)
                matched_pref.append(mis)

        tr = len(req_skills)
        tp = len(pref_skills)
        mr = len(matched_req)
        mp = len(matched_pref)
        if tr == 0:
            final_ats_score = 100.0 if (tp == 0 or mp == tp) else (mp / tp) * 100.0
        elif tp == 0:
            final_ats_score = 100.0 * (mr / tr)
        else:
            final_ats_score = (70.0 * (mr / tr)) + (30.0 * (mp / tp))

        relevance_score = final_ats_score
        reason_points = []

        loc_filt = (location_filter or parsed_query.get("location", "")).lower()
        if loc_filt and (loc_filt in job.location.lower() or ("remote" in loc_filt and "remote" in (job.location + " " + job.job_type).lower())):
            relevance_score = min(100.0, relevance_score + 5.0)
            reason_points.append(f"Matches your location preference ({job.location})")

        jt_filt = (job_type_filter or parsed_query.get("job_type", "")).lower()
        if jt_filt and jt_filt in job.job_type.lower():
            relevance_score = min(100.0, relevance_score + 5.0)
            reason_points.append(f"Matches {job.job_type} role")

        if skill_filter and any(skill_filter.lower() in s.skill_name.lower() for s in job.skills):
            relevance_score = min(100.0, relevance_score + 5.0)

        q_title = parsed_query.get("title", "")
        if q_title and q_title.lower() in job.title.lower():
            relevance_score = min(100.0, relevance_score + 8.0)
            reason_points.append(f"Target role matches '{job.title}'")

        if parsed_query.get("company") and parsed_query["company"].lower() in job.company.lower():
            relevance_score = min(100.0, relevance_score + 10.0)
            reason_points.append(f"Matches company '{job.company}'")

        if candidate_headline:
            cand_head_words = [w.lower() for w in re.split(r'\W+', candidate_headline) if len(w) > 3]
            if any(w in job.title.lower() for w in cand_head_words):
                relevance_score = min(100.0, relevance_score + 4.0)

        score_val = round(min(100.0, max(0.0, relevance_score)), 1)
        if score_val >= 75.0:
            level = "High Match"
        elif score_val >= 50.0:
            level = "Good Match"
        else:
            level = "Potential Match"

        all_matched = matched_req + matched_pref
        all_missing = missing_req + missing_pref

        if matched_req:
            reason_points.append(f"Covers required skills: {', '.join(matched_req[:3])}")
        if matched_pref:
            reason_points.append(f"Bonus preferred skills: {', '.join(matched_pref[:2])}")
        if missing_req:
            reason_points.append(f"Missing required: {', '.join(missing_req[:2])}")

        reasoning = " • ".join(reason_points) if reason_points else "Matches general technical profile."

        results.append({
            "job": job,
            "match_score": score_val,
            "match_level": level,
            "matched_skills": all_matched,
            "missing_skills": all_missing,
            "reasoning": reasoning
        })

    results.sort(key=lambda r: r["match_score"], reverse=True)
    return results
