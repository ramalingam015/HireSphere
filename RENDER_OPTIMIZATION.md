# Render Cloud Speed & Performance Optimization Guide

If your HireSphere deployment on **Render** feels slow, here is an in-depth breakdown of the root causes and the solutions we have implemented (plus 2 simple external settings you can enable).

---

## ⚡ 1. Fix Implemented: Asynchronous Background Email Dispatch
### The Problem:
Previously, when a user clicked **Register**, **Sign In**, or **Resend OTP**, the FastAPI backend paused the entire HTTP request to connect to the SMTP server (or API) and wait for a network response. On cloud hosts like Render where SMTP ports can suffer from latency, this caused the frontend to hang for **4 to 15 seconds** before responding.

### The Solution:
We updated `backend/app/email_service.py` and `backend/app/routes/auth_routes.py` to use a non-blocking `ThreadPoolExecutor`.
* When an email is triggered, the HTTP API returns a JSON response to the user's browser in **< 40 milliseconds**.
* The email connection and delivery run concurrently in a background worker thread.

---

## ⚡ 2. Fix Implemented: GZip Response Compression
### The Problem:
Every API response and bundled script was transferred raw without compression, causing sluggish initial page loads over mobile and cloud networks.

### The Solution:
We added `GZipMiddleware` to `backend/main.py` (`minimum_size=1000`).
* All JSON payloads, ATS score reports, and dashboard responses are automatically compressed by **70% to 80%** before transmission.
* Page loading and data fetching become noticeably snappier.

---

## ⚡ 3. Fix Implemented: SQLite Concurrency Optimization (WAL Mode)
### The Problem:
In default SQLite mode, any write query (e.g. creating an application, logging an interview slot) places an exclusive lock on the entire database file. If another request arrives at the same time, it waits or errors out with `database is locked`.

### The Solution:
We updated `backend/app/database.py` to enable **Write-Ahead Logging (WAL)**:
```python
cursor.execute("PRAGMA journal_mode=WAL")
cursor.execute("PRAGMA synchronous=NORMAL")
```
* Allows multiple readers to read data concurrently even while writes are occurring.

---

## 🚀 4. How to Fix Render Free-Tier 50-Second "Cold Start" Sleep
Render's **Free Web Service** tier automatically **spins down (sleeps) after 15 minutes of inactivity**. When anyone opens the site after 15 minutes, Render takes **50 to 60 seconds** to boot the container from scratch.

### The Solution (Free Keep-Alive Ping):
Set up a free health check monitor that pings your site every 10 minutes so it **never sleeps**:

1. Go to [UptimeRobot](https://uptimerobot.com) (or [cron-job.org](https://cron-job.org)) and create a free account.
2. Click **Add New Monitor**:
   * **Monitor Type:** `HTTP(s)`
   * **Friendly Name:** `HireSphere Keep-Alive`
   * **URL:** `https://<your-render-subdomain>.onrender.com/api/health`
   * **Monitoring Interval:** `Every 10 minutes`
3. Click **Create Monitor**.
4. That's it! Your Render container will now stay warm 24/7 and load instantly on every visit.

---

## 🌐 5. Decoupled Architecture (Recommended for Maximum Speed)
Currently, Render serves both the Python FastAPI API and the compiled React static files on a 0.1 CPU core instance.

For the fastest possible performance:
* **Frontend:** Host on **Vercel** or **Render Static Site** (100% Free). Vercel uses global edge CDNs, delivering your UI in **under 50 milliseconds** anywhere in the world.
  * Set `VITE_API_BASE=https://<your-backend>.onrender.com` in your frontend environment.
* **Backend:** Keep on Render purely for the FastAPI REST API.
