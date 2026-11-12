# Deployment Guide
**HireSphere Job Recruitment & Interview Management Platform**

Production layout: **backend + PostgreSQL + SeaweedFS on an Oracle Cloud VM** (Docker Compose, Caddy for HTTPS) and the **React frontend on Firebase Hosting**.

## ⚙️ Environment Variables

Set these in `backend/.env` on the VM ([backend/.env.example](backend/.env.example) documents every variable; the frontend has its own [frontend/.env.example](frontend/.env.example)). Variables marked *required* make the stack refuse to start when missing.

| Variable | Required | Description |
| :--- | :--- | :--- |
| `APP_ENV` | yes on the VM | Set `production`. The API then refuses to start while any dev default is left (weak/dev `SECRET_KEY`, default `ADMIN_REGISTRATION_KEY`, default Postgres/S3 passwords, `CORS_ORIGINS=*`). |
| `DATABASE_URL` | yes | PostgreSQL URL. Built from `POSTGRES_PASSWORD` by `docker-compose.yml`. |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | yes | S3 storage (SeaweedFS) used only by the backend. Set by compose from `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`. |
| `SECRET_KEY` | yes | Signs JWTs. `openssl rand -hex 32`. |
| `ADMIN_REGISTRATION_KEY` | yes | Passcode for registering Administrators and for the admin database reset. |
| `CORS_ORIGINS` | yes | Allowed browser origins, e.g. `https://hiresphere-cs455.web.app,https://hiresphere-cs455.firebaseapp.com`. |
| `API_DOMAIN` | yes | Public hostname of the API (Caddy gets its HTTPS certificate for it). |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | no | Google Gemini for AI search, skill extraction and recommendations (default model alias `gemini-flash-lite-latest`; Google retires Gemini models quickly, so prefer an alias). Without a key, built-in heuristics are used. |
| `SMTP_*`, `BREVO_API_KEY`, `RESEND_API_KEY`, `SENDGRID_API_KEY` | no | Email delivery for verification codes. |
| `VITE_API_BASE` | frontend build | API URL baked into the Firebase build. Lives in `frontend/.env` locally and the GitHub repo variable of the same name in CI (never put secrets in frontend env: it is public). |

## 🔐 Security model

- Every endpoint except register / login / verify-email / resend-verification / email-diagnostics / health requires a JWT (`Authorization: Bearer …`). A test fails if a new endpoint is added without one.
- Resumes are uploaded to the API and stored in SeaweedFS by the backend only. Downloads go through `GET /api/files/resumes/<file>`, allowed for the owning candidate, the recruiter of the job applied to, and admins. The S3 server is never exposed publicly.
- `reset-database`, `configure-email` and `test-email` require an **admin** JWT (the reset also requires `ADMIN_REGISTRATION_KEY`).

---

### 📧 Email verification codes

New accounts must verify their email with a 6-digit code before they get a token or can log in. Delivery is configured **only through `backend/.env`** (restart the API after changing it). The first provider that has credentials is used, in this order: **Resend → SendGrid → Brevo → Gmail → generic SMTP**.

