import json
import re
import time
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
    started = time.monotonic()
    for model_name in dict.fromkeys(m for m in models if m):
        if time.monotonic() - started > 14.0:  # keep search responsive when Gemini is slow/down
            break
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
            resp = requests.post(url, json=payload, headers=headers, timeout=8.0)
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

# ---------------------------------------------------------------------------
# Search understanding helpers (word-boundary safe, alias aware)
# ---------------------------------------------------------------------------
SKILL_ALIASES = {
    "react.js": "react", "reactjs": "react", "node": "node.js", "nodejs": "node.js",
    "postgres": "postgresql", "golang": "go", "js": "javascript", "ts": "typescript",
    "k8s": "kubernetes", "vue.js": "vue", "vuejs": "vue", "express.js": "express",
    "expressjs": "express", "tailwind css": "tailwind", "tailwindcss": "tailwind",
    "amazon web services": "aws", "google cloud": "gcp", "google cloud platform": "gcp",
    "ml": "machine learning", "cpp": "c++", "c plus plus": "c++", "csharp": "c#",
    "dotnet": ".net", "sklearn": "scikit-learn", "next": "next.js", "nextjs": "next.js",
    "restful": "rest api", "rest": "rest api", "cicd": "ci/cd", "ci cd": "ci/cd",
    "artificial intelligence": "ai", "springboot": "spring boot", "mongo": "mongodb",
}

# Short / common-English skill names are only detected when written in their skill form
# (e.g. "Go" or "AI" capitalised), so "I want to go to work" never yields the Go language.
_CASE_SENSITIVE_SKILLS = {"go": "Go", "ai": "AI", "express": "Express", "shell": "Shell"}
_CASE_SENSITIVE_NEGATIVE_FOLLOW = r"(?!\s+(?:find|get|look|search|show|to|for|and\s+then|me)\b)"

ROLE_SYNONYMS = {
    "developer": "engineer", "dev": "engineer", "programmer": "engineer", "coder": "engineer",
    "swe": "engineer", "internship": "intern", "interns": "intern",
}
GENERIC_ROLE_TOKENS = {"engineer", "manager", "specialist", "consultant", "analyst", "associate"}
ROLE_WORDS = {
    "backend", "frontend", "fullstack", "devops", "cloud", "engineer", "developer", "designer",
    "manager", "architect", "intern", "scientist", "analyst", "lead", "administrator",
    "specialist", "consultant", "programmer", "tester", "qa", "sre", "data", "mobile", "web",
    "software", "security", "product", "support", "ml", "ai",
}
LEVEL_GROUPS = {
    "junior": "junior", "jr": "junior", "entry": "junior", "fresher": "junior", "graduate": "junior",
    "beginner": "junior", "senior": "senior", "sr": "senior", "principal": "senior", "staff": "senior",
    "lead": "senior", "mid": "mid", "intermediate": "mid",
}
LEVEL_JOB_WORDS = {
    "junior": {"junior", "jr", "entry", "fresher", "graduate", "intern", "associate", "beginner"},
    "senior": {"senior", "sr", "principal", "staff", "lead", "expert"},
    "mid": {"mid", "intermediate", "middle"},
}
SEARCH_STOP_WORDS = {
    "i", "me", "my", "we", "our", "you", "your", "a", "an", "the", "and", "or", "in", "on", "at",
    "to", "for", "with", "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "from", "up", "down", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "looking", "searching", "want", "need",
    "find", "get", "show", "give", "list", "search", "jobs", "job", "role", "roles", "position",
    "positions", "opening", "openings", "work", "hire", "hiring", "please", "can", "could",
    "would", "good", "best", "great", "top", "some", "any", "all", "new", "open", "available",
    "opportunity", "opportunities", "career", "careers", "vacancy", "vacancies", "skills",
    "skill", "experience", "experienced", "matching", "match", "matches", "related", "using",
    "based", "who", "that", "which", "where", "like", "similar", "relevant", "suitable", "fit",
    "ideal", "knowledge", "proficient", "strong", "resume", "profile", "im", "ive", "of", "as",
    "by", "near", "around", "located", "that", "this", "these", "those", "etc", "kind", "type",
    "im", "it", "s", "t", "ll", "re", "ve", "d", "m",
}
_JOB_TYPE_WORDS = {
    "full", "part", "time", "fulltime", "parttime", "intern", "internship", "contract",
    "contractor", "freelance", "temporary", "remote", "hybrid", "onsite", "on-site",
}
_JOB_TYPE_DISPLAY = {
    "full-time": "Full-time", "part-time": "Part-time", "internship": "Internship",
    "contract": "Contract", "remote": "Remote", "hybrid": "Hybrid",
}
_REMOTE_LOCATION_WORDS = ("remote", "anywhere", "worldwide", "work from home", "wfh")


