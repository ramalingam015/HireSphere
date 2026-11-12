// API root, set at build time (frontend/.env). Empty = same origin (works with the Vite dev proxy).
export const getApiBase = () => (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export const API_BASE = getApiBase();

// Resumes are only served by the backend to authenticated users (JWT), so they can't be
// opened with a plain <a href>. Fetch with the bearer token and use a blob URL instead.
export const fetchResumeBlob = async (resumePath) => {
  const filename = String(resumePath || "").split(/[\\/]/).pop();
  if (!filename) throw new Error("No resume on file.");
  const token = getAuthToken();
  const response = await fetch(`${getApiBase()}/api/files/resumes/${encodeURIComponent(filename)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Please sign in again." : "Could not load the resume PDF.");
  }
  return response.blob();
};

const TOKEN_KEY = "recruitment_token";
export const UNAUTHORIZED_EVENT = "hiresphere:unauthorized";

const jwtExpiryMs = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

/** Returns the stored JWT, or null if absent, malformed or expired (expired tokens are purged). */
export const getAuthToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const exp = jwtExpiryMs(token);
  if (exp === null || exp <= Date.now()) {
    setAuthToken(null);
    return null;
  }
  return token;
};

export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const base = getApiBase();
  const url = `${base}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  const signal = options.signal || controller.signal;

  try {
    const response = await fetch(url, {
      ...options,
      signal,
      headers,
    });
    clearTimeout(timeoutId);

    if (response.status === 401 && !endpoint.startsWith("/api/auth/login")) {
      // Session is invalid/expired: drop the token and tell the app to sign out.
      setAuthToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    let data;
    const contentType = response.headers.get("content-type");
    if (endpoint.startsWith("/api/") && contentType && contentType.includes("text/html")) {
      // e.g. static hosting answering with index.html because VITE_API_BASE is not set
      throw new Error("The HireSphere API is not configured for this site (VITE_API_BASE).");
    }
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = data?.detail || data?.message || "An error occurred";
      const error = new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Server request timed out. If hosted on a free cloud service (like Render), it may be waking up from sleep. Please retry in a few seconds.");
    }
    if (err.status) {
      // Re-throw genuine HTTP responses from backend (e.g. 400 Bad Request, 403 Forbidden)
      throw err;
    }
    throw new Error("Cannot reach the HireSphere server. Please check your connection and try again.");
  }
};
