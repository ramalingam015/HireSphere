// Single source of truth for which tabs each role may open.
// This is UX only; the backend enforces the same rules with JWT + role checks on every endpoint.
export const TABS_BY_ROLE = {
  candidate: ["jobs", "applications", "network", "profile"],
  recruiter: ["recruiter_dashboard", "network", "profile"],
  admin: ["admin", "recruiter_dashboard", "network", "profile"],
};

export const DEFAULT_TAB = {
  candidate: "jobs",
  recruiter: "recruiter_dashboard",
  admin: "admin",
};

export const canAccess = (role, tab) => (TABS_BY_ROLE[role] || []).includes(tab);

/** The tab to actually show: the requested one if the role may open it, else the role's home tab. */
export const resolveTab = (role, requested) =>
  canAccess(role, requested) ? requested : DEFAULT_TAB[role] || "jobs";
