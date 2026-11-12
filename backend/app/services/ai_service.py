import json
import re
from typing import Dict, Any, List, Optional
import requests

from app.config import GEMINI_API_KEY, GEMINI_MODEL
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

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_URL_RE = re.compile(r"(?:https?://|www\.)\S+|\b(?:linkedin|github|gitlab)\.com/\S*", re.I)
_PHONE_RE = re.compile(r"(?<![\w@])\+?\d[\d\s().-]{7,}\d(?!\w)")


def sanitize_for_ai(text: str) -> str:
    """FR-SEC-02: strip emails, URLs and phone numbers before any text is sent to the external LLM."""
    text = _EMAIL_RE.sub("[email]", text or "")
    text = _URL_RE.sub("[link]", text)
    # Phone numbers: long digit runs (>= 9 digits). Short ranges like "2019 - 2023" are kept.
    return _PHONE_RE.sub(lambda m: "[phone]" if sum(c.isdigit() for c in m.group(0)) >= 9 else m.group(0), text)


def _call_gemini_api(prompt: str, system_instruction: str = "") -> Optional[str]:
    """Call the Google Gemini API with GEMINI_MODEL, falling back to other Flash models."""
    api_key = GEMINI_API_KEY
    if not api_key:
        return None

    models = [GEMINI_MODEL, "gemini-flash-lite-latest", "gemini-flash-latest"]
    for model_name in dict.fromkeys(m for m in models if m):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        headers = {"x-goog-api-key": api_key}  # header, not ?key=, so it never lands in logs
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
            resp = requests.post(url, json=payload, headers=headers, timeout=12.0)
            if resp.status_code != 200:
                print(f"[AI] Gemini model '{model_name}' returned HTTP {resp.status_code}: {resp.text[:160]}")
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
        except Exception as e:
            print(f"[AI] Gemini model '{model_name}' request failed: {type(e).__name__}")
            continue

    return None

def call_best_ai_json(prompt: str, system_prompt: str = "") -> Optional[Dict[str, Any]]:
    """Ask Gemini for a JSON answer. Returns None when there is no key or the call fails."""
    raw_json = _call_gemini_api(prompt, system_prompt) if GEMINI_API_KEY else None

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

def extract_skills_from_text(text: str, use_ai: bool = True) -> List[str]:
    """Extract technical skills from resume text using Gemini (if enabled) or the curated taxonomy,
    with strict protections against false positives (e.g. the letter 'C')."""
    if not text or not text.strip():
        return []

    if use_ai and GEMINI_API_KEY:
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
            f"Resume Text:\n{sanitize_for_ai(text)[:6000]}"
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
    return parse_search_with_feedback(query)[0]


def parse_search_with_feedback(query: str) -> tuple:
    """Like parse_natural_language_search, but also returns validation issues (FR-SCH-04)."""
    clean_query = query.strip()
    if not clean_query:
        return {}, []

    if GEMINI_API_KEY:
        prompt = (
            f"You are a job search assistant. Parse this job query into structured JSON with keys: "
            f"\"title\" (string or null), \"company\" (string or null), \"location\" (string or null), "
            f"\"job_type\" (string e.g. Full-time, Remote, Internship, Part-time or null), "
            f"\"skills\" (list of string skills), \"keyword\" (string or null).\n"
            f"Query: \"{clean_query}\""
        )
        parsed = call_best_ai_json(prompt, system_prompt="Output only valid JSON.")
        if parsed and isinstance(parsed, dict):
            return validate_search_params(parsed)

    return local_heuristic_search_parser(clean_query), []

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
        m = re.search(r'\bin\s+([a-zA-Z\s]+?)(?:\s+(?:with|for|at|as)|$)', query, re.IGNORECASE)
        if m:
            params["location"] = m.group(1).strip()

    found_skills = []
    for skill in POPULAR_TECH_SKILLS:
        if re.search(r'\b' + re.escape(skill.lower()) + r'\b', q_lower):
            found_skills.append(skill)
    if found_skills:
        params["skills"] = found_skills

    title_terms = [
        "backend", "frontend", "full stack", "fullstack", "devops", "cloud", "engineer",
        "developer", "designer", "manager", "architect", "intern", "scientist", "analyst",
        "lead", "administrator", "specialist", "consultant", "programmer", "tester", "qa"
    ]
    for term in title_terms:
        if term in q_lower:
            m = re.search(r'([a-zA-Z\s]*' + re.escape(term) + r'[a-zA-Z\s]*)', query, re.IGNORECASE)
            if m:
                extracted = m.group(1).strip()
                extracted = re.sub(r'^(looking for|searching for|want a|find a|a|an|jobs for|roles for)\s+', '', extracted, flags=re.I)
                params["title"] = extracted
                break

    comp_match = re.search(r'\b(?:at|for|by|with)\s+([A-Z][a-zA-Z0-9_\s]{1,30}?)(?:\s+(?:in|as|on|for)|$)', query)
    if comp_match:
        c_name = comp_match.group(1).strip()
        if c_name.lower() not in [s.lower() for s in params.get("skills", [])] and c_name.lower() not in (params.get("title", "")).lower():
            params["company"] = c_name

    if not params:
        params["keyword"] = query

    return params

