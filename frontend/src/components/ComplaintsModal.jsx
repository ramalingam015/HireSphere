import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client";
import { 
  MessageSquare, AlertTriangle, CheckCircle2, AlertCircle, 
  Send, X, Sparkles, Clock, ShieldAlert, FileText 
} from "lucide-react";

export const ComplaintsModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("submit"); // "submit" or "history"
  const [category, setCategory] = useState("suggestion");
  const [targetUserId, setTargetUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchUsersList();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchUsersList = async () => {
    try {
      const data = await apiRequest("/api/complaints/users-list");
      setUsersList(data || []);
    } catch (err) {
      console.warn("Could not fetch user list:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await apiRequest("/api/complaints/my");
      setHistoryList(data || []);
    } catch (err) {
      console.error("Could not fetch complaints history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      await apiRequest("/api/complaints", {
        method: "POST",
        body: JSON.stringify({
          category,
          target_user_id: targetUserId ? parseInt(targetUserId) : null,
          subject: subject.trim(),
          description: description.trim()
        })
      });

      setSuccessMsg("Your complaint / suggestion has been registered with the platform administrators. Thank you!");
      setSubject("");
      setDescription("");
      setTargetUserId("");
      setTimeout(() => {
        fetchHistory();
        setActiveTab("history");
        setSuccessMsg("");
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit complaint.");
    } finally {
      setLoading(false);
    }
  };

  const isSpamReport = category === "spam_recruiter" || category === "spam_user";

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: "620px", width: "95%" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <MessageSquare size={22} color="var(--primary)" />
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
              Feedback, Complaints & Spam Reports
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab navigation */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "submit" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("submit")}
          >
            ✏️ Submit New Report / Feedback
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === "history" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("history")}
          >
            📋 My Submitted Items ({historyList.length})
          </button>
        </div>

        {activeTab === "submit" && (
          <form onSubmit={handleSubmit}>
            {successMsg && (
              <div style={{ background: "#d1fae5", color: "#065f46", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}
            {errorMsg && (
              <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            {/* Category selection */}
            <div className="form-group">
              <label className="form-label">What would you like to submit?</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${category === "suggestion" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCategory("suggestion")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  💡 Suggestion / Improvement
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${category === "complaint" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCategory("complaint")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  ⚠️ Platform Issue / Bug
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${category === "spam_recruiter" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCategory("spam_recruiter")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  👔 Report Spam Recruiter
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${category === "spam_user" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setCategory("spam_user")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  🎓 Report Spam User / Candidate
                </button>
              </div>
            </div>

            {/* Optional target user selection for spam reports */}
            {isSpamReport && (
              <div className="form-group" style={{ background: "#fff1f2", padding: "0.75rem", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <label className="form-label" style={{ color: "#991b1b" }}>
                  Select Reported Person (Optional if name is in description)
                </label>
                <select
                  className="form-select"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                >
                  <option value="">-- Choose specific user / recruiter from directory --</option>
                  {usersList
                    .filter((u) => category === "spam_recruiter" ? u.role === "recruiter" : u.role === "candidate")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email}) {u.company ? `• ${u.company}` : ""}
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: "0.72rem", color: "#b91c1c", marginTop: "0.3rem", display: "block" }}>
                  Administrators will review this report and can block or suspend the offender.
                </span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Subject / Title *</label>
              <input
                type="text"
                className="form-input"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Inappropriate job posting, UI suggestion, fake profile..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Details / Description *</label>
              <textarea
                className="form-textarea"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide full details, links, or context to help administrators take appropriate action..."
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Submitting..." : "Send to Administrator"}
              </button>
            </div>
          </form>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div>
            {historyLoading ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem" }}>
                Loading your submitted feedback...
              </p>
            ) : historyList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", background: "#f8fafc", borderRadius: "8px" }}>
                <MessageSquare size={32} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
                <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>No reports or suggestions submitted yet.</p>
                <p style={{ fontSize: "0.8rem" }}>Feel free to submit feedback or report spam anytime!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "360px", overflowY: "auto" }}>
                {historyList.map((item) => (
                  <div key={item.id} style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{item.subject}</span>
                      <span className={`status-pill ${
                        item.status === "RESOLVED" ? "status-selected" :
                        item.status === "DISMISSED" ? "status-rejected" : "status-in-review"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                      Category: <strong>{item.category}</strong> • Date: {new Date(item.created_at).toLocaleDateString()}
                      {item.target_user_name && ` • Reported: ${item.target_user_name}`}
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#334155", margin: 0 }}>
                      {item.description}
                    </p>
                    {item.admin_notes && (
                      <div style={{ marginTop: "0.5rem", background: "#f1f5f9", padding: "0.5rem", borderRadius: "6px", fontSize: "0.78rem" }}>
                        <strong>Admin Response:</strong> {item.admin_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
