export const DEMO_CREDENTIALS = {
  "student@university.edu": "student123",
  "recruiter@techcorp.com": "recruiter123",
  "pending@startup.io": "pending123",
  "admin@recruit.com": "admin123",
};

export function shouldUseMockFallback(err) {
  // HTTP errors from a reachable backend (401/403/etc) must not fall through to demo login.
  return !err || err.status == null;
}

export function authenticateMockLogin(users, email, password) {
  const user = users.find((u) => u.email === email);
  const expectedPassword = user?.password ?? DEMO_CREDENTIALS[email];
  if (!user || !password || expectedPassword !== password) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    throw err;
  }
  const { password: _omit, ...safeUser } = user;
  return safeUser;
}
