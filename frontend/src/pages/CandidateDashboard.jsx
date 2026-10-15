import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ATSModal } from "../components/ATSModal";
import { SlotBookingModal } from "../components/SlotBookingModal";
import { 
  Search, Sparkles, MapPin, DollarSign, Calendar, MessageSquare, 
  CheckCircle2, Clock, XCircle, AlertTriangle, Filter, ArrowRight 
} from "lucide-react";

export const CandidateDashboard = ({ onOpenChatWith, activeSubTab = "jobs" }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState(activeSubTab);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [isAiSearch, setIsAiSearch] = useState(false);

  // Modals
  const [selectedJobForATS, setSelectedJobForATS] = useState(null);
  const [selectedAppForInterview, setSelectedAppForInterview] = useState(null);

  const fetchJobs = async (useAi = false) => {
    try {
      setLoading(true);
      let endpoint = "/api/jobs";
      if (useAi && aiQuery.trim()) {
        endpoint = `/api/jobs/ai-search?q=${encodeURIComponent(aiQuery.trim())}`;
      } else {
        const params = new URLSearchParams();
        if (searchKeyword) params.append("search", searchKeyword);
        if (locationFilter) params.append("location", locationFilter);
        if (jobTypeFilter) params.append("job_type", jobTypeFilter);
        if (skillFilter) params.append("skill", skillFilter);
        const queryStr = params.toString();
        if (queryStr) endpoint += `?${queryStr}`;
      }

      const data = await apiRequest(endpoint);
      setJobs(data);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const data = await apiRequest("/api/applications/my-applications");
      setApplications(data);
    } catch (err) {
      console.error("Error fetching applications:", err);
    }
  };

  useEffect(() => {
    if (tab === "jobs") {
      fetchJobs(isAiSearch);
    } else {
      fetchApplications();
    }
  }, [tab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setIsAiSearch(false);
    fetchJobs(false);
  };

  const handleAiSearchSubmit = (e) => {
    e.preventDefault();
    setIsAiSearch(true);
    fetchJobs(true);
  };

  const handleWithdraw = async (appId) => {
    if (!window.confirm("Are you sure you want to withdraw this application? (FR-STAT-04)")) {
      return;
    }
    try {
      await apiRequest(`/api/applications/${appId}/withdraw`, { method: "POST" });
      await fetchApplications();
    } catch (err) {
      alert(err.message || "Failed to withdraw application");
    }
  };

  const getStatusBadge = (status, isHold) => {
    if (isHold) {
      return (
        <span className="status-pill status-in-review" title="Recruiter account suspended by admin">
          <AlertTriangle size={12} /> Held (Overlay)
        </span>
      );
    }
    switch (status) {
      case "Applied":
        return <span className="status-pill status-applied">Applied</span>;
      case "In Review":
        return <span className="status-pill status-in-review">In Review</span>;
      case "Interview":
        return <span className="status-pill status-interview">Interview Stage</span>;
      case "Selected":
        return <span className="status-pill status-selected">Selected / Offer</span>;
      case "Rejected":
        return <span className="status-pill status-rejected">Rejected</span>;
      case "Withdrawn":
        return <span className="status-pill status-withdrawn">Withdrawn</span>;
      case "Candidate Declined":
        return <span className="status-pill status-declined">Candidate Declined</span>;
      default:
        return <span className="status-pill status-applied">{status}</span>;
    }
  };

  return (
    <div>
      {/* Tab Switcher */}
      <div className="tabs-nav">
        <button 
          className={`tab-btn ${tab === "jobs" ? "active" : ""}`}
          onClick={() => setTab("jobs")}
        >
          Explore Jobs & ATS Scanner
        </button>
        <button 
          className={`tab-btn ${tab === "applications" ? "active" : ""}`}
          onClick={() => setTab("applications")}
        >
          My Applications ({applications.length})
        </button>
      </div>

      {tab === "jobs" && (
        <div>
          {/* Search Controls */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            {/* AI Natural Language Search (FR-SCH-02 / FR-SCH-03) */}
            <form onSubmit={handleAiSearchSubmit} style={{ marginBottom: "1.25rem" }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)" }}>
                <Sparkles size={16} />
                <span>AI Natural Language Job Search (FR-SCH-02)</span>
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g. Looking for a remote junior backend role with python and docker..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
                  <Sparkles size={15} /> AI Search
                </button>
              </div>
            </form>

            {/* Structured Search (FR-SCH-01) */}
            <form onSubmit={handleSearchSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <input 
                    type="text" 
                    placeholder="Keyword / Job Title" 
                    className="form-input"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="Location (e.g. Remote, SF)" 
                    className="form-input"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  />
                </div>
                <div>
                  <select 
                    className="form-select"
                    value={jobTypeFilter}
                    onChange={(e) => setJobTypeFilter(e.target.value)}
                  >
                    <option value="">All Job Types</option>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="Required Skill (e.g. Python)" 
                    className="form-input"
                    value={skillFilter}
                    onChange={(e) => setSkillFilter(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSearchKeyword("");
                    setLocationFilter("");
                    setJobTypeFilter("");
                    setSkillFilter("");
                    setAiQuery("");
                    setIsAiSearch(false);
                    fetchJobs(false);
                  }}
                >
                  Reset Filters
                </button>
                <button type="submit" className="btn btn-secondary btn-sm">
                  <Filter size={14} /> Filter Jobs
                </button>
              </div>
            </form>
          </div>

          {/* Job Listings Grid */}
          {loading ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
              Loading job postings...
            </p>
          ) : jobs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <h3>No matching jobs found</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Try adjusting your search filters or AI prompt.
              </p>
            </div>
          ) : (
            <div className="grid-cols-2">
              {jobs.map((job) => {
                const alreadyApplied = applications.some(a => a.job_id === job.id);
                return (
                  <div key={job.id} className="card">
                    <div className="card-header">
                      <div>
                        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>
                          {job.title}
                        </h3>
                        <p style={{ fontWeight: 600, color: "var(--primary)", fontSize: "0.9rem" }}>
                          {job.company}
                        </p>
                      </div>
                      <span className="skill-tag skill-pref">
                        {job.job_type}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.85rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <MapPin size={14} /> {job.location}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <DollarSign size={14} /> {job.salary_range}
                      </span>
                    </div>

                    <p style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "1rem", lineHeight: 1.4 }}>
                      {job.description}
                    </p>

                    {/* Skills requirements */}
                    <div style={{ marginBottom: "1.25rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.4rem" }}>
                        Target Skills:
                      </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {job.skills?.map((s, idx) => (
                          <span 
                            key={idx} 
                            className={`skill-tag ${s.is_required ? "skill-req" : "skill-pref"}`}
                            title={s.is_required ? "Required Skill (70% ATS Weight)" : "Preferred Skill (30% ATS Weight)"}
                          >
                            {s.skill_name} {s.is_required ? "★" : ""}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => onOpenChatWith(job.recruiter)}
                        title="Chat with recruiter"
                      >
                        <MessageSquare size={13} /> Chat Recruiter
                      </button>

                      {alreadyApplied ? (
                        <span className="skill-tag skill-matched">
                          <CheckCircle2 size={13} /> Applied
                        </span>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => setSelectedJobForATS(job)}
                        >
                          <Sparkles size={14} /> Check ATS & Apply
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Applications Tab */}
      {tab === "applications" && (
        <div>
          {applications.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
              <Clock size={36} style={{ color: "var(--text-muted)", margin: "0 auto 0.75rem" }} />
              <h3>No applications submitted yet</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
                Explore openings and scan your resume with our ATS engine to get started.
              </p>
              <button className="btn btn-primary" onClick={() => setTab("jobs")}>
                Browse Jobs
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {applications.map((app) => {
                const canWithdraw = app.status === "Applied" || app.status === "In Review"; // FR-STAT-04
                const isInterviewStage = app.status === "Interview";

                return (
                  <div key={app.id} className="card">
                    {/* FR-ADM-02 / FR-ADM-03: Hold Overlay Banner */}
                    {app.is_hold_overlay && (
                      <div className="hold-banner">
                        <AlertTriangle size={18} />
                        <div>
                          <strong>Administrative Hold / Suspended Overlay:</strong> This recruiter account is currently on administrative hold. Your application state ({app.hold_previous_status || app.status}) is preserved.
                        </div>
                      </div>
                    )}

                    <div className="card-header">
                      <div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                          {app.job?.title}
                        </h3>
                        <p style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.9rem" }}>
                          {app.job?.company}
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        {getStatusBadge(app.status, app.is_hold_overlay)}
                        {app.ats_score !== null && (
                          <span className={`status-pill ${
                            app.ats_score >= 70 ? "status-selected" : app.ats_score >= 40 ? "status-in-review" : "status-rejected"
                          }`}>
                            ATS: {app.ats_score}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                      <span>Submitted: {new Date(app.created_at).toLocaleDateString()}</span>
                      <span>Resume File: {app.original_filename}</span>
                    </div>

                    {/* Booked Slot details if present */}
                    {app.booked_slot && (
                      <div style={{
                        background: "#e0e7ff",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        marginBottom: "1rem",
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}>
                        <div>
                          <strong>Scheduled Interview:</strong> {new Date(app.booked_slot.start_time).toLocaleString()}
                        </div>
                        {app.booked_slot.meeting_link && (
                          <a 
                            href={app.booked_slot.meeting_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-sm"
                            style={{ textDecoration: "none" }}
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => onOpenChatWith(app.job?.recruiter)}
                        >
                          <MessageSquare size={14} /> Message Recruiter
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {isInterviewStage && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedAppForInterview(app)}
                          >
                            <Calendar size={14} /> Manage Interview Slot
                          </button>
                        )}

                        {canWithdraw && (
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleWithdraw(app.id)}
                            title="FR-STAT-04: Withdraw before interview stage"
                          >
                            <XCircle size={14} /> Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ATS Scanner & Application Modal */}
      {selectedJobForATS && (
        <ATSModal 
          job={selectedJobForATS}
          onClose={() => setSelectedJobForATS(null)}
          onAppliedSuccess={() => {
            fetchApplications();
            setTab("applications");
          }}
        />
      )}

      {/* Interview Slot Booking Modal */}
      {selectedAppForInterview && (
        <SlotBookingModal 
          application={selectedAppForInterview}
          onClose={() => setSelectedAppForInterview(null)}
          onUpdated={() => fetchApplications()}
        />
      )}
    </div>
  );
};