ALLOWED_SEARCH_KEYS = ("title", "company", "location", "job_type", "skills", "keyword")
_MAX_PARAM_LEN = 120


def validate_search_params(params: dict) -> tuple:
    """FR-SCH-04: validate AI-generated search parameters.

    Returns (cleaned, issues). Only whitelisted keys with well-formed values survive; everything
    else is rejected and described in `issues` so the caller can give clear feedback.
    """
    cleaned: Dict[str, Any] = {}
    issues: List[str] = []
    for key, value in (params or {}).items():
        if key not in ALLOWED_SEARCH_KEYS:
            if value not in (None, "", [], {}):
                issues.append(f"unsupported filter '{key}' was ignored")
            continue
        if value in (None, "", []):
            continue
        if key == "skills":
            if not isinstance(value, list):
                issues.append("'skills' must be a list and was ignored")
                continue
            skills = [str(s).strip() for s in value if str(s).strip() and len(str(s)) <= _MAX_PARAM_LEN]
            if skills:
                cleaned["skills"] = skills
            continue
        if not isinstance(value, str):
            issues.append(f"'{key}' must be text and was ignored")
            continue
        value = value.strip()
        if not value:
            continue
        if len(value) > _MAX_PARAM_LEN:
            issues.append(f"'{key}' was too long and was ignored")
            continue
        cleaned[key] = value
    return cleaned, issues


def validate_and_clean_search_params(params: dict) -> dict:
    return validate_search_params(params)[0]

