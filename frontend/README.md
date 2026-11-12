# HireSphere Frontend

React + Vite single-page app for the HireSphere recruitment platform (Student, Recruiter and Admin portals).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint
npm run build      # outputs dist/
```

## Backend connection

API calls go to `VITE_API_BASE` (see [.env.example](.env.example); copy it to `.env`). Empty means same origin, which works with the Vite dev proxy to `localhost:8000`.

**Auth:** JWT in `localStorage`, attached by `apiRequest`; a 401 or an expired token signs the user out (`UNAUTHORIZED_EVENT`). Tab access per role lives in `src/auth/access.js` (the backend enforces the real rules).

```bash
# run against the local docker compose backend
VITE_API_BASE=http://localhost:8000 npm run dev
```

Resumes are fetched from `GET /api/files/resumes/<file>` with the JWT (`fetchResumeBlob` / `openResumeInNewTab` in `src/api/client.js`), never via plain links; the backend stores them in S3 storage (SeaweedFS).

## Deploy (Firebase Hosting)

Project `hiresphere-cs455`, configured in `firebase.json` / `.firebaserc` (serves `dist/`, SPA rewrite to `index.html`).

```bash
VITE_API_BASE=https://<your-api-host> npm run build
firebase deploy --only hosting
```

CI deploys automatically on push to `main` (`.github/workflows/deploy.yml`, uses the `VITE_API_BASE` repo variable and `FIREBASE_SERVICE_ACCOUNT` secret). The API's `CORS_ORIGINS` must include the Firebase URLs.