def _norm_text(text: str) -> str:
    t = (text or "").lower()
    t = re.sub(r"\bfront[\s\-_]?end\b", "frontend", t)
    t = re.sub(r"\bback[\s\-_]?end\b", "backend", t)
    t = re.sub(r"\bfull[\s\-_]?stack\b", "fullstack", t)
    t = re.sub(r"\bdev[\s\-_]ops\b", "devops", t)
    t = re.sub(r"\bfull[\s\-_]?time\b", "full-time", t)
    t = re.sub(r"\bpart[\s\-_]?time\b", "part-time", t)
    return t


_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#.\-]*[a-z0-9+#]|[a-z0-9]")


def _raw_tokens(text: str) -> List[str]:
    return _TOKEN_RE.findall(_norm_text(text))


def _stem(word: str) -> str:
    w = word
    if len(w) > 6 and w.endswith("ing"):
        w = w[:-3]
    elif len(w) > 4 and w.endswith("ies"):
        w = w[:-3] + "y"
    elif len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        w = w[:-1]
    return ROLE_SYNONYMS.get(w, w)


def _stem_tokens(text: str, drop_stop: bool = False) -> List[str]:
    out = []
    for tok in _raw_tokens(text):
        if drop_stop and (tok in SEARCH_STOP_WORDS or len(tok) < 2):
            continue
        out.append(_stem(tok))
    return out


def canon_skill(skill: str) -> str:
    s = re.sub(r"\s+", " ", (skill or "").strip().lower())
    return SKILL_ALIASES.get(s, s)


def _term_regex(term: str) -> "re.Pattern":
    return re.compile(r"(?<![a-z0-9+#])" + re.escape(term.lower()) + r"(?![a-z0-9+#])")


# surface form (lowercase) -> canonical skill, and canonical -> all surface forms / display name
_SURFACE_TO_CANON: Dict[str, str] = {}
_CANON_SURFACES: Dict[str, set] = {}
_CANON_DISPLAY: Dict[str, str] = {}
for _sk in POPULAR_TECH_SKILLS:
    _c = canon_skill(_sk)
    _SURFACE_TO_CANON[_sk.lower()] = _c
    _CANON_SURFACES.setdefault(_c, set()).add(_sk.lower())
    _CANON_DISPLAY.setdefault(_c, _sk)
for _alias, _c in SKILL_ALIASES.items():
    if _c in _CANON_SURFACES or any(canon_skill(s) == _c for s in POPULAR_TECH_SKILLS):
        _SURFACE_TO_CANON[_alias] = _c
        _CANON_SURFACES.setdefault(_c, set()).add(_alias)
_SURFACE_REGEX = {s: _term_regex(s) for s in _SURFACE_TO_CANON}


def display_skill(canon: str) -> str:
    return _CANON_DISPLAY.get(canon, canon.title() if canon.islower() else canon)


def find_skills_in_text(text: str) -> List[str]:
    """Canonical skills mentioned in free text (word-boundary safe, symbol safe, ordered by position)."""
    if not text:
        return []
    low = text.lower()
    hits: Dict[str, int] = {}
    for surface, canon in _SURFACE_TO_CANON.items():
        if canon in _CASE_SENSITIVE_SKILLS:
            continue
        m = _SURFACE_REGEX[surface].search(low)
        if m and (canon not in hits or m.start() < hits[canon]):
            hits[canon] = m.start()
    for canon, form in _CASE_SENSITIVE_SKILLS.items():
        m = re.search(r"(?<![A-Za-z0-9+#])" + re.escape(form) + r"(?![A-Za-z0-9+#])" + _CASE_SENSITIVE_NEGATIVE_FOLLOW, text)
        if m and canon not in hits:
            hits[canon] = m.start()
    if re.search(r"(?<![a-z0-9+#])golang(?![a-z0-9+#])", low) and "go" not in hits:
        hits["go"] = low.index("golang")
    return [c for c, _ in sorted(hits.items(), key=lambda kv: kv[1])]


