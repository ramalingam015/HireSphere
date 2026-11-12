# HireSphere — Role-Based Recruitment & ATS Platform
**CS455 Deliverable 1 — Group 10**

HireSphere is a full-stack, role-based job recruitment and interview scheduling system engineered to satisfy the CS455 Deliverable 1 specifications. The system features **Student (Candidate)**, **Recruiter**, and **Administrator** portals, automated ATS resume-job compatibility scoring, atomic interview slot reservations with row locking, spam moderation, and direct chat for interview coordination.

---

## 🚀 Quick Start (Local)

Requires Docker and Node 20+. PostgreSQL and an S3 server (SeaweedFS) are required (there is no SQLite or local-disk mode).

```bash
# 1. Env files (gitignored; the .env.example next to each documents every variable)
cp backend/.env.example backend/.env      # then set SECRET_KEY and, optionally, GEMINI_API_KEY
cp frontend/.env.example frontend/.env    # then set VITE_API_BASE=http://localhost:8000

# 2. Backend: API + PostgreSQL + SeaweedFS S3
./run.sh                                   # Windows: run.bat  ==  docker compose --env-file backend/.env up -d --build

# 3. Frontend
cd frontend && npm install && npm run dev  # http://localhost:5173
```

Sign in with a seeded account (see [Demo credentials](#-pre-configured-demo-credentials)). Swagger docs: `http://localhost:8000/docs`.

Developing the API without Docker: `docker compose up -d db storage`, uncomment the local `DATABASE_URL` / `MINIO_*` lines in `backend/.env`, then `cd backend && pip install -r requirements.txt && python main.py`.

---

## 🏗️ Architecture & Deployment Overview

```
Browser ──► Firebase Hosting  (React build)           https://hiresphere-cs455.web.app
   │
   └─HTTPS─► API on Oracle VM:  Caddy ──► FastAPI ──► PostgreSQL   (all data)
                                                 └──► SeaweedFS (S3 API) (resume PDFs)
```

- **Frontend:** React + Vite, deployed to Firebase Hosting (`frontend/firebase.json`, project `hiresphere-cs455`). It talks to the API at `VITE_API_BASE` (`frontend/.env`).
- **Backend:** FastAPI + SQLAlchemy on PostgreSQL (`DATABASE_URL`, required). JWT bearer auth on every endpoint except registration, login and health.
- **Resume storage:** [backend/app/storage.py](backend/app/storage.py) stores PDFs in **SeaweedFS** (S3-compatible, via boto3; required). Only the backend talks to it: clients upload to the API and download through the JWT-protected `GET /api/files/resumes/<file>` (owner, the job's recruiter, or an admin). The DB stores the object key (e.g. `resumes/user_4_ab12_cv.pdf`).
- **Storage note:** the S3 service is [SeaweedFS](https://github.com/seaweedfs/seaweedfs) (official multi-arch image `chrislusf/seaweedfs`, pinned to `4.50`), chosen because MinIO no longer publishes images or binaries and had to be compiled from source. The `MINIO_*` variable names are kept for the S3 endpoint/keys; the compose service is called `storage`. Keep it private (bound to localhost).

### Run the backend stack locally (API + PostgreSQL + SeaweedFS S3)

```bash
docker compose --env-file backend/.env up -d --build   # API takes ~30 s to become ready
curl http://localhost:8000/api/health
```

| Service | URL | Notes |
| :--- | :--- | :--- |
| API | `http://localhost:8000` (`/docs` for Swagger) | seeds the demo accounts on first start |
| PostgreSQL | `localhost:5432` | `postgres` / `postgrespassword`, db `recruitment_db` |
| S3 API (SeaweedFS) | `http://localhost:8333` | access/secret key `minioadmin` / `minioadmin` (dev only), bucket `hiresphere` |

`docker compose down` stops everything; add `-v` to also wipe the database and stored resumes.

### Configuration

Backend config lives in `backend/.env` (used by the VM in production) and frontend config in `frontend/.env`; the `.env.example` next to each only documents the variables ([backend](backend/.env.example), [frontend](frontend/.env.example)). See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). Main settings:

| Variable | Purpose |
| :--- | :--- |
| `APP_ENV` | `development` (default) or `production`; production refuses to start on dev defaults |
| `SECRET_KEY` | Signs JWTs (`openssl rand -hex 32`) |
| `ADMIN_REGISTRATION_KEY` | Passcode for registering an Administrator and for the admin database reset |
| `DATABASE_URL` | PostgreSQL URL (required) |
| `MINIO_ENDPOINT` | e.g. `http://storage:8333` (required) |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` | S3 access key, secret key and bucket (bucket is auto-created) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins (Firebase URLs in production; `*` for dev) |
| `RESEND_API_KEY` / `BREVO_API_KEY` / `SENDGRID_API_KEY` / `SMTP_*` | Email delivery for verification codes (see [Email](#️-email)) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini for AI search and skill extraction (see [AI](#-ai-search--recommendations-gemini)) |


### Production (Oracle VM + Firebase)

The same `docker-compose.yml` runs on the VM with `--profile prod` (adds Caddy for automatic HTTPS) and `APP_ENV=production`, which makes the API refuse to start on any dev default (weak `SECRET_KEY`, default admin key, default DB/S3 passwords, `CORS_ORIGINS=*`); the frontend is deployed by `.github/workflows/deploy.yml` on push to `main`. Full steps, including the Oracle firewall rules, are in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#deploying-oracle-vm-backend--firebase-hosting-frontend).

### Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests -q
```

Tests need PostgreSQL (`docker compose up -d db`; they create and reset a separate `recruitment_test` database, override with `TEST_DATABASE_URL`) and use an in-memory fake S3 and a mocked Gemini, so no real S3 server or API is touched. They cover ATS scoring, storage, Gemini calling and fallbacks, auth, CORS, resume upload limits, the apply flow, the production config guard and JWT enforcement (including a test that fails if any new endpoint is public). The same suite runs in the PR quality gate with a Postgres service.

---

## 🔐 Authentication & Authorization

- **JWT everywhere:** every endpoint except register, login, verify-email, resend-verification, email-diagnostics and health requires `Authorization: Bearer <token>`. A test fails if an endpoint is added without it.
- **Roles:** candidate, recruiter (must be approved by an admin) and admin, enforced per endpoint on the backend. The frontend mirrors this only for navigation (`frontend/src/auth/access.js`).
- **Resumes:** uploaded to the API, stored in SeaweedFS, and downloaded through `GET /api/files/resumes/<file>`, which allows only the owner, the recruiter of the job applied to, or an admin (others get 404).
- **Admin-only:** platform reset (also needs `ADMIN_REGISTRATION_KEY`) and `POST /api/auth/test-email`.
- **Email verification:** new accounts get no token until they verify a 6-digit code (cryptographically random, 24 h validity, 5 wrong attempts then a new code is required, 60 s resend cooldown). Unverified accounts are refused by every protected endpoint.
- **Frontend sessions:** the token is validated on load, a 401 or an expired token signs the user out, and there is no offline or mock login.

## ✉️ Email

Verification codes are sent through Resend, SendGrid, Brevo, Gmail or any SMTP server, configured only via `backend/.env` ([provider table](DEPLOYMENT_GUIDE.md#-email-verification-codes)). With no provider configured in development, the code is printed in the API log (`docker compose logs api`); it is never logged with `APP_ENV=production`. Seeded demo accounts are pre-verified.

## 🤖 AI Search & Recommendations (Gemini)

- Natural-language job search and skill extraction from uploaded resumes use the Gemini API when `GEMINI_API_KEY` is set; without a key or when the API fails, built-in heuristics take over, so the app never depends on it.
- **Model:** `GEMINI_MODEL` defaults to the alias `gemini-flash-lite-latest`. Google retires Gemini models quickly (1.5 and 2.0 already return 404), so an alias is safer than a pinned version. If the configured model fails, the code retries `gemini-flash-lite-latest` and then `gemini-flash-latest`. Failures are logged as `[AI] Gemini model '...' returned HTTP ...` (never the key; the key is sent in a header, not the URL).
- **Latency:** a search makes one Gemini call (query parsing, roughly 1-3 s). Candidate skills are extracted by Gemini once at resume upload and stored on the profile, then matched locally on every search.

## 📋 Deliverable 1 Coverage Notes

Verified against the Deliverable 1 requirements (each item has tests under `backend/tests/`):

- **Networking (FR-NET-01/02):** connection requests are `PENDING` until the recipient accepts or rejects them; either side can remove a connection; direct messages are only allowed between accepted connections (the UI offers "+ Connect", Accept/Reject and Remove).
- **State changes (FR-SEC-01, FR-STAT-04, FR-REC-07, FR-ADM-02/03):** only the job's *approved* recruiter (or an admin) can move an application; Withdrawn and Candidate Declined can only be set by the candidate; applications on administrative hold cannot change state.
- **AI privacy (FR-SEC-02):** emails, phone numbers and links are stripped from resume text before it is sent to Gemini.
- **AI search validation (FR-SCH-04):** AI-produced filters are whitelisted and type-checked; anything rejected is reported in the `X-AI-Search-Notice` response header.
- **Concurrency (FR-CON-02/03/04):** tests fire simultaneous booking requests at PostgreSQL (exactly one 200, the rest 409) and verify a failed change-time keeps the original booking.
- **Moderation (FR-ADM-08):** admins can hide/unhide/delete posts and comments (`/api/admin/posts|comments/{id}/moderate`).

Known differences from the Deliverable 1 architecture:

- **Search:** job search uses PostgreSQL filters, not Elasticsearch (FR-SCH-01, NFR-PERF-01); there is no Redis cache or rate limiter.
- **AI provider:** Gemini replaces the local Ollama/Qwen model (NFR-AVAIL-01 still holds: every non-AI feature and the heuristic fallbacks work without it).
- **Resume analysis (FR-ANA-01):** skill matching and scoring are fully deterministic (regex), so the analysis never calls an LLM and the AI-failure prompt (FR-ERR-01..03) only triggers on PDF extraction errors. Gemini is used for natural-language search and for extracting skills when a resume is uploaded to a profile.
- **Recruiter removal (FR-ADM-01):** admins can approve, reject, deactivate and reactivate recruiters; permanent removal is not implemented (it would conflict with preserving jobs and applications, FR-ADM-06).
- **Comment moderation UI:** the endpoint exists; the admin dashboard still only exposes post moderation.

## 🔑 Pre-Configured Demo Credentials

These accounts are seeded automatically on first start. Sign in with them on the normal login page to try all three roles:

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
- **FR-GEN-02:** Transactional source of truth backed by SQLAlchemy ORM on PostgreSQL.
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
- **FR-SCH-02 / FR-SCH-03:** Natural language AI search (e.g., *"Looking for remote junior python roles"*) powered by Gemini, validated by backend (FR-SCH-04).
- **NFR-AVAIL-01:** Robust offline heuristic NLP fallback when no Gemini key is configured or the API is unreachable.

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
