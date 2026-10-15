import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client";
import { 
  Shield, CheckCircle, XCircle, AlertTriangle, Users, Briefcase, 
  Trash2, EyeOff, Eye, RefreshCw, Flag, Activity 
} from "lucide-react";

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("recruiters");
  const [recruiters, setRecruiters] = useState([]);
  const [spamData, setSpamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRecruiters = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/admin/recruiters");
      setRecruiters(data);
    } catch (err) {
      console.error("Error fetching recruiters:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpamData = async () => {
    try {
      const data = await apiRequest("/api/admin/spam-monitor");
      setSpamData(data);
    } catch (err) {
      console.error("Error fetching spam data:", err);
    }
  };

  useEffect(() => {
    fetchRecruiters();
    fetchSpamData();
  }, []);

  const handleRecruiterAction = async (recruiterId, status, reason = "") => {
    try {
      setActionLoading(true);
      await apiRequest(`/api/admin/recruiters/${recruiterId}/action`, {
        method: "POST",
        body: JSON.stringify({ status, reason })
      });
      await fetchRecruiters();
      await fetchSpamData();
    } catch (err) {
      alert("Action failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleJobSpam = async (jobId) => {
    try {
      await apiRequest(`/api/admin/jobs/${jobId}/toggle-spam`, { method: "POST" });
      await fetchSpamData();
    } catch (err) {
      alert("Failed to update job status: " + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={22} style={{ color: "var(--danger)" }} />
            Administrator Control Center
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Verify recruiter applications, manage suspensions and hold overlays, monitor spam jobs, and audit activity.
          </p>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => { fetchRecruiters(); fetchSpamData(); }}
          disabled={loading}
        >
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Summary Stat Cards */}
      {spamData && (
        <div className="grid-cols-3" style={{ marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>PENDING RECRUITERS</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: spamData.pending_recruiters > 0 ? "var(--warning)" : "var(--text-main)" }}>
              {spamData.pending_recruiters}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Awaiting Onboarding Approval
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>ACTIVE JOBS</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary)" }}>
              {spamData.total_jobs}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Total candidate applications: {spamData.total_applications}
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 600 }}>CANDIDATES ENROLLED</div>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--success)" }}>
              {spamData.total_candidates}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Total approved recruiters: {spamData.total_recruiters}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-nav">
        <button 
          className={`tab-btn ${activeTab === "recruiters" ? "active" : ""}`}
          onClick={() => setActiveTab("recruiters")}
        >
          <Users size={16} /> Recruiter Onboarding & Approvals ({recruiters.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === "spam_monitor" ? "active" : ""}`}
          onClick={() => setActiveTab("spam_monitor")}
        >
          <Flag size={16} /> Spam & Activity Monitor
        </button>
      </div>

      {/* Recruiter Management Tab (FR-ADM-01..07) */}
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
                        title="FR-ADM-02: Apply Hold overlay, cancel booked interviews, preserve history"
                      >
                        <AlertTriangle size={14} /> Deactivate (Apply Hold Overlay)
                      </button>
                    )}

                    {isSuspended && (
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={() => handleRecruiterAction(r.id, "reactivate", "Reactivated by administrator")}
                        disabled={actionLoading}
                        title="FR-ADM-07: Remove overlay and reactivate recruiter"
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

      {/* Spam & Activity Monitor Tab */}
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
    </div>
  );
};