def _job_mentions_skill(canon: str, text_lower: str) -> bool:
    """Whether a free-text blob (description/title) mentions the skill; ambiguous words are skipped."""
    if canon in _CASE_SENSITIVE_SKILLS:
        return False
    surfaces = _CANON_SURFACES.get(canon) or {canon}
    return any(_term_regex(s).search(text_lower) for s in surfaces)


def _canon_job_type(text: Optional[str]) -> str:
    t = _norm_text(str(text or "")).strip()
    if not t:
        return ""
    if "full-time" in t:
        return "full-time"
    if "part-time" in t:
        return "part-time"
    if "intern" in t:
        return "internship"
    if re.search(r"contract|freelance|temporary|temp\b", t):
        return "contract"
    if "remote" in t:
        return "remote"
    if "hybrid" in t:
        return "hybrid"
    return t


def _job_is_remote(job: Any) -> bool:
    blob = f"{(job.location or '')} {(job.job_type or '')}".lower()
    return any(w in blob for w in _REMOTE_LOCATION_WORDS)


def _location_matches(job: Any, location: str) -> bool:
    loc = _norm_text(location).strip()
    if not loc:
        return True
    if any(w in loc for w in _REMOTE_LOCATION_WORDS):
        return _job_is_remote(job)
    job_loc = _norm_text(f"{job.location or ''}")
    if loc in job_loc:
        return True
    job_tokens = set(_raw_tokens(job_loc))
    loc_tokens = [t for t in _raw_tokens(loc) if t not in SEARCH_STOP_WORDS]
    return bool(loc_tokens) and all(t in job_tokens for t in loc_tokens)


def _job_type_matches(job: Any, job_type: str) -> bool:
    want = _canon_job_type(job_type)
    if not want:
        return True
    if want == "remote":
        return _job_is_remote(job)
    if want == "hybrid":
        return "hybrid" in f"{job.location or ''} {job.job_type or ''}".lower()
    have = _canon_job_type(job.job_type)
    if want == "internship":
        return have == "internship" or "intern" in (job.title or "").lower()
    return have == want or want in (job.job_type or "").lower()


def _company_matches(job: Any, company: str) -> bool:
    c = _norm_text(company).strip()
    if not c:
        return True
    job_comp = _norm_text(job.company or "")
    if c in job_comp:
        return True
    comp_tokens = set(_raw_tokens(job_comp))
    toks = [t for t in _raw_tokens(c) if t not in SEARCH_STOP_WORDS]
    return bool(toks) and all(t in comp_tokens for t in toks)


class _JobView:
    """Pre-computed, normalised view of a job used by the matchers."""

    def __init__(self, job: Any):
        self.job = job
        self.title_tokens = set(_stem_tokens(job.title or ""))
        self.desc_tokens = set(_stem_tokens(job.description or ""))
        self.company_tokens = set(_stem_tokens(job.company or ""))
        self.level_tokens = set(_stem_tokens(getattr(job, "experience_level", "") or ""))
        self.title_lower = (job.title or "").lower()
        self.desc_lower = ((job.description or "") + " " + (job.title or "")).lower()
        self.required = {canon_skill(s.skill_name) for s in job.skills if s.is_required}
        self.preferred = {canon_skill(s.skill_name) for s in job.skills if not s.is_required}
        self.skill_names_lower = [s.skill_name.lower() for s in job.skills]
        self.skill_tokens = set()
        for s in job.skills:
            self.skill_tokens.update(_stem_tokens(s.skill_name))

    def has_skill(self, canon: str) -> float:
        if canon in self.required:
            return 1.0
        if canon in self.preferred:
            return 0.85
        if _job_mentions_skill(canon, self.desc_lower):
            return 0.6
        return 0.0

    def token_credit(self, tok: str) -> float:
        if tok in self.title_tokens:
            return 1.0
        if tok in self.skill_tokens or tok in self.company_tokens or tok in self.level_tokens:
            return 0.6
        if tok in self.desc_tokens:
            return 0.5
        return 0.0


