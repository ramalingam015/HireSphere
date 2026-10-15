import { MOCK_USERS, MOCK_JOBS, MOCK_SLOTS, MOCK_POSTS, MOCK_APPLICATIONS } from "./mockData";

export const getApiBase = () => {
  const saved = localStorage.getItem("hiresphere_api_base");
  if (saved !== null && saved !== undefined && saved !== "") {
    return saved.replace(/\/$/, "");
  }
  return import.meta.env.VITE_API_BASE !== undefined ? import.meta.env.VITE_API_BASE : "";
};

export const setApiBase = (url) => {
  if (url) {
    localStorage.setItem("hiresphere_api_base", url.trim().replace(/\/$/, ""));
  } else {
    localStorage.removeItem("hiresphere_api_base");
  }
};

export const API_BASE = getApiBase();

export const getAuthToken = () => {
  return localStorage.getItem("recruitment_token");
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("recruitment_token", token);
  } else {
    localStorage.removeItem("recruitment_token");
  }
};

// In-memory mock state for static offline GitHub Pages fallback
let mockUsers = [...MOCK_USERS];
let mockJobs = [...MOCK_JOBS];
let mockSlots = [...MOCK_SLOTS];
let mockPosts = [...MOCK_POSTS];
let mockApps = [...MOCK_APPLICATIONS];

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

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && !endpoint.includes("/api/auth/login")) {
      setAuthToken(null);
    }

    let data;
    const contentType = response.headers.get("content-type");
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
    // If backend is unreachable (e.g. static hosting on GitHub Pages), fallback to mock engine
    console.warn(`[HireSphere API] Fetch to "${url}" failed. Using mock fallback engine.`, err.message);
    return handleMockFallback(endpoint, options);
  }
};

