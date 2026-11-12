import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client";
import { 
  Shield, CheckCircle, XCircle, AlertTriangle, Users, Briefcase, 
  Trash2, EyeOff, Eye, RefreshCw, Flag, Activity, MessageSquare,
  UserX, UserCheck, Search, Filter, Sparkles, TrendingUp, HelpCircle
} from "lucide-react";

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("complaints"); // "complaints", "users", "recruiters", "spam_monitor"
  const [recruiters, setRecruiters] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [spamData, setSpamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [complaintStatusFilter, setComplaintStatusFilter] = useState("ALL");
  const [complaintCategoryFilter, setComplaintCategoryFilter] = useState("all");

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [recData, usersData, compData, sData] = await Promise.all([
        apiRequest("/api/admin/recruiters"),
        apiRequest("/api/admin/users"),
        apiRequest("/api/admin/complaints"),
        apiRequest("/api/admin/spam-monitor")
      ]);
      setRecruiters(recData || []);
      setAllUsers(usersData || []);
      setComplaints(compData || []);
      setSpamData(sData || null);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleRecruiterAction = async (recruiterId, status, reason = "") => {
    try {
      setActionLoading(true);
      await apiRequest(`/api/admin/recruiters/${recruiterId}/action`, {
        method: "POST",
        body: JSON.stringify({ status, reason })
      });
      await fetchAllData();
    } catch (err) {
      alert("Action failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserBlock = async (userId, userName, currentBlocked) => {
    const action = currentBlocked ? "unblock" : "block";
    let reason = "";
    if (!currentBlocked) {
      reason = window.prompt(`Enter reason for blocking ${userName} (e.g. repeated spam, violation of policy):`, "Violation of platform community standards");
      if (reason === null) return; // user cancelled
    } else {
      if (!window.confirm(`Are you sure you want to unblock ${userName}?`)) return;
    }

    try {
      setActionLoading(true);
      await apiRequest(`/api/admin/users/${userId}/block`, {
        method: "POST",
        body: JSON.stringify({
          is_blocked: !currentBlocked,
          reason: reason || "Administrative action"
        })
      });
      await fetchAllData();
      alert(`User ${userName} successfully ${action}ed.`);
    } catch (err) {
      alert(`Failed to ${action} user: ` + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplaintAction = async (complaintId, status) => {
    let adminNotes = "";
    if (status === "RESOLVED") {
      adminNotes = window.prompt("Enter optional resolution note for the user:", "Reviewed and resolved by platform administrator.");
      if (adminNotes === null) return;
    }

    try {
      setActionLoading(true);
      await apiRequest(`/api/admin/complaints/${complaintId}/action`, {
        method: "POST",
        body: JSON.stringify({ status, admin_notes: adminNotes || "" })
      });
      await fetchAllData();
    } catch (err) {
      alert("Failed to update complaint: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleJobSpam = async (jobId) => {
    try {
      await apiRequest(`/api/admin/jobs/${jobId}/toggle-spam`, { method: "POST" });
      await fetchAllData();
    } catch (err) {
      alert("Failed to update job status: " + err.message);
    }
  };

  const handleResetDatabase = async () => {
    const confirm = window.confirm(
      "⚠️ DANGER: This will permanently wipe ALL user accounts, passwords, jobs, applications, and uploaded files!\n\nAre you sure you want to start from scratch?"
    );
    if (!confirm) return;

    // Never pre-fill secret key in prompt
    const secretKey = window.prompt("Enter Admin Secret Key to authorize factory reset:", "");
    if (!secretKey) return;

    try {
      setActionLoading(true);
      const res = await apiRequest("/api/admin/reset-database", {
        method: "POST",
        body: JSON.stringify({ admin_secret_key: secretKey })
      });
      alert(res.message || "Platform wiped successfully!");
      localStorage.clear();
      window.location.reload();
    } catch (err) {
      alert("Reset failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users
  const filteredUsers = allUsers.filter((u) => {
    if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      const matchName = u.full_name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchCompany = u.company?.toLowerCase().includes(q);
      return matchName || matchEmail || matchCompany;
    }
    return true;
  });

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (complaintStatusFilter !== "ALL" && c.status !== complaintStatusFilter) return false;
    if (complaintCategoryFilter !== "all" && c.category !== complaintCategoryFilter) return false;
    return true;
  });

  const pendingComplaintsCount = complaints.filter(c => c.status === "PENDING").length;

  return (
    <div>
      {/* Title & Refresh */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={22} style={{ color: "var(--danger)" }} />
            Administrator Control Center & Moderation Hub
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Audit complaints, moderate and block spam users/recruiters, review platform metrics, and manage recruiter onboarding.
          </p>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={fetchAllData}
          disabled={loading || actionLoading}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh Data
        </button>
      </div>

      {/* Enhanced & Efficient Stats KPI Bar */}
      {spamData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          {/* Complaints Stat Card */}
          <div className="card" style={{ padding: "1rem", borderLeft: pendingComplaintsCount > 0 ? "4px solid #ef4444" : "4px solid #10b981" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>COMPLAINTS INBOX</span>
              <MessageSquare size={14} color={pendingComplaintsCount > 0 ? "#ef4444" : "#10b981"} />
            </div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: pendingComplaintsCount > 0 ? "#dc2626" : "var(--text-main)", marginTop: "0.2rem" }}>
              {pendingComplaintsCount}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              {spamData.total_complaints || complaints.length} total filed ({spamData.resolved_complaints || 0} resolved)
            </div>
          </div>

          {/* Pending Recruiter Approvals */}
          <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #f59e0b" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>ONBOARDING APPROVALS</span>
              <Users size={14} color="#f59e0b" />
            </div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: spamData.pending_recruiters > 0 ? "#d97706" : "var(--text-main)", marginTop: "0.2rem" }}>
              {spamData.pending_recruiters}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Recruiters awaiting verification
            </div>
          </div>

          {/* Platform Users */}
          <div className="card" style={{ padding: "1rem", borderLeft: "4px solid var(--primary)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>REGISTERED USERS</span>
              <Users size={14} color="var(--primary)" />
            </div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--primary)", marginTop: "0.2rem" }}>
              {spamData.total_users || allUsers.length}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              {spamData.total_candidates} students • {spamData.total_recruiters} recruiters ({spamData.blocked_users_count || 0} blocked)
            </div>
          </div>

          {/* Active Jobs */}
          <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #06b6d4" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>ACTIVE JOBS</span>
              <Briefcase size={14} color="#06b6d4" />
            </div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#0284c7", marginTop: "0.2rem" }}>
              {spamData.active_jobs !== undefined ? spamData.active_jobs : spamData.total_jobs}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              {spamData.spam_jobs_count || 0} marked spam • {spamData.total_applications} applications
            </div>
          </div>

          {/* Pipeline Conversion Rate */}
          <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #8b5cf6" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>INTERVIEW CONVERSION</span>
              <TrendingUp size={14} color="#8b5cf6" />
            </div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#7c3aed", marginTop: "0.2rem" }}>
              {spamData.conversion_rate || 0}%
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Applications converted to interviews
            </div>
          </div>

          {/* Avg ATS Score */}
          <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #10b981" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>AVERAGE ATS SCORE</span>
              <Sparkles size={14} color="#10b981" />
            </div>
            <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#059669", marginTop: "0.2rem" }}>
              {spamData.avg_ats_score || 0}%
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Candidate skills match quality
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-nav" style={{ marginBottom: "1.25rem" }}>
        <button 
          className={`tab-btn ${activeTab === "complaints" ? "active" : ""}`}
          onClick={() => setActiveTab("complaints")}
        >
          <MessageSquare size={16} /> Complaints & Suggestions ({pendingComplaintsCount > 0 ? `${pendingComplaintsCount} Pending` : complaints.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <UserX size={16} /> User Moderation & Blocking ({allUsers.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === "recruiters" ? "active" : ""}`}
          onClick={() => setActiveTab("recruiters")}
        >
          <Users size={16} /> Recruiter Approvals ({recruiters.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === "spam_monitor" ? "active" : ""}`}
          onClick={() => setActiveTab("spam_monitor")}
        >
          <Flag size={16} /> Spam & Activity Log
        </button>
      </div>

      {/* 1. Complaints & Suggestions Tab */}
      {activeTab === "complaints" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Filter Bar */}
          <div className="card" style={{ padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Filter Status:</span>
              {["ALL", "PENDING", "RESOLVED", "DISMISSED"].map((st) => (
                <button
                  key={st}
                  className={`btn btn-sm ${complaintStatusFilter === st ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setComplaintStatusFilter(st)}
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                >
                  {st}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Category:</span>
              <select
                className="form-select"
                value={complaintCategoryFilter}
                onChange={(e) => setComplaintCategoryFilter(e.target.value)}
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", width: "auto" }}
              >
                <option value="all">All Categories</option>
                <option value="suggestion">Suggestions</option>
                <option value="complaint">Platform Complaints</option>
                <option value="spam_recruiter">Spam Recruiters</option>
                <option value="spam_user">Spam Candidates</option>
              </select>
            </div>
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
              <MessageSquare size={36} style={{ margin: "0 auto 0.5rem", opacity: 0.4 }} />
              <p style={{ fontWeight: 600, fontSize: "0.95rem" }}>No complaints or suggestions match the selected filter.</p>
            </div>
          ) : (
            filteredComplaints.map((c) => (
              <div 
                key={c.id} 
                className="card" 
                style={{ 
                  borderLeft: c.status === "PENDING" ? "4px solid #ef4444" : "4px solid #10b981",
                  background: c.status === "PENDING" ? "#ffffff" : "#f8fafc"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                      <span className={`status-pill ${
                        c.category.includes("spam") ? "status-rejected" :
                        c.category === "suggestion" ? "status-selected" : "status-in-review"
                      }`}>
                        {c.category.toUpperCase().replace("_", " ")}
                      </span>
                      <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                        {c.subject}
                      </h4>
                    </div>

                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                      Submitted by: <strong>{c.reporter_name}</strong> ({c.reporter_email} • {c.reporter_role}) • {new Date(c.created_at).toLocaleString()}
                    </div>
                  </div>

                  <span className={`status-pill ${
                    c.status === "RESOLVED" ? "status-selected" :
                    c.status === "DISMISSED" ? "status-rejected" : "status-in-review"
                  }`}>
                    {c.status}
                  </span>
                </div>

                <div style={{ background: "#f1f5f9", padding: "0.85rem", borderRadius: "8px", margin: "0.75rem 0", fontSize: "0.85rem", color: "#334155" }}>
                  {c.description}
                </div>

                {/* Target User Info & 1-Click Block Action */}
                {c.target_user_id && (
                  <div style={{ 
                    background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", 
                    padding: "0.75rem", marginBottom: "0.75rem", display: "flex", 
                    justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" 
                  }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#991b1b" }}>⚠️ REPORTED OFFENDER:</span>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#7f1d1d" }}>
                        {c.target_user_name} ({c.target_user_email}) • Role: {c.target_user_role}
                      </div>
                    </div>

                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleToggleUserBlock(c.target_user_id, c.target_user_name, false)}
                      disabled={actionLoading}
                      style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <UserX size={13} /> 1-Click Block This User
                    </button>
                  </div>
                )}

                {c.admin_notes && (
                  <div style={{ fontSize: "0.8rem", color: "#065f46", background: "#d1fae5", padding: "0.5rem", borderRadius: "6px", marginBottom: "0.75rem" }}>
                    <strong>Admin Note:</strong> {c.admin_notes}
                  </div>
                )}

                {/* Complaint Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                  {c.status === "PENDING" && (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleComplaintAction(c.id, "RESOLVED")}
                        disabled={actionLoading}
                        style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                      >
                        <CheckCircle size={13} /> Mark Resolved
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleComplaintAction(c.id, "DISMISSED")}
                        disabled={actionLoading}
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {c.status !== "PENDING" && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleComplaintAction(c.id, "PENDING")}
                      disabled={actionLoading}
                    >
                      Reopen Complaint
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. User Moderation & Blocking Tab */}
      {activeTab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* User Search & Filter Bar */}
          <div className="card" style={{ padding: "0.85rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "240px" }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                className="form-input"
                placeholder="Search candidates or recruiters by name, email, company..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ margin: 0 }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>Role:</span>
              <select
                className="form-select"
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", width: "auto" }}
              >
                <option value="all">All Roles</option>
                <option value="candidate">🎓 Students (Candidates)</option>
                <option value="recruiter">👔 Recruiters</option>
              </select>
            </div>
          </div>

          {/* User Directory Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    <th style={{ padding: "0.75rem 1rem" }}>User</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Role</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Company / Org</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Complaints</th>
                    <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Moderation Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                        No users match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isBlocked = u.is_blocked || !u.is_active;
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid var(--border)", background: isBlocked ? "#fff1f2" : "#ffffff" }}>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{u.full_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>
                          </td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            <span className={`nav-role-badge badge-${u.role}`} style={{ textTransform: "capitalize" }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 1rem", color: "var(--text-muted)" }}>
                            {u.company || u.location || "—"}
                          </td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            {u.complaints_count > 0 ? (
                              <span style={{ color: "#dc2626", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                ⚠️ {u.complaints_count} Report{u.complaints_count > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span style={{ color: "#16a34a", fontSize: "0.8rem" }}>0 Reports</span>
                            )}
                          </td>
                          <td style={{ padding: "0.75rem 1rem" }}>
                            {isBlocked ? (
                              <span className="status-pill status-rejected" title={u.block_reason || "Blocked"}>
                                ⛔ Blocked / Suspended
                              </span>
                            ) : (
                              <span className="status-pill status-selected">
                                ✓ Active
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                            {u.role !== "admin" && (
                              <button
                                className={`btn btn-sm ${isBlocked ? "btn-success" : "btn-danger"}`}
                                onClick={() => handleToggleUserBlock(u.id, u.full_name, isBlocked)}
                                disabled={actionLoading}
                                style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem" }}
                              >
                                {isBlocked ? (
                                  <>
                                    <UserCheck size={13} /> Unblock User
                                  </>
                                ) : (
                                  <>
                                    <UserX size={13} /> Block User
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Recruiter Management Tab (FR-ADM-01..07) */}
      {activeTab === "recruiters" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {recruiters.map((r) => {
            const isPending = r.recruiter_status === "pending";
            const isApproved = r.recruiter_status === "approved";
            const isSuspended = r.recruiter_status === "suspended";

            return (
              <div key={r.id} className="card">
                <div className="card-header">
                  <div>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                      {r.full_name}
                    </h4>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {r.email} • {r.company || "Independent Organization"} • {r.location || "Remote"}
                    </p>
                    {r.headline && (
                      <p style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.3rem" }}>
                        "{r.headline}"
                      </p>
                    )}
                  </div>

                  <div>
                    {isPending && (
                      <span className="status-pill status-in-review">
                        ⏳ Pending Approval
                      </span>
                    )}
                    {isApproved && (
                      <span className="status-pill status-selected">
                        ✓ Approved & Active
                      </span>
                    )}
                    {isSuspended && (
                      <span className="status-pill status-rejected">
                        ⛔ Suspended (On Hold)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Account ID: #{r.id} • Registered: {new Date(r.created_at).toLocaleDateString()}
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {isPending && (
                      <>
                        <button 
                          className="btn btn-success btn-sm"
                          onClick={() => handleRecruiterAction(r.id, "approved", "Approved by administrator")}
                          disabled={actionLoading}
                        >
                          <CheckCircle size={14} /> Approve Recruiter
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRecruiterAction(r.id, "rejected", "Rejected by administrator")}
                          disabled={actionLoading}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRecruiterAction(r.id, "suspended", "Deactivated by administrator for review")}
                        disabled={actionLoading}
                        title="Apply Hold overlay, cancel booked interviews, preserve history"
                      >
                        <AlertTriangle size={14} /> Deactivate (Apply Hold Overlay)
                      </button>
                    )}

                    {isSuspended && (
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => handleRecruiterAction(r.id, "reactivate", "Reactivated by administrator")}
                        disabled={actionLoading}
                        title="Remove overlay and reactivate recruiter"
                      >
                        <RefreshCw size={14} /> Reactivate Recruiter
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Spam & Activity Monitor Tab */}
      {activeTab === "spam_monitor" && spamData && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Job Postings Inspection */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Job Postings Spam Audit
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Monitors suspicious clickbait, external redirect links, and flagged recruiter job openings.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {spamData.jobs.map((item) => (
                <div 
                  key={item.job.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.85rem 1rem",
                    borderRadius: "8px",
                    border: item.is_flagged ? "2px solid #ef4444" : "1px solid var(--border)",
                    background: item.is_flagged ? "#fef2f2" : "#ffffff"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {item.job.title}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                      Company: {item.job.company} • Posted by: {item.job.recruiter_name}
                    </div>
                    {item.reason && item.reason !== "Normal" && (
                      <div style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: 600, marginTop: "0.25rem" }}>
                        ⚠️ Trigger Reason: {item.reason}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {item.is_flagged ? (
                      <span className="status-pill status-rejected">Spam Flagged</span>
                    ) : item.is_suspicious ? (
                      <span className="status-pill status-in-review">Suspicious</span>
                    ) : (
                      <span className="status-pill status-selected">Clean</span>
                    )}

                    <button 
                      className={`btn btn-sm ${item.is_flagged ? "btn-secondary" : "btn-danger"}`}
                      onClick={() => handleToggleJobSpam(item.job.id)}
                    >
                      {item.is_flagged ? "Unflag / Restore" : "Mark as Spam"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Student Application Activity Monitor */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Student Activity Log & Applications
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Real-time audit log of candidate submissions, ATS evaluations, and state changes.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {spamData.applications.map((app) => (
                <div 
                  key={app.application_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "6px",
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    fontSize: "0.85rem"
                  }}
                >
                  <div>
                    <strong>{app.candidate_name}</strong> applied for <em>{app.job_title}</em>
                    <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>({app.candidate_email})</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="status-pill status-applied">{app.status}</span>
                    {app.ats_score !== null && (
                      <span className="status-pill status-interview">Score: {app.ats_score}%</span>
                    )}
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {new Date(app.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone: Factory Reset Database */}
      <div className="card" style={{ marginTop: "2rem", border: "1px solid #fecaca", background: "#fff1f2", padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h4 style={{ margin: 0, color: "#991b1b", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Trash2 size={18} /> Danger Zone: Factory Reset All Platform Data
            </h4>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "#b91c1c" }}>
              Permanently wipe all users, passwords, jobs, applications, interview slots, and uploaded files to restart the platform fresh.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: "#dc2626", color: "#ffffff", borderColor: "#b91c1c", fontWeight: 700 }}
            onClick={handleResetDatabase}
            disabled={actionLoading}
          >
            {actionLoading ? "Resetting..." : "🗑️ Wipe All Data & Start Fresh"}
          </button>
        </div>
      </div>
    </div>
  );
};