def _matches_keyword_filter(view: _JobView, keyword: str) -> bool:
    kw = keyword.strip().lower()
    if not kw:
        return True
    blob = f"{view.job.title or ''} {view.job.company or ''} {view.job.description or ''} {' '.join(view.skill_names_lower)}".lower()
    if kw in blob:
        return True
    toks = _stem_tokens(keyword, drop_stop=True)
    if not toks:
        return True
    pool = view.title_tokens | view.desc_tokens | view.company_tokens | view.skill_tokens
    return all(t in pool for t in toks)


def _matches_skill_filter(view: _JobView, skill: str) -> bool:
    raw = skill.strip().lower()
    if not raw:
        return True
    canon = canon_skill(raw)
    if view.has_skill(canon) > 0:
        return True
    return any(raw in name for name in view.skill_names_lower)


# ---------------------------------------------------------------------------
# Natural-language query parsing
# ---------------------------------------------------------------------------
def parse_natural_language_search(query: str) -> Dict[str, Any]:
    """Parse user's natural language search query into structured parameters."""
    return parse_search_with_feedback(query)[0]


_SEARCH_PROMPT = (
    "You convert a job-seeker's request into search filters for a job board.\n"
    "Return ONLY a JSON object with exactly these keys:\n"
    "  \"title\": job role words only, e.g. \"Backend Engineer\" (no skills, no location) or null,\n"
    "  \"company\": company name or null,\n"
    "  \"location\": city/state/country, or \"Remote\" if the person wants remote work, or null,\n"
    "  \"job_type\": one of \"Full-time\", \"Part-time\", \"Internship\", \"Contract\", \"Remote\" or null,\n"
    "  \"skills\": list of technologies/tools/languages explicitly requested (standard names, e.g. \"React\", \"PostgreSQL\"),\n"
    "  \"keyword\": any other topic word worth matching (domain, seniority) or null.\n"
    "Never invent values the request does not imply. Use null / [] when absent.\n"
    "Example: \"remote junior python roles at Acme\" -> "
    "{\"title\": null, \"company\": \"Acme\", \"location\": \"Remote\", \"job_type\": null, "
    "\"skills\": [\"Python\"], \"keyword\": \"junior\"}\n"
)


def parse_search_with_feedback(query: str) -> tuple:
    """Like parse_natural_language_search, but also returns validation issues (FR-SCH-04).

    Gemini's answer is validated, then any filter it missed is filled in from the local
    heuristic parser, so a weak or empty AI answer never degrades the search."""
    clean_query = (query or "").strip()
    if not clean_query:
        return {}, []

    heuristic = local_heuristic_search_parser(clean_query)

    if GEMINI_API_KEY:
        prompt = _SEARCH_PROMPT + "Request: " + json.dumps(clean_query[:400])
        parsed = call_best_ai_json(prompt, system_prompt="Output only valid JSON.")
        if parsed and isinstance(parsed, dict):
            cleaned, issues = validate_search_params(parsed)
            for key in ("title", "company", "location", "job_type"):
                if not cleaned.get(key) and heuristic.get(key):
                    cleaned[key] = heuristic[key]
            merged_skills: List[str] = []
            seen = set()
            for s in list(cleaned.get("skills", [])) + list(heuristic.get("skills", [])):
                c = canon_skill(s)
                if c not in seen:
                    seen.add(c)
                    merged_skills.append(s)
            if merged_skills:
                cleaned["skills"] = merged_skills
            if not cleaned:
                cleaned = heuristic
            return cleaned, issues

    return heuristic, []


