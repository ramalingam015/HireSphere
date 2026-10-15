# HireSphere — Role-Based Recruitment & ATS Platform
**CS455 Deliverable 1 — Group 10**

HireSphere is a full-stack, role-based job recruitment and interview scheduling system engineered to satisfy the CS455 Deliverable 1 specifications. The system features **Student (Candidate)**, **Recruiter**, and **Administrator** portals, automated ATS resume-job compatibility scoring, atomic interview slot reservations with row locking, spam moderation, and direct chat for interview coordination.

---

## 🚀 Quick Start (Zero-Configuration Local Run)

### Windows (1-Click Launch)
Double-click `run.bat` or run in PowerShell / Command Prompt:
```cmd
run.bat
```
This automatically initializes the database, seeds test accounts, launches the FastAPI server at `http://localhost:8000`, and opens your browser.

### Linux / macOS
```bash
chmod +x run.sh
./run.sh
```

### Manual / Developer Mode
1. **Backend Server:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```
   The backend serves both the API (`http://localhost:8000/api`) and the bundled React frontend (`http://localhost:8000`).
   Interactive Swagger documentation: `http://localhost:8000/docs`

2. **Frontend (Optional hot-reload Vite server):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🔑 Pre-Configured Demo Credentials

The platform includes a top-bar **1-Click Role Switcher** so you can seamlessly test and verify all three roles:

| Role | Email | Password | Description / Testing Notes |
| :--- | :--- | :--- | :--- |
| **Student** | `student@university.edu` | `student123` | Alex Rivera (CS Senior) — explore jobs, scan resume with ATS, apply, book interview slots, and message recruiters. |
| **Recruiter (Approved)** | `recruiter@techcorp.com` | `recruiter123` | Elena Rostova (CloudScale Systems) — post openings with required & preferred skills, sort candidates by ATS score, create interview slots. |
| **Recruiter (Pending)** | `pending@startup.io` | `pending123` | Marcus Vance (NextGen AI) — demonstration account for testing the Admin onboarding approval requirement (FR-ADM-01). |
| **Administrator** | `admin@recruit.com` | `admin123` | Administrator — approve/deactivate recruiters (with Hold overlay and slot cancellations), audit spam job postings, and moderate inappropriate feed posts. |

---

## 📐 CS455 Deliverable 1 Requirements Implementation Matrix

### 1. General & Authentication (Section 1.1.1)
- **FR-GEN-01:** JWT Bearer authentication implemented across all protected API routes.
- **FR-GEN-02:** Transactional source of truth backed by SQLAlchemy ORM with SQLite out-of-the-box (zero configuration) and PostgreSQL ready.
- **FR-GEN-03 / UC-C14:** Authenticated users can view professional profiles of candidates and recruiters.

### 2. Application State Lifecycle Guard (Section 1.1.1)
- **FR-STAT-01:** Applications follow only valid state transitions:
  - `Applied` → `In Review`
  - `Applied` → `Withdrawn`
  - `In Review` → `Interview`
  - `In Review` → `Rejected`
  - `In Review` → `Withdrawn`
  - `Interview` → `Selected`
  - `Interview` → `Rejected`
  - `Interview` → `Candidate Declined`
- **FR-STAT-02:** `Selected`, `Rejected`, `Withdrawn`, and `Candidate Declined` are enforced as terminal states.
- **FR-STAT-03:** Backward state transitions are prohibited by the backend transition guard.
- **FR-STAT-04:** Candidates may withdraw only while in `Applied` or `In Review`.
- **FR-STAT-05:** Application history and status change audit trails are permanently preserved.

### 3. Recruitment & Interview Management (Section 1.1.2 & User Prompt)
- **FR-REC-01:** Every job must contain at least one required skill ($T_R \ge 1$).
- **FR-REC-02:** Preferred skills are optional ($T_P \ge 0$).
- **FR-REC-03:** Candidate can submit only one application per unique job opening.
- **FR-REC-04:** Recruiters create available interview slots with start/end time, selection deadline, and external video meeting links.
- **FR-REC-05:** Candidates in the `Interview` stage select exactly one available slot.
- **FR-REC-06:** Candidates can atomically change interview time; old slot is released and new slot is claimed in a single atomic transaction.
- **FR-REC-07:** Closing an interview releases the booked slot and transitions the application to `Candidate Declined`.
- **FR-CON-01 to FR-CON-04:** Interview slots are treated as finite shared resources with row-level locking. Concurrent attempts yield a successful booking for the first and structured `HTTP 409 Conflict` for subsequent attempts.

### 4. Resume-Job Analysis & ATS Scoring (Section 1.1.4, 1.1.7)
- **FR-ANA-01 / FR-ANA-02:** Normalizes and extracts candidate skills from pre-submission PDF resumes against job required and preferred skills.
- **FR-ANA-03:** Candidates see matched skills, missing skills, and Match Score **before** submitting, and can repeatedly revise/re-analyze PDFs until satisfied.
- **FR-ANA-04, FR-ANA-05, FR-ANA-06:** Deterministic score calculated by backend:
  $$\text{With required \& preferred skills: } \text{Score} = 70 \times \left(\frac{MR}{TR}\right) + 30 \times \left(\frac{MP}{TP}\right)$$
  $$\text{With no preferred skills: } \text{Score} = 100 \times \left(\frac{MR}{TR}\right)$$
- **FR-DAT-01 / FR-DAT-02:** Uploads strictly limited to PDF format $\le 5\text{ MB}$.
- **FR-DAT-03:** The exact PDF submitted remains permanently associated with the application snapshot.
- **FR-ERR-01 to FR-ERR-03:** AI timeout or extraction failure triggers fallback prompt: *"Submit without an AI score? [Yes] [No]"*.

### 5. Search & AI Natural Language Querying (Section 1.1.5)
- **FR-SCH-01:** Structured search by keyword, title, location, job type, and required skill.
- **FR-SCH-02 / FR-SCH-03:** Natural language AI search (e.g., *"Looking for remote junior python roles"*), validated by backend (FR-SCH-04).
- **NFR-AVAIL-01:** Robust offline heuristic NLP fallback when Ollama is not running locally.

### 6. Administration & Spam Monitoring (Section 1.1.8 & User Prompt)
- **FR-ADM-01:** Administrators approve, reject, deactivate, or reactivate recruiters.
- **FR-ADM-02 / FR-ADM-03:** Recruiter deactivation applies a `Hold/Suspended` overlay banner on applications without altering the underlying state.
- **FR-ADM-04 / FR-ADM-05:** Booked interviews of a deactivated recruiter are cancelled and slots made unavailable while preserving audit history.
- **FR-ADM-06 / FR-ADM-07:** Existing jobs and applications remain preserved; reactivation lifts the overlay.
- **FR-ADM-08:** Content moderation tools to hide or delete inappropriate posts and comments.
- **Spam & Activity Monitor:** Detects suspicious clickbait job keywords, flags spam openings, and provides real-time audit logs of student activity.

### 7. Professional Networking & Direct Messaging (Section 1.1.3 & User Prompt)
- **FR-NET-01:** Connect, accept, and manage professional network contacts.
- **FR-NET-02 / FR-NET-03:** Direct text-only messaging between connected peers and between recruiters and applicants to coordinate interviews.
- **Outside Resources:** Direct chat includes launcher for Google Meet / Zoom to conduct external interviews.
- **FR-NET-04:** Professional feed to publish career insights, like, and comment.
