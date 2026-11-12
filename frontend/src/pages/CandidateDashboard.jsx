import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ATSModal } from "../components/ATSModal";
import { SlotBookingModal } from "../components/SlotBookingModal";
import { ResumeViewerModal } from "../components/ResumeViewerModal";
import { 
  Search, Sparkles, MapPin, DollarSign, Calendar, MessageSquare, 
  CheckCircle2, Clock, XCircle, AlertTriangle, Filter, ArrowRight,
  FileText, RefreshCw, Layers
} from "lucide-react";

export const CandidateDashboard = ({ onOpenChatWith, activeSubTab = "jobs", onNavigateToProfile }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState(activeSubTab);
  const [viewingResume, setViewingResume] = useState(null); // { path, name }
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [aiQuery, setAiQuery] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [rankByResume, setRankByResume] = useState(true);

  // Modals
  const [selectedJobForATS, setSelectedJobForATS] = useState(null);
  const [selectedAppForInterview, setSelectedAppForInterview] = useState(null);

  const searchRequestId = useRef(0);
  const [searchError, setSearchError] = useState("");

  // `overrides` lets callers (e.g. Reset) search with fresh values instead of stale state.
  const fetchJobs = async (overrides = {}) => {
    const f = {
      aiQuery, searchKeyword, locationFilter, jobTypeFilter, skillFilter, rankByResume,
      ...overrides,
    };
    const requestId = ++searchRequestId.current;
    try {
      setLoading(true);
      setSearchError("");
      const params = new URLSearchParams();
      if (f.aiQuery.trim()) params.append("q", f.aiQuery.trim());
      if (f.searchKeyword.trim()) params.append("search", f.searchKeyword.trim());
      if (f.locationFilter.trim()) params.append("location", f.locationFilter.trim());
      if (f.jobTypeFilter) params.append("job_type", f.jobTypeFilter);
      if (f.skillFilter.trim()) params.append("skill", f.skillFilter.trim());
      params.append("rank_by_resume", f.rankByResume ? "true" : "false");

      const data = await apiRequest(`/api/jobs/ai-recommendations?${params.toString()}`);
      if (requestId !== searchRequestId.current) return; // a newer search superseded this one
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestId !== searchRequestId.current) return;
      console.error("Error fetching jobs:", err);
      setJobs([]);
      setSearchError(err?.message || "Search failed. Please try again.");
    } finally {
      if (requestId === searchRequestId.current) setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const data = await apiRequest("/api/applications/my-applications");
      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching applications:", err);
    }
  };

  useEffect(() => {
    if (tab === "jobs") {
      fetchJobs();
    } else {
      fetchApplications();
    }
  }, [tab, rankByResume]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleResetFilters = () => {
    setAiQuery("");
    setSearchKeyword("");
    setLocationFilter("");
    setJobTypeFilter("");
    setSkillFilter("");
    setRankByResume(true);
    fetchJobs({
      aiQuery: "", searchKeyword: "", locationFilter: "", jobTypeFilter: "", skillFilter: "",
      rankByResume: true,
    });
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
          <Sparkles size={16} /> Explore AI Recommended Jobs & ATS
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
          {/* Active Profile Resume Indicator */}
          {user?.resume_filename ? (
            <div className="resume-indicator-banner">
              <FileText size={18} />
              <div style={{ flex: 1 }}>
                <span>Matching against Profile Resume: <strong>{user.resume_filename}</strong></span>
                <span style={{ fontSize: "0.78rem", display: "block", color: "#15803d" }}>
                  AI recommendations, compatibility scoring, and 1-click ATS scan active.
                </span>
              </div>
            </div>
          ) : (
            <div className="resume-tip-banner">
              <Sparkles size={18} />
              <div style={{ flex: 1 }}>
                <strong>Tip:</strong> Upload your PDF resume in your Profile to get highly personalized match scores and auto-extracted skills!
              </div>
            </div>
          )}

          {/* Search & Recommendation Controls */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <form onSubmit={handleSearchSubmit}>
              {/* Natural Language Prompt */}
              <div style={{ marginBottom: "1rem" }}>
                <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)", fontWeight: 600 }}>
                  <Sparkles size={16} />
                  <span>AI Natural Language Job Search & Recommendations (FR-SCH-02)</span>
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="e.g. Find remote backend engineering roles matching my Python and Docker skills..."
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
                    <Sparkles size={15} /> AI Search
                  </button>
                </div>
              </div>

              {/* Structured Filters */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <input 
                    type="text" 
                    placeholder="Filter by Keyword / Title" 
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

              {/* Toggles and Reset */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer", color: "var(--text-main)", userSelect: "none" }}>
                  <input 
                    type="checkbox" 
                    checked={rankByResume} 
                    onChange={(e) => setRankByResume(e.target.checked)}
                  />
                  <span>Rank openings by <strong>Profile Resume & Skills Match</strong></span>
                </label>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetFilters}
                  >
                    <RefreshCw size={13} /> Reset Filters
                  </button>
                  <button type="submit" className="btn btn-secondary btn-sm">
                    <Filter size={13} /> Apply Filters
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Job Listings Grid */}
          {loading ? (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "2.5rem" }}>
              <RefreshCw size={24} className="spin" style={{ margin: "0 auto 0.5rem auto", display: "block" }} />
              Scanning jobs & calculating AI recommendation scores...
            </p>
          ) : searchError ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <h3>Search could not be completed</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>{searchError}</p>
              <button className="btn btn-secondary btn-sm" onClick={() => fetchJobs()} style={{ marginTop: "1rem" }}>
                Try again
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <h3>No matching jobs found</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                Try relaxing your search filters or AI prompt to see more openings.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={handleResetFilters} style={{ marginTop: "1rem" }}>
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid-cols-2">
              {jobs.map((job) => {
                const alreadyApplied = applications.some(a => a.job_id === job.id);
                const isDeadlinePassed = job.application_deadline ? new Date(job.application_deadline) < new Date() : false;
                const matchInfo = job.ai_match;

                return (
                  <div key={job.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      {/* Top Bar with Title, Company & AI Match Badge */}
                      <div className="card-header" style={{ alignItems: "flex-start", marginBottom: "0.75rem" }}>
                        <div>
                          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)" }}>
                            {job.title}
                          </h3>
                          <p style={{ fontWeight: 600, color: "var(--primary)", fontSize: "0.9rem" }}>
                            {job.company}
                          </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
                          {matchInfo && (
                            <span 
                              className={`match-badge ${
                                matchInfo.score >= 75 ? "match-high" : matchInfo.score >= 50 ? "match-good" : "match-potential"
                              }`}
                              title={`AI Fit Score: ${matchInfo.score}%\nLevel: ${matchInfo.level}`}
                            >
                              <Sparkles size={11} /> {matchInfo.score}% Match
                            </span>
                          )}
                          <span className="skill-tag skill-pref">
                            {job.job_type}
                          </span>
                        </div>
                      </div>

                      {/* Location & Compensation Meta */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <MapPin size={14} /> {job.location}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <DollarSign size={14} /> {job.salary_range}
                        </span>
                        {job.application_deadline && (
                          <span style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "0.3rem",
                            color: isDeadlinePassed ? "#dc2626" : "#2563eb",
                            fontWeight: isDeadlinePassed ? 600 : 500
                          }}>
                            <Clock size={14} /> {isDeadlinePassed ? `Expired (${new Date(job.application_deadline).toLocaleDateString()})` : `Deadline: ${new Date(job.application_deadline).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>

                      {/* AI Recommendation Reasoning Banner */}
                      {matchInfo?.reasoning && (
                        <div style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          color: "#166534",
                          borderRadius: "8px",
                          padding: "0.45rem 0.65rem",
                          fontSize: "0.8rem",
                          marginBottom: "0.75rem",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.35rem",
                          lineHeight: 1.3
                        }}>
                          <Sparkles size={13} style={{ marginTop: "2px", flexShrink: 0, color: "#16a34a" }} />
                          <span><strong>AI Match:</strong> {matchInfo.reasoning}</span>
                        </div>
                      )}

                      <p style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "0.85rem", lineHeight: 1.4 }}>
                        {job.description}
                      </p>

                      {/* Skills requirements with match highlight */}
                      <div style={{ marginBottom: "1rem" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.4rem" }}>
                          Required & Target Skills:
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {job.skills?.map((s, idx) => {
                            const isSkillMatched = matchInfo?.matched_skills?.some(
                              ms => ms.toLowerCase() === s.skill_name.toLowerCase()
                            );
                            return (
                              <span 
                                key={idx} 
                                className={`skill-tag ${
                                  isSkillMatched 
                                    ? "skill-matched" 
                                    : s.is_required 
                                      ? "skill-req" 
                                      : "skill-pref"
                                }`}
                                title={
                                  isSkillMatched 
                                    ? "Matched with your skills/resume! ✓" 
                                    : s.is_required 
                                      ? "Required Skill (70% ATS Weight)" 
                                      : "Preferred Skill (30% ATS Weight)"
                                }
                              >
                                {isSkillMatched && <CheckCircle2 size={11} />}
                                {s.skill_name} {s.is_required && !isSkillMatched ? "★" : ""}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.85rem", borderTop: "1px solid var(--border)", marginTop: "auto" }}>
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
                      ) : isDeadlinePassed ? (
                        <span className="skill-tag" style={{ background: "#fee2e2", color: "#991b1b" }}>
                          <XCircle size={13} /> Deadline Closed
                        </span>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => setSelectedJobForATS(job)}
                        >
                          <Sparkles size={14} /> Scan ATS & Apply
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
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.15rem 0.55rem" }}
                        onClick={() => setViewingResume({ path: app.resume_file_path, name: app.original_filename })}
                      >
                        <FileText size={12} /> View resume
                      </button>
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
      {viewingResume && (
        <ResumeViewerModal
          resumePath={viewingResume.path}
          filename={viewingResume.name}
          onClose={() => setViewingResume(null)}
        />
      )}
    </div>
  );
};