def local_heuristic_search_parser(query: str) -> Dict[str, Any]:
    """Offline parser for natural language job search queries."""
    q = (query or "").strip()
    if not q:
        return {}
    low = _norm_text(q)
    params: Dict[str, Any] = {}
    consumed: set = set()

    # Skills (canonical, word-boundary safe)
    skill_canons = find_skills_in_text(q)
    if skill_canons:
        params["skills"] = [display_skill(c) for c in skill_canons]
        for c in skill_canons:
            for surface in _CANON_SURFACES.get(c, {c}):
                consumed.update(_raw_tokens(surface))
            consumed.update(_raw_tokens(c))
        if "go" in skill_canons:
            consumed.add("golang")

    # Job type and remote
    type_hits = re.findall(r"\b(full-time|part-time|internships?|interns?|contractor|contract|freelance|temporary|remote|hybrid)\b", low)
    explicit_type = next((_canon_job_type(t) for t in type_hits if t != "remote"), "")
    wants_remote = "remote" in type_hits
    consumed.update(_JOB_TYPE_WORDS)

    # Location: "in Bangalore", "near Austin, TX" (stops at filler words, skills and role words)
    location = ""
    m = re.search(r"\b(?:in|near|around|based in|located in)\s+([A-Za-z][A-Za-z.,\-\s]{1,60})", q)
    if m:
        words: List[str] = []
        for w in m.group(1).split():
            wl = w.lower().strip(",.")
            if (wl in SEARCH_STOP_WORDS or wl in ROLE_WORDS or wl in _JOB_TYPE_WORDS
                    or wl in LEVEL_GROUPS or find_skills_in_text(w.strip(",."))
                    or wl in ("with", "using", "skills", "role", "roles")):
                break
            words.append(w.strip(","))
            if w.endswith(",") is False and len(words) >= 4:
                break
            if len(words) >= 4:
                break
        location = " ".join(words).strip(" ,.")
    if explicit_type:
        params["job_type"] = _JOB_TYPE_DISPLAY.get(explicit_type, explicit_type.title())
        if wants_remote and not location:
            location = "Remote"
    elif wants_remote:
        if location:
            params["job_type"] = "Remote"
        else:
            location = "Remote"
    if location:
        params["location"] = location
        consumed.update(_raw_tokens(location))

    # Company: "at CloudScale Systems" (capitalised phrase that is not a skill/role/place word)
    cm = re.search(r"\b(?:at|for|by)\s+([A-Z][\w&.\-]*(?:\s+[A-Z][\w&.\-]*){0,3})", q)
    if cm:
        cand_words = []
        for w in cm.group(1).split():
            wl = w.lower().strip(".,")
            if (wl in SEARCH_STOP_WORDS or wl in ROLE_WORDS or wl in _JOB_TYPE_WORDS
                    or wl in LEVEL_GROUPS or find_skills_in_text(w)):
                break
            cand_words.append(w)
        company = " ".join(cand_words).strip(" .,")
        if company and company.lower() != location.lower():
            params["company"] = company
            consumed.update(_raw_tokens(company))

    # Remaining words describe the role / topic
    leftovers = []
    for tok in _raw_tokens(q):
        if tok in SEARCH_STOP_WORDS or len(tok) < 2 or tok in consumed or tok in LEVEL_GROUPS:
            continue
        leftovers.append(tok)
    if leftovers:
        phrase = " ".join(leftovers)
        if any(t in ROLE_WORDS or _stem(t) == "engineer" for t in leftovers):
            params["title"] = phrase
        else:
            params["keyword"] = phrase

    if not params:
        params["keyword"] = q
    return params


ALLOWED_SEARCH_KEYS = ("title", "company", "location", "job_type", "skills", "keyword")
_MAX_PARAM_LEN = 120


def validate_search_params(params: dict) -> tuple:
    """Validate candidate search parameters. Silently drops unrecognized keys.

    Returns:
        tuple: (cleaned_params: dict, validation_issues: list[str])
    """
    if not isinstance(params, dict):
        return {}, ["Search parameters must be a dictionary"]

    cleaned = {}
    issues = []

    for key, value in params.items():
        if key not in ALLOWED_SEARCH_KEYS:
            continue

        if value is None:
            continue

        if key == "skills":
            if not isinstance(value, list):
                issues.append("'skills' must be a list of strings")
                continue
            clean_skills = [
                str(s).strip() for s in value
                if str(s).strip() and len(str(s).strip()) <= _MAX_PARAM_LEN
            ]
            if clean_skills:
                cleaned["skills"] = clean_skills
            continue

        if not isinstance(value, str):
            issues.append(f"'{key}' must be text and was ignored")
            continue
        value = value.strip()
        if not value or value.lower() in ("null", "none", "n/a"):
            continue
        if len(value) > _MAX_PARAM_LEN:
            issues.append(f"'{key}' was too long and was ignored")
            continue

        cleaned[key] = value

    return cleaned, issues