| Provider | Variables | Notes |
| :--- | :--- | :--- |
| Resend (HTTPS) | `RESEND_API_KEY` (`re_…`) | Without a verified domain, Resend can only deliver to your own account email. Set `SMTP_FROM_EMAIL` to an address on a verified domain to mail anyone. |
| SendGrid (HTTPS) | `SENDGRID_API_KEY` (`SG.…`), `SMTP_FROM_EMAIL` | `SMTP_FROM_EMAIL` must be a verified sender. |
| Brevo (HTTPS) | `BREVO_API_KEY` (`xkeysib-…`, from the *API Keys* tab), `SMTP_FROM_EMAIL` | Sender must be your Brevo signup email; new accounts need their profile completed first. |
| Gmail (SMTP SSL 465) | `SMTP_USER`, `SMTP_PASSWORD` | Needs 2-Step Verification and a 16-character [App Password](https://myaccount.google.com/apppasswords), not your normal password. Fine for testing; Gmail limits daily volume. |
| Other SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` | Port 465 uses SSL, anything else STARTTLS. |

On the Oracle VM prefer an HTTPS provider (port 443): Oracle blocks outbound port 25 and other hosts block SMTP entirely.

Behaviour worth knowing:
- With no provider configured, accounts cannot be verified. In **development** the code is printed in the API log (`docker compose logs api | grep 6-digit`); with `APP_ENV=production` it is never logged.
- A code is valid for 24 hours, allows 5 wrong attempts (then a new code is required), and a new code can be requested once per 60 seconds.
- Seeded demo accounts are pre-verified.
- Test delivery as an admin: `POST /api/auth/test-email` with `{"email": "you@example.com"}` and an admin Bearer token; the response says exactly what the provider returned.

---

## Deploying: Oracle VM (backend) + Firebase Hosting (frontend)

**Recommended production layout.** Everything stateful lives on one Oracle Cloud VM and is self-hosted (no AWS):

```
Browser ──► Firebase Hosting (React build, static)
   │
   └─HTTPS─► https://api.<your-domain>  ──► Caddy (auto TLS) ──► FastAPI ──► PostgreSQL
                                                                      └────► SeaweedFS (resumes, S3 API)
```

> **Storage note:** S3 storage is SeaweedFS (`chrislusf/seaweedfs:4.50`, official multi-arch image, no compile; SeaweedFS was dropped because it no longer publishes images). It listens on port 8333 bound to the VM's loopback only. The `MINIO_*` variable names are unchanged and mean the S3 endpoint and keys.

Resumes are stored in SeaweedFS and served through the API (the JWT-protected `GET /api/files/resumes/<file>`), so the S3 port is never exposed publicly.

### Part A — Oracle VM

1. **Create the VM** (Always Free works: Ubuntu 22.04/24.04, Ampere A1 or AMD Micro). The compose images are multi-arch.
2. **Open ports 80 and 443** in two places (both are required on Oracle):
   - OCI Console → VCN → Security List → add Ingress rules for TCP `80` and `443` from `0.0.0.0/0`.
   - On the VM (Oracle images ship with restrictive iptables):
     ```bash
     sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save
     ```
3. **Install Docker:** `curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER` (log out/in).
4. **DNS:** point an `A` record such as `api.example.com` at the VM's public IP. Firebase is HTTPS, so the API must be HTTPS and therefore needs a hostname (a free DuckDNS/sslip.io name works).
5. **Deploy:**
   ```bash
   git clone <your-repo> hiresphere && cd hiresphere
   cp backend/.env.example backend/.env
   nano backend/.env    # APP_ENV=production, API_DOMAIN, CORS_ORIGINS, secrets (openssl rand -hex 32)
   docker compose --env-file backend/.env --profile prod up -d --build
   ```
6. **Verify:** `curl https://api.example.com/api/health`. Caddy obtains the certificate automatically on first request.
7. **Storage:** SeaweedFS has no public ports; the S3 API is on `127.0.0.1:8333` only. Inspect it with `ssh -L 8333:localhost:8333 ubuntu@<vm-ip>` and any S3 client.
8. **Backups:** data lives in the Docker volumes `postgres_data` and `storage_data`. Back up with `pg_dump` and by archiving the `storage_data` volume.

### Part B — Firebase Hosting (frontend)

1. The Firebase config lives in `frontend/` ([firebase.json](frontend/firebase.json), [.firebaserc](frontend/.firebaserc), project `hiresphere-cs455`, serving `frontend/dist`).
2. **One-time manual deploy** (optional):
   ```bash
   npm i -g firebase-tools && firebase login
   cd frontend && VITE_API_BASE=https://api.example.com npm run build
   firebase deploy --only hosting
   ```
3. **Automatic deploy on push** (`.github/workflows/deploy.yml`). In the GitHub repo add:
   - Variable `VITE_API_BASE` = `https://api.example.com`
   - Secret `FIREBASE_SERVICE_ACCOUNT` = service-account JSON (easiest: run `firebase init hosting:github`, which creates it for you).
4. Add your Firebase URLs (`https://hiresphere-cs455.web.app`, `https://hiresphere-cs455.firebaseapp.com`) to `CORS_ORIGINS` in `backend/.env` on the VM, then `docker compose --env-file backend/.env --profile prod up -d`.

### Local development

```bash
docker compose up -d --build     # API + PostgreSQL + SeaweedFS (see README)
```

PostgreSQL and SeaweedFS (S3) are required everywhere (there is no SQLite or local-disk mode). Without Docker for the API, run `docker compose up -d db storage`, copy `backend/.env.example` to `backend/.env`, uncomment the local `DATABASE_URL`/`MINIO_*` lines and run `python main.py`.

---

## 🛡️ Production Verification Checklist

- [ ] **Admin Account Login:** Log into `admin@recruit.com` / `admin123` and verify the Admin Console loads.
- [ ] **Recruiter Workflow:** Log into `recruiter@techcorp.com` / `recruiter123` and verify you can view candidate ATS scores and create interview slots.
- [ ] **Student ATS Test:** Log into `student@university.edu` / `student123`, choose a job, upload a test PDF resume, verify the ATS percentage score calculates deterministically, and submit.
- [ ] **Interview Booking & Concurrency:** Verify candidate can book an interview slot and reschedule atomically.
- [ ] **Direct Chat:** Verify sending text messages between applicant and recruiter.
- [ ] **Hold/Suspension Overlay:** Test deactivating a recruiter from the admin console and ensure the candidate's view reflects the hold message while preserving application state.
- [ ] **Database Backups:** Configure daily backups of PostgreSQL and the storage volume via cron:
  ```bash
  # Daily postgres backup at 2 AM
  0 2 * * * docker compose -f /home/ubuntu/hiresphere/docker-compose.yml exec -T db pg_dump -U postgres recruitment_db > /backup/db_$(date +\%F).sql
  # S3 data lives in the storage_data volume: snapshot or archive it as well
  ```
- [ ] **JWT lockdown:** `curl https://<api>/api/files/resumes/x.pdf` returns 401.
