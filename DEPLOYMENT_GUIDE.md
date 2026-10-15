# Complete Step-by-Step Deployment Guide
**HireSphere Job Recruitment & Interview Management Platform**

This guide provides end-to-end instructions for deploying HireSphere to production or your organization's server. Choose the method that best matches your target hosting environment:

- **Method 1:** [Docker & Docker Compose (Recommended for Any VPS / Cloud Server)](#method-1-docker--docker-compose-recommended)
- **Method 2:** [Cloud PaaS Hosting (Render / Railway / Fly.io — Zero Server Management)](#method-2-cloud-paas-deployment-render--railway)
- **Method 3:** [Ubuntu / Debian Linux Server with Nginx, Systemd & Let's Encrypt SSL](#method-3-traditional-linux-vps-ubuntu--nginx--systemd)
- **Method 4:** [Campus LAN / Local Windows Server Deployment](#method-4-campus-lan--local-server-deployment)
- **Method 5:** [GitHub Pages Frontend Deployment (+ Free Backend)](#method-5-github-pages-frontend-deployment)

---

## ⚙️ Key Environment Variables Reference

Configure these environment variables in your server's `.env` file or cloud dashboard:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SECRET_KEY` | *(Built-in default)* | Cryptographic secret key used to sign JWT auth tokens. Generate a secure random string for production. |
| `DATABASE_URL` | `sqlite:///backend/recruitment.db` | Database connection string. Use `postgresql://user:pass@host:5432/dbname` for production PostgreSQL. |
| `PORT` | `8000` | Port on which the FastAPI application listens. |
| `OLLAMA_URL` | `http://localhost:11434` | Endpoint for Ollama AI inference (optional; system falls back to built-in NLP heuristics if unavailable). |
| `VITE_API_BASE` | `""` (Empty string) | API root URL for frontend. Keep empty for same-origin deployment. |
| `ADMIN_REGISTRATION_KEY` | `CS455-ADMIN-2026` | Passcode required when registering an Administrator account. |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP email server host. |
| `SMTP_PORT` | `587` | SMTP email server port (587 for TLS, 465 for SSL). |
| `SMTP_USER` | `""` | Sender email address (e.g. `your-email@gmail.com`). Required for real email delivery. |
| `SMTP_PASSWORD` | `""` | Sender SMTP password or Google 16-character App Password. Required for real email delivery. |
| `SMTP_FROM_EMAIL` | Same as `SMTP_USER` | "From" address shown on verification emails. |

---

### 📧 Setting Up Real Email OTP Delivery (Gmail / Brevo / SendGrid)

To have HireSphere send real 6-digit confirmation codes directly to user email inboxes:

1. **Using Gmail (Free & Fast)**:
   - Go to your **Google Account** -> **Security** -> Enable **2-Step Verification** (if not already enabled).
   - Search for **App passwords** (or go to `myaccount.google.com/apppasswords`).
   - Create an app name like `HireSphere` and click **Create**.
   - Copy the generated **16-character password** (e.g. `abcd efgh ijkl mnop`).
   - In your Render Web Service dashboard, go to the **Environment** tab and add:
     - `SMTP_HOST`: `smtp.gmail.com`
     - `SMTP_PORT`: `587`
     - `SMTP_USER`: `your_email@gmail.com`
     - `SMTP_PASSWORD`: `your-16-character-app-password`
     - `SMTP_FROM_EMAIL`: `your_email@gmail.com`
   - Click **Save Changes**. Render will automatically restart your app with real email delivery enabled!

2. **Using Brevo / SendGrid / Mailgun**:
   - Set `SMTP_HOST` to your provider's relay (e.g. `smtp-relay.brevo.com`).
   - Set `SMTP_USER` and `SMTP_PASSWORD` to your API key / SMTP credentials.

## Method 1: Docker & Docker Compose (Recommended)

Docker Compose bundles the FastAPI application, the compiled React frontend, and a high-performance PostgreSQL 16 database into isolated, persistent containers.

### Prerequisites
- Docker Engine & Docker Compose installed on your host machine ([Install Docker](https://docs.docker.com/engine/install/)).

### Step 1: Transfer the Project Files to Your Server
Unzip `recruitment_platform.zip` on your server:
```bash
unzip recruitment_platform.zip -d recruitment_platform
cd recruitment_platform
```

### Step 2: Configure Environment Secrets (Optional)
Inspect or edit `docker-compose.yml`:
```yaml
environment:
  - SECRET_KEY=generate_a_secure_random_key_here
  - DATABASE_URL=postgresql://postgres:postgrespassword@db:5432/recruitment_db
```
*(You can generate a strong secret key using `openssl rand -hex 32`)*

### Step 3: Build and Start Containers
Run the following command in the project root:
```bash
docker compose up -d --build
```

### Step 4: Verify Deployment
Check that the containers are healthy and running:
```bash
docker compose ps
docker compose logs -f web
```
- Open `http://<your-server-ip>:8000` in your web browser.
- The interactive API Swagger documentation is available at `http://<your-server-ip>:8000/docs`.

### Step 5: Managing the Service
- **Stop containers:** `docker compose down`
- **Restart containers:** `docker compose restart`
- **View live logs:** `docker compose logs -f`

---

## Method 2: Cloud PaaS Deployment (Render / Railway)

If you don't want to manage a Linux virtual machine, you can deploy in minutes on free/inexpensive cloud platforms like **Render.com** or **Railway.app**.

### Deploying on Render (Step-by-Step)

1. **Push your code to GitHub / GitLab:**
   - Create a repository named `recruitment_platform`.
   - Push the contents of the unzipped folder to your repository.

2. **Create a PostgreSQL Database on Render:**
   - Log into [Render Dashboard](https://dashboard.render.com).
   - Click **New +** → **PostgreSQL**.
   - Name it `hiresphere-db` and select the Free tier.
   - Click **Create Database**.
   - Once provisioned, copy the **Internal Database URL** (e.g., `postgresql://user:pass@dpg-xxxx/dbname`).

3. **Create the Web Service:**
   - Click **New +** → **Web Service**.
   - Connect your GitHub repository.
   - **Environment:** `Docker` (Render will automatically detect `Dockerfile`).
   - In the **Environment Variables** section, add:
     - `DATABASE_URL`: *(Paste the Internal Database URL copied in Step 2)*
     - `SECRET_KEY`: *(Enter a random 32-character string)*
     - `PORT`: `8000`
   - Click **Create Web Service**.

4. **Add Persistent Disk for Resume Uploads:**
   - Under your Web Service settings, go to **Disks**.
   - Click **Add Disk**:
     - **Name:** `resumes-disk`
     - **Mount Path:** `/app/backend/uploads/resumes`
     - **Size:** `1 GB` (or larger depending on expected resume volume).

5. **Done!** Render gives you a free HTTPS domain (e.g., `https://hiresphere-app.onrender.com`).

---

## Method 3: Traditional Linux VPS (Ubuntu + Nginx + Systemd)

This approach provides enterprise-level control over a Virtual Private Server (AWS EC2, DigitalOcean Droplet, Linode, Hetzner, etc.).

### Step 1: Initial Server Setup (Ubuntu 22.04 / 24.04 LTS)
SSH into your server and update system packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nginx postgresql postgresql-contrib git curl
```

### Step 2: Configure PostgreSQL Database
```bash
sudo -u postgres psql
```
Inside the PostgreSQL prompt:
```sql
CREATE DATABASE recruitment_db;
CREATE USER hiresphere WITH ENCRYPTED PASSWORD 'StrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE recruitment_db TO hiresphere;
\q
```

### Step 3: Deploy Application Code
```bash
# Create application directory
sudo mkdir -p /var/www/hiresphere
sudo chown -R $USER:$USER /var/www/hiresphere

# Extract or copy your project files into /var/www/hiresphere
cd /var/www/hiresphere
# (Upload recruitment_platform contents here)

# Create Python virtual environment
cd /var/www/hiresphere/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install psycopg2-binary
```

### Step 4: Configure Environment & Seed Data
Create `/var/www/hiresphere/backend/.env`:
```bash
cat << 'EOF' > /var/www/hiresphere/backend/.env
DATABASE_URL=postgresql://hiresphere:StrongPassword123!@localhost:5432/recruitment_db
SECRET_KEY=9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f
PORT=8000
EOF
```

Run initial database seeding:
```bash
source venv/bin/activate
python -c "from app.seed import seed_database; seed_database()"
```

### Step 5: Create Systemd Background Service
Create the service configuration:
```bash
sudo nano /etc/systemd/system/hiresphere.service
```
Paste the following:
```ini
[Unit]
Description=HireSphere FastAPI Application Server
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/hiresphere/backend
EnvironmentFile=/var/www/hiresphere/backend/.env
ExecStart=/var/www/hiresphere/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Set permissions, enable, and start the service:
```bash
sudo chown -R www-data:www-data /var/www/hiresphere
sudo systemctl daemon-reload
sudo systemctl enable hiresphere
sudo systemctl start hiresphere
sudo systemctl status hiresphere
```

### Step 6: Configure Nginx Reverse Proxy & File Upload Limits
Edit `/etc/nginx/sites-available/hiresphere`:
```bash
sudo nano /etc/nginx/sites-available/hiresphere
```
Paste the configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com; # Or your server IP

    client_max_body_size 10M; # Allows 5 MB PDF uploads + overhead

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the Nginx site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/hiresphere /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Enable Free SSL with Let's Encrypt Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot will automatically install SSL certificates and set up automated renewals!

---

## Method 4: Campus LAN / Local Server Deployment

To run HireSphere within a college lab, campus intranet, or on a Windows local server accessible by other devices on the same Wi-Fi/LAN:

### Step 1: Find Server's Local IP Address
- **On Windows:** Open PowerShell, run `ipconfig`. Look for `IPv4 Address` (e.g., `192.168.1.100`).
- **On Linux/Mac:** Run `hostname -I` or `ifconfig`.

### Step 2: Start the Server on `0.0.0.0`
The backend script is already configured to bind to `0.0.0.0:8000`, which listens on all network interfaces!
Run:
```cmd
run.bat
```
or
```bash
python backend/main.py
```

### Step 3: Open Firewall Port 8000 (Windows)
If other devices cannot connect, allow port 8000 through the Windows Firewall:
```powershell
New-NetFirewallRule -DisplayName "HireSphere Web Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
```

### Step 4: Access From Any Device
Students, recruiters, and admins on the same network can open their browser and visit:
```
http://192.168.1.100:8000
```
*(Replace `192.168.1.100` with your server's actual IP address)*

---

## Method 5: GitHub Pages Frontend Deployment

> [!IMPORTANT]
> **Understanding Static Hosting vs. Full-Stack:**
> GitHub Pages is a **static web host** (HTML, CSS, JS only). It **cannot run Python/FastAPI or database processes**.
> However, you can deploy the React frontend on GitHub Pages, and it will:
> 1. Run seamlessly in **Interactive Demo Mode** (with built-in offline simulation of ATS scoring, applications, and slots) so your repository link works immediately.
> 2. Connect to any live backend (e.g. deployed on Render, Railway, or your VPS) whenever you configure the Backend URL.

### Automated 1-Click Deployment via GitHub Actions

This repository already includes `.github/workflows/deploy.yml`. Follow these 3 steps:

#### Step 1: Push Repository to GitHub
Make sure your commit includes the `.github/workflows/deploy.yml` file:
```bash
git add .
git commit -m "Add GitHub Pages automated workflow"
git push origin main
```

#### Step 2: Enable GitHub Pages in Your Repository Settings
1. Go to your GitHub repository in your web browser.
2. Click **Settings** (tab at the top).
3. In the left sidebar, click **Pages** (under the "Code and automation" section).
4. Under **Build and deployment** → **Source**, change from *"Deploy from a branch"* to:
   👉 **`GitHub Actions`**
5. Save. That's it!

#### Step 3: View Your Live Site
1. Click the **Actions** tab at the top of your GitHub repository.
2. You will see the **Deploy Frontend to GitHub Pages** workflow running.
3. Once completed (green checkmark), your live URL will appear (e.g., `https://<your-username>.github.io/<repo-name>/`).
4. Click your link and explore the application!

#### Step 4: (Optional) Connect to a Live Backend Server
In the live website on GitHub Pages:
- Look at the top demo bar: click **⚙️ Backend: Auto / Demo**.
- Enter your live FastAPI backend URL (e.g. `https://hiresphere-api.onrender.com`).
- The frontend will immediately route all live authentication, ATS scoring, and interview slot bookings to your production server!

---

## 🛡️ Production Verification Checklist

- [ ] **Admin Account Login:** Log into `admin@recruit.com` / `admin123` and verify the Admin Console loads.
- [ ] **Recruiter Workflow:** Log into `recruiter@techcorp.com` / `recruiter123` and verify you can view candidate ATS scores and create interview slots.
- [ ] **Student ATS Test:** Log into `student@university.edu` / `student123`, choose a job, upload a test PDF resume, verify the ATS percentage score calculates deterministically, and submit.
- [ ] **Interview Booking & Concurrency:** Verify candidate can book an interview slot and reschedule atomically.
- [ ] **Direct Chat:** Verify sending text messages between applicant and recruiter.
- [ ] **Hold/Suspension Overlay:** Test deactivating a recruiter from the admin console and ensure the candidate's view reflects the hold message while preserving application state.
- [ ] **Database Backups:** Configure daily backups of PostgreSQL or `recruitment.db` via cron:
  ```bash
  # Daily postgres backup at 2 AM
  0 2 * * * pg_dump -U hiresphere recruitment_db > /backup/db_$(date +\%F).sql
  ```