def validate_and_clean_search_params(params: dict) -> dict:
    return validate_search_params(params)[0]


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------
_W_TOPIC, _W_SKILLS, _W_COMPANY, _W_LOCATION, _W_TYPE, _W_LEVEL = 35.0, 35.0, 10.0, 12.0, 8.0, 6.0
_FALLBACK_PENALTY = 0.6
_PERSONALIZATION = 0.15  # share of the final score that comes from the candidate's resume/skills


def _candidate_ats(view: _JobView, combined_resume: str, cand_skills: set) -> Dict[str, Any]:
    job = view.job
    req_names = [s.skill_name for s in job.skills if s.is_required]
    pref_names = [s.skill_name for s in job.skills if not s.is_required]
    ats = calculate_ats_score(req_names, pref_names, combined_resume)
    matched_req = list(ats["matched_required"])
    missing_req = list(ats["missing_required"])
    matched_pref = list(ats["matched_preferred"])
    missing_pref = list(ats["missing_preferred"])
    for lst_missing, lst_matched in ((missing_req, matched_req), (missing_pref, matched_pref)):
        for name in list(lst_missing):
            if canon_skill(name) in cand_skills:
                lst_missing.remove(name)
                lst_matched.append(name)
    tr, tp, mr, mp = len(req_names), len(pref_names), len(matched_req), len(matched_pref)
    if tr == 0:
        score = 100.0 if (tp == 0 or mp == tp) else (mp / tp) * 100.0
    elif tp == 0:
        score = 100.0 * (mr / tr)
    else:
        score = (70.0 * (mr / tr)) + (30.0 * (mp / tp))
    return {
        "score": score, "matched_req": matched_req, "missing_req": missing_req,
        "matched_pref": matched_pref, "missing_pref": missing_pref,
    }


def _level(score: float) -> str:
    return "High Match" if score >= 75.0 else "Good Match" if score >= 50.0 else "Potential Match"


