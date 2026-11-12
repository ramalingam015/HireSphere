import re
import io
from typing import List, Tuple, Dict, Any
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
    """Extract plain text from uploaded PDF bytes supporting PyMuPDF and pypdf."""
    if len(pdf_bytes) > MAX_RESUME_SIZE_BYTES:
        raise ValueError(f"Resume exceeds maximum allowed size of 5 MB ({len(pdf_bytes)} bytes)")
    
    extracted_text = []

    # 1. Try PyMuPDF (pymupdf / fitz)
    try:
        import pymupdf
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            t = page.get_text()
            if t:
                extracted_text.append(t)
        doc.close()
        if extracted_text:
            return "\n".join(extracted_text)
    except Exception:
        pass

    # 2. Try pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                extracted_text.append(t)
        if extracted_text:
            return "\n".join(extracted_text)
    except Exception:
        pass

    # 3. Pure text fallback
    try:
        decoded = pdf_bytes.decode("utf-8", errors="ignore")
        if any(c.isalnum() for c in decoded):
            return decoded
    except Exception:
        pass

    return ""

def match_skills_in_text(skill_names: List[str], text: str) -> Tuple[List[str], List[str]]:
    """
    Determine which skills are present in the resume text with high precision.
    Special guard prevents false positives for 'C' language from general text,
    grades, or bullet points.
    """
    lowered_text = " " + text.lower() + " "
    matched = []
    missing = []

    for orig_skill in skill_names:
        clean = orig_skill.strip()
        norm = normalize_skill(clean)
        if not norm:
            continue

        # 1. High-precision handling for C programming language
        if norm in ("c", "c lang", "c language", "c programming"):
            # Explicit C language phrases
            explicit_c = re.search(r'\b(?:c\s*programming|c\s*language|ansi\s*c|c\s*\/\s*c\+\+|embedded\s*c)\b', lowered_text)
            # Delimited technical list item (e.g., "Python, C, Java" or "Skills: C / C++")
            delimited_c = re.search(r'(?<=[\s,;/|\(\[])c(?=[\s,;/|\)\]]|\Z)', lowered_text)
            # Check for non-skill occurrences like "Grade: C" or "C. Work Experience"
            is_bullet_or_grade = re.search(r'(?:grade\s*[:\-]?\s*c\b|section\s+c\b|class\s+c\b|(?:\b|^)c\.\s+[a-z])', lowered_text)

            if explicit_c or (delimited_c and not is_bullet_or_grade):
                matched.append(orig_skill)
            else:
                missing.append(orig_skill)
            continue

        # 2. Languages / frameworks with symbols (C++, C#, .NET, Node.js)
        if any(ch in clean for ch in ["+", "#", "."]):
            sym_pattern = r'(?:^|[\s,;/()|\[\]])' + re.escape(clean.lower()) + r'(?:$|[\s,;/()|\[\]])'
            if re.search(sym_pattern, lowered_text):
                matched.append(orig_skill)
            else:
                missing.append(orig_skill)
            continue

        # 3. Standard technical skills using word boundaries (NEVER loose substring)
        pattern = r'(?:\b|_)' + re.escape(norm) + r'(?:\b|_)'
        pattern_orig = r'(?:\b|_)' + re.escape(clean.lower()) + r'(?:\b|_)'
        if re.search(pattern, lowered_text) or re.search(pattern_orig, lowered_text):
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
