import re
import io
from typing import List, Tuple, Dict, Any
from pypdf import PdfReader
from app.config import MAX_RESUME_SIZE_BYTES

def normalize_skill(skill: str) -> str:
    """Normalize skill name for matching (e.g., 'React.js' -> 'react', 'C++' -> 'c++')."""
    s = skill.strip().lower()
    # Normalize common synonyms and punctuation
    s = re.sub(r'\.js$', '', s)
    s = re.sub(r'[\-_/]', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract plain text from uploaded PDF bytes."""
    if len(pdf_bytes) > MAX_RESUME_SIZE_BYTES:
        raise ValueError(f"Resume exceeds maximum allowed size of 5 MB ({len(pdf_bytes)} bytes)")
    
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                extracted_text.append(t)
        return "\n".join(extracted_text)
    except Exception as e:
        raise ValueError(f"Failed to extract text from PDF: {str(e)}")

def match_skills_in_text(skill_names: List[str], text: str) -> Tuple[List[str], List[str]]:
    """Determine which skills are present in the resume text."""
    lowered_text = " " + text.lower() + " "
    matched = []
    missing = []

    for orig_skill in skill_names:
        norm = normalize_skill(orig_skill)
        # Search using regex word boundary or literal inclusion for symbols like C++, C#
        pattern = r'(?:\b|_)' + re.escape(norm) + r'(?:\b|_)'
        if re.search(pattern, lowered_text) or norm in lowered_text:
            matched.append(orig_skill)
        else:
            # Also check original skill name directly
            pattern_orig = r'(?:\b|_)' + re.escape(orig_skill.lower()) + r'(?:\b|_)'
            if re.search(pattern_orig, lowered_text) or orig_skill.lower() in lowered_text:
                matched.append(orig_skill)
            else:
                missing.append(orig_skill)

    return matched, missing

def calculate_ats_score(
    required_skills: List[str],
    preferred_skills: List[str],
    resume_text: str
) -> Dict[str, Any]:
    """
    Deterministically calculate ATS score per CS455 Deliverable 1 FR-ANA-04, 05, 06.
    FR-ANA-05: With required & preferred: Score = 70 * (MR / TR) + 30 * (MP / TP)
    FR-ANA-06: With no preferred: Score = 100 * (MR / TR)
    """
    matched_req, missing_req = match_skills_in_text(required_skills, resume_text)
    matched_pref, missing_pref = match_skills_in_text(preferred_skills, resume_text)

    tr = len(required_skills)
    tp = len(preferred_skills)
    mr = len(matched_req)
    mp = len(matched_pref)

    if tr == 0:
        # Fallback if no required skills were configured (should not happen per FR-REC-01)
        raw_score = 100.0 if (tp == 0 or mp == tp) else (mp / tp) * 100.0
        formula = "Fallback: No required skills defined"
    elif tp == 0:
        # FR-ANA-06: With no preferred skills: Score = 100 * (MR / TR)
        raw_score = 100.0 * (mr / tr)
        formula = f"Score = 100 * ({mr} / {tr}) = {raw_score:.1f}%"
    else:
        # FR-ANA-05: With required and preferred skills: Score = 70 * (MR / TR) + 30 * (MP / TP)
        req_component = 70.0 * (mr / tr)
        pref_component = 30.0 * (mp / tp)
        raw_score = req_component + pref_component
        formula = f"Score = 70 * ({mr} / {tr}) + 30 * ({mp} / {tp}) = {req_component:.1f} + {pref_component:.1f} = {raw_score:.1f}%"

    score = round(max(0.0, min(100.0, raw_score)), 1)

    return {
        "score": score,
        "formula": formula,
        "matched_required": matched_req,
        "missing_required": missing_req,
        "matched_preferred": matched_pref,
        "missing_preferred": missing_pref,
        "all_matched": matched_req + matched_pref,
        "all_missing": missing_req + missing_pref,
        "mr": mr,
        "tr": tr,
        "mp": mp,
        "tp": tp
    }
