import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../api/client";
import { 
  MessageSquare, AlertTriangle, CheckCircle2, AlertCircle, 
  Send, X, Sparkles, Clock, ShieldAlert, FileText, Search,
  Building, User, Check, RefreshCw
} from "lucide-react";

export const ComplaintsModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("submit"); // "submit" or "history"
  const [category, setCategory] = useState("suggestion");
  const [targetUserId, setTargetUserId] = useState("");
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    // Reset any target selection when switching category
    setSelectedTarget(null);
    setTargetUserId("");
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const targetRole = category === "spam_recruiter" ? "recruiter" : "candidate";
        const results = await apiRequest(
          `/api/complaints/search-target?q=${encodeURIComponent(val.trim())}&role=${targetRole}`
        );
        setSearchResults(results || []);
      } catch (err) {
        console.warn("Target search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectTarget = (target) => {
    setSelectedTarget(target);
    setTargetUserId(target.id);
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleClearTarget = () => {
    setSelectedTarget(null);
    setTargetUserId("");
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
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
      setSelectedTarget(null);
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
  const searchRoleLabel = category === "spam_recruiter" ? "Recruiter" : "Candidate / User";

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
                  onClick={() => handleCategoryChange("suggestion")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  💡 Suggestion / Improvement
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${category === "complaint" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => handleCategoryChange("complaint")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  ⚠️ Platform Issue / Bug
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${category === "spam_recruiter" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => handleCategoryChange("spam_recruiter")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  👔 Report Spam Recruiter
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${category === "spam_user" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => handleCategoryChange("spam_user")}
                  style={{ fontSize: "0.8rem", textAlign: "left" }}
                >
                  🎓 Report Spam User / Candidate
                </button>
              </div>
            </div>

            {/* Targeted search for spam reports (Strictly without revealing full directory or emails) */}
            {isSpamReport && (
              <div className="form-group" style={{ background: "#fff1f2", padding: "0.85rem", borderRadius: "8px", border: "1px solid #fecaca" }}>
                <label className="form-label" style={{ color: "#991b1b", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                  <ShieldAlert size={16} /> Search & Select {searchRoleLabel}
                </label>

                {selectedTarget ? (
                  // Selected person confirmed card
                  <div style={{ 
                    background: "#ffffff", 
                    border: "1px solid #fca5a5", 
                    borderRadius: "6px", 
                    padding: "0.65rem 0.85rem", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    marginTop: "0.25rem"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div style={{ background: "#fee2e2", color: "#b91c1c", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem" }}>
                        {selectedTarget.full_name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1f2937" }}>
                          {selectedTarget.full_name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {selectedTarget.company && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                              <Building size={12} /> {selectedTarget.company}
                            </span>
                          )}
                          <span style={{ textTransform: "capitalize", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                            {selectedTarget.role}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearTarget}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                      title="Clear and search someone else"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  // Search box with privacy-preserving live autocomplete
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: "10px" }} />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: "32px", fontSize: "0.88rem", width: "100%" }}
                        placeholder={`Type ${category === "spam_recruiter" ? "recruiter name or company" : "user name"} (min 2 letters)...`}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onFocus={() => searchQuery.trim().length >= 2 && setShowDropdown(true)}
                      />
                      {isSearching && (
                        <RefreshCw size={14} color="var(--text-muted)" className="spin" style={{ position: "absolute", right: "12px", animation: "spin 1s linear infinite" }} />
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showDropdown && searchQuery.trim().length >= 2 && (
                      <div style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "#ffffff",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                        zIndex: 10,
                        marginTop: "4px",
                        maxHeight: "220px",
                        overflowY: "auto"
                      }}>
                        {searchResults.length === 0 ? (
                          <div style={{ padding: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
                            {isSearching ? "Searching..." : `No matching ${searchRoleLabel.toLowerCase()} found. You can still describe them in details below.`}
                          </div>
                        ) : (
                          searchResults.map((target) => (
                            <div
                              key={target.id}
                              onClick={() => handleSelectTarget(target)}
                              style={{
                                padding: "0.6rem 0.85rem",
                                borderBottom: "1px solid #f1f5f9",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                transition: "background 0.15s ease"
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                            >
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)" }}>
                                  {target.full_name}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "2px" }}>
                                  {target.company && (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                      <Building size={11} /> {target.company}
                                    </span>
                                  )}
                                  {target.location && <span>• 📍 {target.location}</span>}
                                </div>
                              </div>
                              <span style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: 600 }}>
                                Select ↵
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <span style={{ fontSize: "0.72rem", color: "#b91c1c", marginTop: "0.4rem", display: "block" }}>
                  💡 Select the person you want to report, or leave blank and explain in the description below. Emails are kept strictly private.
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