def recommend_and_rank_jobs(
    jobs: List[Any],
    resume_text: str = "",
    candidate_skills: str = "",
    candidate_headline: str = "",
    query: str = "",
    location_filter: str = "",
    job_type_filter: str = "",
    skill_filter: str = "",
    parsed_query: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Evaluates, scores, and ranks available jobs against a candidate's prompt, profile/resume, and filters."""
    if not jobs:
        return []

    combined_resume = (resume_text or "") + "\n" + (candidate_skills or "") + "\n" + (candidate_headline or "")
    if parsed_query is None:
        parsed_query = parse_natural_language_search(query) if query else {}

    cand_skill_list = set()
    if candidate_skills:
        for s in candidate_skills.split(","):
            if s.strip():
                cand_skill_list.add(s.strip().lower())
    for s in extract_skills_from_text(combined_resume, use_ai=False):
        cand_skill_list.add(s.lower())

    clean_q = (query or "").strip().lower()
    has_query = bool(clean_q)

    # Extract target criteria from parsed_query
    q_title = str(parsed_query.get("title") or "").strip().lower()
    q_company = str(parsed_query.get("company") or "").strip().lower()
    q_location = str(location_filter or parsed_query.get("location") or "").strip().lower()
    q_job_type = str(job_type_filter or parsed_query.get("job_type") or "").strip().lower()
    q_keyword = str(parsed_query.get("keyword") or "").strip().lower()

    # Requested skills from query & filters
    requested_skills = set()
    raw_parsed_skills = parsed_query.get("skills") or []
    if isinstance(raw_parsed_skills, list):
        for s in raw_parsed_skills:
            if str(s).strip():
                requested_skills.add(str(s).strip().lower())
    if skill_filter and skill_filter.strip():
        requested_skills.add(skill_filter.strip().lower())
    if clean_q:
        for sk in POPULAR_TECH_SKILLS:
            if re.search(r'\b' + re.escape(sk.lower()) + r'\b', clean_q):
                requested_skills.add(sk.lower())

    stop_words = {
        "i", "me", "my", "we", "our", "you", "a", "an", "the", "and", "or", "in", "on", "at",
        "to", "for", "with", "about", "against", "between", "into", "through", "during",
        "before", "after", "above", "below", "from", "up", "down", "is", "are", "was", "were",
        "be", "been", "being", "have", "has", "had", "do", "does", "did", "looking", "searching",
        "want", "need", "find", "get", "jobs", "job", "role", "roles", "position", "positions",
        "opening", "openings", "work", "hire", "hiring", "please", "can", "good", "best"
    }
    q_tokens = [w for w in re.split(r'\W+', clean_q) if len(w) >= 2 and w not in stop_words]

    results = []
    for job in jobs:
        req_skills = [s.skill_name for s in job.skills if s.is_required]
        pref_skills = [s.skill_name for s in job.skills if not s.is_required]

        ats_data = calculate_ats_score(req_skills, pref_skills, combined_resume)
        matched_req = list(ats_data["matched_required"])
        missing_req = list(ats_data["missing_required"])
        matched_pref = list(ats_data["matched_preferred"])
        missing_pref = list(ats_data["missing_preferred"])

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

        job_title_lower = (job.title or "").lower()
        job_desc_lower = (job.description or "").lower()
        job_comp_lower = (job.company or "").lower()
        job_loc_lower = (job.location or "").lower()
        job_type_lower = (job.job_type or "").lower()
        job_skill_names = {s.skill_name.lower() for s in job.skills}

        reason_points = []

        if has_query:
            query_points = 0.0
            query_matched = False

            # 1. Title match (up to 40 pts)
            if q_title and (q_title in job_title_lower or job_title_lower in q_title):
                query_points += 40.0
                query_matched = True
                reason_points.append(f"Target role matches '{job.title}'")
            else:
                title_matches = [t for t in q_tokens if t in job_title_lower]
                if title_matches:
                    query_points += min(35.0, len(title_matches) * 18.0)
                    query_matched = True
                    reason_points.append(f"Role title matches search: '{job.title}'")

            # 2. Skills match (up to 40 pts)
            if requested_skills:
                matched_q_skills = [
                    s for s in requested_skills 
                    if s in job_skill_names or re.search(r'\b' + re.escape(s) + r'\b', job_desc_lower)
                ]
                if matched_q_skills:
                    ratio = len(matched_q_skills) / len(requested_skills)
                    query_points += ratio * 40.0
                    query_matched = True
                    reason_points.append(f"Covers requested skill(s): {', '.join(s.title() for s in matched_q_skills[:3])}")

            # 3. Company match (up to 20 pts)
            if q_company and q_company in job_comp_lower:
                query_points += 20.0
                query_matched = True
                reason_points.append(f"Matches company '{job.company}'")
            elif any(t in job_comp_lower for t in q_tokens if len(t) >= 4):
                query_points += 15.0
                query_matched = True
                reason_points.append(f"Matches company '{job.company}'")

            # 4. Location match (up to 15 pts)
            if q_location:
                if q_location in job_loc_lower or ("remote" in q_location and "remote" in (job_loc_lower + " " + job_type_lower)):
                    query_points += 15.0
                    query_matched = True
                    reason_points.append(f"Matches location preference ({job.location})")

            # 5. Job type match (up to 15 pts)
            if q_job_type:
                if q_job_type in job_type_lower or (q_job_type == "remote" and "remote" in (job_loc_lower + " " + job_type_lower)):
                    query_points += 15.0
                    query_matched = True
                    reason_points.append(f"Matches {job.job_type} role")

            # 6. Keyword / Description match (up to 15 pts)
            if q_keyword and (q_keyword in job_desc_lower or q_keyword in job_title_lower):
                query_points += 15.0
                query_matched = True
                reason_points.append(f"Matches topic '{q_keyword}'")
            else:
                desc_matches = [t for t in q_tokens if t in job_desc_lower and t not in job_title_lower]
                if desc_matches:
                    query_points += min(15.0, len(desc_matches) * 5.0)
                    query_matched = True

            query_score = min(100.0, query_points)

            # In search mode: prompt relevance is primary (75%), resume match is personalization boost (25%)
            if query_matched:
                if resume_text.strip():
                    relevance_score = (query_score * 0.75) + (final_ats_score * 0.25)
                    if final_ats_score >= 60:
                        reason_points.append(f"Resume ATS match: {int(final_ats_score)}%")
                else:
                    relevance_score = query_score
            else:
                # Unrelated to user prompt: heavily demoted
                relevance_score = min(15.0, final_ats_score * 0.15)
                reason_points.append("Low relevance to search prompt.")

        else:
            # Pure recommendations mode (no search query): ATS is primary
            relevance_score = final_ats_score

            loc_filt = (location_filter or "").lower()
            if loc_filt and (loc_filt in job_loc_lower or ("remote" in loc_filt and "remote" in (job_loc_lower + " " + job_type_lower))):
                relevance_score = min(100.0, relevance_score + 8.0)
                reason_points.append(f"Matches your location preference ({job.location})")

            jt_filt = (job_type_filter or "").lower()
            if jt_filt and jt_filt in job_type_lower:
                relevance_score = min(100.0, relevance_score + 8.0)
                reason_points.append(f"Matches {job.job_type} role")

            if skill_filter and any(skill_filter.lower() in s.skill_name.lower() for s in job.skills):
                relevance_score = min(100.0, relevance_score + 8.0)

            if candidate_headline:
                cand_head_words = [w.lower() for w in re.split(r'\W+', candidate_headline) if len(w) > 3]
                if any(w in job_title_lower for w in cand_head_words):
                    relevance_score = min(100.0, relevance_score + 5.0)

            if matched_req:
                reason_points.append(f"Covers required skills: {', '.join(matched_req[:3])}")
            if matched_pref:
                reason_points.append(f"Bonus preferred skills: {', '.join(matched_pref[:2])}")
            if missing_req:
                reason_points.append(f"Missing required: {', '.join(missing_req[:2])}")

        score_val = round(min(100.0, max(0.0, relevance_score)), 1)
        if score_val >= 75.0:
            level = "High Match"
        elif score_val >= 50.0:
            level = "Good Match"
        else:
            level = "Potential Match"

        all_matched = matched_req + matched_pref
        all_missing = missing_req + missing_pref
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