def recommend_and_rank_jobs(
    jobs: List[Any],
    resume_text: str = "",
    candidate_skills: str = "",
    candidate_headline: str = "",
    query: str = "",
    location_filter: str = "",
    job_type_filter: str = "",
    skill_filter: str = "",
    parsed_query: Optional[Dict[str, Any]] = None,
    keyword_filter: str = "",
) -> List[Dict[str, Any]]:
    """Filter and rank jobs for a candidate.

    * Explicit filters (location / job type / skill / keyword) are HARD filters.
    * A natural-language query decides relevance: jobs that do not match the requested role or
      skills are dropped, and jobs are ordered by how fully they satisfy everything asked for.
      Location / job-type / company requested in the prompt must match too; if nothing satisfies
      them, the closest role/skill matches are returned (clearly labelled) instead of an empty page.
    * The candidate's resume/skills personalise the order (and drive the order when no query).
    """
    if not jobs:
        return []

    clean_q = (query or "").strip()
    if parsed_query is None:
        parsed_query = parse_natural_language_search(clean_q) if clean_q else {}
    parsed_query = parsed_query or {}

    combined_resume = "\n".join(x for x in (resume_text, candidate_skills, candidate_headline) if x)
    cand_skills = {canon_skill(s) for s in (candidate_skills or "").split(",") if s.strip()}
    cand_skills.update(canon_skill(s) for s in extract_skills_from_text(combined_resume, use_ai=False))
    personalised = bool(combined_resume.strip())

    views = [_JobView(j) for j in jobs]

    # ---- 1. hard filters (explicit UI filters) -------------------------------------------------
    if keyword_filter and keyword_filter.strip():
        views = [v for v in views if _matches_keyword_filter(v, keyword_filter)]
    if location_filter and location_filter.strip():
        views = [v for v in views if _location_matches(v.job, location_filter)]
    if job_type_filter and job_type_filter.strip():
        views = [v for v in views if _job_type_matches(v.job, job_type_filter)]
    if skill_filter and skill_filter.strip():
        views = [v for v in views if _matches_skill_filter(v, skill_filter)]
    if not views:
        return []

    # ---- 2. understand the prompt ----------------------------------------------------------------
    req_skills: List[str] = []
    for s in (parsed_query.get("skills") or []) if isinstance(parsed_query.get("skills"), list) else []:
        c = canon_skill(str(s))
        if c and c not in req_skills:
            req_skills.append(c)
    for c in find_skills_in_text(clean_q):
        if c not in req_skills:
            req_skills.append(c)

    # explicit UI filters win over a conflicting location/type found inside the prompt
    q_location = "" if (location_filter or "").strip() else str(parsed_query.get("location") or "").strip()
    q_job_type = "" if (job_type_filter or "").strip() else str(parsed_query.get("job_type") or "").strip()
    q_company = str(parsed_query.get("company") or "").strip()

    consumed: set = set()
    for c in req_skills:
        for surface in _CANON_SURFACES.get(c, {c}):
            consumed.update(_raw_tokens(surface))
        consumed.update(_raw_tokens(c))
    for text in (parsed_query.get("location"), parsed_query.get("company"), q_job_type):
        consumed.update(_raw_tokens(str(text or "")))
    consumed.update(_JOB_TYPE_WORDS)
    consumed.add("golang")

    levels = {LEVEL_GROUPS[t] for t in _raw_tokens(clean_q) if t in LEVEL_GROUPS}
    topic_tokens: List[str] = []
    for source in (clean_q, str(parsed_query.get("title") or ""), str(parsed_query.get("keyword") or "")):
        for tok in _raw_tokens(source):
            if tok in SEARCH_STOP_WORDS or tok in consumed or tok in LEVEL_GROUPS or len(tok) < 2:
                continue
            st = _stem(tok)
            if st not in topic_tokens:
                topic_tokens.append(st)

    specific_topic = [t for t in topic_tokens if t not in GENERIC_ROLE_TOKENS]
    has_query = bool(topic_tokens or req_skills or q_location or q_job_type or q_company or levels)

    # ---- 3. recommendations mode (no usable query): resume/skills drive the order -------------
    results: List[Dict[str, Any]] = []
    if not has_query:
        head_words = {w.lower() for w in re.split(r"\W+", candidate_headline or "") if len(w) > 3}
        for v in views:
            ats = _candidate_ats(v, combined_resume, cand_skills)
            score = ats["score"]
            reasons = []
            if head_words and any(w in v.title_lower for w in head_words):
                score = min(100.0, score + 5.0)
                reasons.append("Role title fits your headline")
            if ats["matched_req"]:
                reasons.append(f"Covers required skills: {', '.join(ats['matched_req'][:3])}")
            if ats["matched_pref"]:
                reasons.append(f"Bonus preferred skills: {', '.join(ats['matched_pref'][:2])}")
            if ats["missing_req"]:
                reasons.append(f"Missing required: {', '.join(ats['missing_req'][:2])}")
            results.append(_result(v.job, score, ats, reasons))
        results.sort(key=lambda r: r["match_score"], reverse=True)
        return results

    # ---- 4. search mode ----------------------------------------------------------------------------
    scored = []
    for v in views:
        ats = _candidate_ats(v, combined_resume, cand_skills) if personalised else None
        reasons: List[str] = []
        total_w, got = 0.0, 0.0

        # topic / role words (generic words like "engineer" count less than "backend")
        topic_frac = None
        if topic_tokens:
            weights = {t: (0.4 if t in GENERIC_ROLE_TOKENS else 1.0) for t in topic_tokens}
            topic_frac = sum(weights[t] * v.token_credit(t) for t in topic_tokens) / sum(weights.values())
            total_w += _W_TOPIC
            got += _W_TOPIC * topic_frac
            in_title = [t for t in topic_tokens if t in v.title_tokens]
            if in_title:
                reasons.append(f"Role title matches your search: '{v.job.title}'")
            elif topic_frac > 0:
                reasons.append("Description matches your search terms")

        # requested skills
        skills_frac = None
        if req_skills:
            credits = {c: v.has_skill(c) for c in req_skills}
            skills_frac = sum(credits.values()) / len(req_skills)
            total_w += _W_SKILLS
            got += _W_SKILLS * skills_frac
            hit = [display_skill(c) for c, cr in credits.items() if cr > 0]
            miss = [display_skill(c) for c, cr in credits.items() if cr == 0]
            if hit:
                reasons.append(f"Covers requested skill(s): {', '.join(hit[:4])}")
            if miss:
                reasons.append(f"Does not list: {', '.join(miss[:3])}")

        # seniority (soft: affects score, never excludes)
        if levels:
            total_w += _W_LEVEL
            words = set(_raw_tokens(f"{v.job.title or ''} {getattr(v.job, 'experience_level', '') or ''}"))
            if any(words & LEVEL_JOB_WORDS[lv] for lv in levels):
                got += _W_LEVEL
                reasons.append("Fits the experience level you asked for")

        # constraints from the prompt
        constraints_ok = True
        if q_location:
            total_w += _W_LOCATION
            if _location_matches(v.job, q_location):
                got += _W_LOCATION
                reasons.append(f"Matches location '{q_location}' ({v.job.location})")
            else:
                constraints_ok = False
        if q_job_type:
            total_w += _W_TYPE
            if _job_type_matches(v.job, q_job_type):
                got += _W_TYPE
                reasons.append(f"Matches {q_job_type} requirement")
            else:
                constraints_ok = False
        if q_company:
            total_w += _W_COMPANY
            if _company_matches(v.job, q_company):
                got += _W_COMPANY
                reasons.append(f"Matches company '{v.job.company}'")
            else:
                constraints_ok = False

        # relevance gate: the role/skills part of the prompt must actually match
        gates = []
        if specific_topic:
            sp_frac = sum(v.token_credit(t) for t in specific_topic) / len(specific_topic)
            gates.append(sp_frac >= 0.5)
        elif topic_tokens and not req_skills:
            gates.append((topic_frac or 0) >= 0.5)
        if req_skills:
            gates.append((skills_frac or 0) > 0)
        content_ok = any(gates) if gates else True

        query_score = (got / total_w * 100.0) if total_w else 0.0
        scored.append((v, ats, query_score, reasons, content_ok, constraints_ok, bool(gates)))

    relevant = [s for s in scored if s[4]]
    strict = [s for s in relevant if s[5]]
    # Fall back to "closest roles" only when a role/skill was requested; a constraint-only
    # prompt (e.g. just a company or city) with no exact match returns nothing.
    fallback_used = not strict and bool(relevant) and relevant[0][6]
    chosen = strict if strict else (relevant if fallback_used else [])

    for v, ats, query_score, reasons, _content_ok, _constraints_ok, _has_content in chosen:
        score = query_score
        if fallback_used:
            score *= _FALLBACK_PENALTY
            reasons.append("No exact match for the requested location/type/company, showing closest roles")
        if personalised and ats is not None:
            score = score * (1.0 - _PERSONALIZATION) + ats["score"] * _PERSONALIZATION
            if ats["score"] >= 60:
                reasons.append(f"Resume ATS match: {int(ats['score'])}%")
        results.append(_result(v.job, score, ats, reasons))

    results.sort(key=lambda r: r["match_score"], reverse=True)
    return results


def _result(job: Any, score: float, ats: Optional[Dict[str, Any]], reasons: List[str]) -> Dict[str, Any]:
    score_val = round(min(100.0, max(0.0, score)), 1)
    if ats is None:
        required = [s.skill_name for s in job.skills if s.is_required]
        preferred = [s.skill_name for s in job.skills if not s.is_required]
        matched, missing = [], required + preferred
    else:
        matched = ats["matched_req"] + ats["matched_pref"]
        missing = ats["missing_req"] + ats["missing_pref"]
    return {
        "job": job,
        "match_score": score_val,
        "match_level": _level(score_val),
        "matched_skills": matched,
        "missing_skills": missing,
        "reasoning": " • ".join(reasons) if reasons else "Matches general technical profile.",
    }