function handleMockFallback(endpoint, options) {
  const method = (options.method || "GET").toUpperCase();

  // Auth me
  if (endpoint.startsWith("/api/auth/me")) {
    const savedRole = localStorage.getItem("hiresphere_demo_role") || "candidate";
    const user = mockUsers.find(u => u.role === savedRole) || mockUsers[0];
    return user;
  }

  // Auth register
  if (endpoint.startsWith("/api/auth/register")) {
    let body = {};
    try { body = JSON.parse(options.body); } catch (_) {}
    if (body.role === "admin" && body.admin_secret_key !== "CS455-ADMIN-2026") {
      const err = new Error("Unauthorized: Administrator registration requires a valid Admin Security Passcode. Contact system owners.");
      err.status = 403;
      throw err;
    }
    const newUser = {
      id: Date.now(),
      email: body.email,
      full_name: body.full_name,
      role: body.role,
      recruiter_status: body.role === "recruiter" ? "pending" : "approved",
      company: body.company || "",
      is_active: true,
      is_email_verified: false
    };
    mockUsers.push(newUser);
    localStorage.setItem("hiresphere_demo_role", newUser.role);
    return {
      access_token: "demo-mock-jwt-token",
      token_type: "bearer",
      user: newUser,
      message: `Account created! A 6-digit verification code has been dispatched to ${newUser.email}.`
    };
  }

  // Auth verify email
  if (endpoint.startsWith("/api/auth/verify-email")) {
    let body = {};
    try { body = JSON.parse(options.body); } catch (_) {}
    if (body.code && body.code.trim().length !== 6) {
      const err = new Error("Invalid 6-digit verification code. Please check and try again.");
      err.status = 400;
      throw err;
    }
    const user = mockUsers.find(u => u.email === body.email) || mockUsers[0];
    user.is_email_verified = true;
    setAuthToken("demo-mock-jwt-token");
    localStorage.setItem("hiresphere_demo_role", user.role);
    return {
      message: "Email verified successfully! Welcome to HireSphere.",
      is_verified: true,
      access_token: "demo-mock-jwt-token",
      token_type: "bearer",
      user
    };
  }

  // Auth resend verification
  if (endpoint.startsWith("/api/auth/resend-verification")) {
    return {
      message: "New 6-digit verification code sent."
    };
  }

  // Auth login
  if (endpoint.startsWith("/api/auth/login")) {
    let body = {};
    try { body = JSON.parse(options.body); } catch (_) {}
    const user = mockUsers.find(u => u.email === body.email) || mockUsers[0];
    localStorage.setItem("hiresphere_demo_role", user.role);
    setAuthToken("demo-mock-jwt-token");
    return { access_token: "demo-mock-jwt-token", token_type: "bearer", user };
  }

  // Jobs
  if (endpoint === "/api/jobs" && method === "POST") {
    let body = {};
    try { body = JSON.parse(options.body); } catch (_) {}
    const newJob = {
      id: mockJobs.length + 1,
      recruiter_id: 2,
      title: body.title,
      company: body.company,
      location: body.location || "Remote",
      job_type: body.job_type || "Full-time",
      salary_range: body.salary_range || "Competitive",
      description: body.description || "",
      application_deadline: body.application_deadline || new Date(Date.now() + 14 * 86400000).toISOString(),
      skills: body.skills || [],
      is_active: true,
      is_flagged_spam: false,
      created_at: new Date().toISOString(),
      recruiter: mockUsers[1]
    };
    mockJobs = [newJob, ...mockJobs];
    return newJob;
  }
  if (endpoint.startsWith("/api/jobs/my-postings")) {
    return mockJobs;
  }
  if (endpoint.startsWith("/api/jobs/ai-search") || endpoint.startsWith("/api/jobs")) {
    return mockJobs;
  }

  // Applications
  if (endpoint.startsWith("/api/applications/my-applications")) {
    return mockApps;
  }
  if (endpoint.startsWith("/api/applications/job/")) {
    return mockApps;
  }
  if (endpoint.startsWith("/api/applications/pre-analyze-resume")) {
    // In-browser deterministic score simulation per FR-ANA-05
    return {
      job_id: 1,
      job_title: "Backend Cloud Engineer",
      matched_skills: ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
      missing_skills: ["Redis", "Kubernetes"],
      matched_required: ["Python", "FastAPI", "PostgreSQL", "Docker"],
      missing_required: [],
      matched_preferred: ["AWS"],
      missing_preferred: ["Redis", "Kubernetes"],
      score: 85.0,
      formula_used: "Score = 70 * (4/4) + 30 * (1/3) = 70.0 + 10.0 = 80.0%",
      is_ai_powered: true,
      ai_status_message: "Demo Mode ATS calculation completed."
    };
  }
  if (endpoint.startsWith("/api/applications/apply")) {
    const newApp = {
      id: mockApps.length + 1,
      job_id: 1,
      candidate_id: 1,
      original_filename: "Submitted_Resume.pdf",
      resume_file_path: "Submitted_Resume.pdf",
      ats_score: 85.0,
      matched_skills_json: JSON.stringify(["Python", "FastAPI", "PostgreSQL"]),
      missing_skills_json: JSON.stringify(["Docker"]),
      status: "Applied",
      is_hold_overlay: false,
      created_at: new Date().toISOString(),
      job: mockJobs[0],
      candidate: mockUsers[0]
    };
    mockApps = [newApp, ...mockApps];
    return newApp;
  }

  // Interviews
  if (endpoint.startsWith("/api/interviews/slots/job/")) {
    return mockSlots;
  }
  if (endpoint.startsWith("/api/interviews/book")) {
    return { ...mockSlots[0], is_booked: true };
  }
  if (endpoint.startsWith("/api/interviews/change-time")) {
    return { ...mockSlots[1], is_booked: true };
  }

  // Networking & Feed
  if (endpoint.startsWith("/api/networking/feed")) {
    return mockPosts;
  }
  if (endpoint.startsWith("/api/networking/connections")) {
    return [
      { id: 1, requester_id: 1, receiver_id: 2, status: "ACCEPTED", other_user: mockUsers[1], created_at: new Date().toISOString() }
    ];
  }
  if (endpoint.startsWith("/api/networking/messages/")) {
    return [
      { id: 1, sender_id: 2, recipient_id: 1, content: "Hello! Looking forward to reviewing your project.", is_read: true, created_at: new Date(Date.now() - 1800000).toISOString() }
    ];
  }
  if (endpoint.startsWith("/api/networking/messages")) {
    let body = {};
    try { body = JSON.parse(options.body); } catch (_) {}
    return { id: Date.now(), sender_id: 1, recipient_id: body.recipient_id || 2, content: body.content || "", is_read: false, created_at: new Date().toISOString() };
  }

  // Admin
  if (endpoint.startsWith("/api/admin/recruiters")) {
    return mockUsers.filter(u => u.role === "recruiter");
  }
  if (endpoint.startsWith("/api/admin/spam-monitor")) {
    return {
      jobs: mockJobs.map(j => ({ job: j, is_suspicious: false, is_flagged: false, reason: "Normal" })),
      applications: mockApps.map(a => ({ application_id: a.id, candidate_name: a.candidate?.full_name, candidate_email: a.candidate?.email, job_title: a.job?.title, ats_score: a.ats_score, status: a.status, is_flagged_spam: false, created_at: a.created_at })),
      total_jobs: mockJobs.length,
      total_applications: mockApps.length,
      total_candidates: 1,
      total_recruiters: 2,
      pending_recruiters: 1
    };
  }

  return { message: "Mock response" };
}
