import React, { useState, useEffect } from "react";
import { apiRequest, API_BASE } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { 
  Plus, Briefcase, Users, Calendar, Clock, MessageSquare, 
  CheckCircle, XCircle, AlertTriangle, ExternalLink, ChevronRight 
} from "lucide-react";

export const RecruiterDashboard = ({ onOpenChatWith }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("applications");
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [applications, setApplications] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Job Form State
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newJobCompany, setNewJobCompany] = useState(user?.company || "TechCorp");
  const [newJobLocation, setNewJobLocation] = useState("Remote");
  const [newJobType, setNewJobType] = useState("Full-time");
  const [newJobSalary, setNewJobSalary] = useState("$80,000 - $110,000");
  const [newJobDesc, setNewJobDesc] = useState("");
  const [skillsList, setSkillsList] = useState([
    { skill_name: "Python", is_required: true },
    { skill_name: "FastAPI", is_required: true },
    { skill_name: "Docker", is_required: false }
  ]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillRequired, setNewSkillRequired] = useState(true);
  const [formError, setFormError] = useState("");

  // New Interview Slot Form State
  const [showCreateSlotModal, setShowCreateSlotModal] = useState(false);
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [slotDeadline, setSlotDeadline] = useState("");
  const [slotMeetingLink, setSlotMeetingLink] = useState("https://meet.google.com/interview");
  const [slotNotes, setSlotNotes] = useState("");

  const fetchMyJobs = async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/jobs/my-postings");
      setJobs(data);
      if (data.length > 0 && !selectedJobId) {
        setSelectedJobId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching recruiter jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicationsForJob = async (jobId) => {
    if (!jobId) return;
    try {
      const data = await apiRequest(`/api/applications/job/${jobId}`);
      setApplications(data);
    } catch (err) {
      console.error("Error fetching job applications:", err);
    }
  };

  const fetchSlotsForJob = async (jobId) => {
    if (!jobId) return;
    try {
      const data = await apiRequest(`/api/interviews/slots/job/${jobId}`);
      setSlots(data);
    } catch (err) {
      console.error("Error fetching interview slots:", err);
    }
  };

  useEffect(() => {
    fetchMyJobs();
  }, []);

  useEffect(() => {
    if (selectedJobId) {
      fetchApplicationsForJob(selectedJobId);
      fetchSlotsForJob(selectedJobId);
    }
  }, [selectedJobId]);

  const handleAddSkill = () => {
    if (!newSkillName.trim()) return;
    setSkillsList([...skillsList, { skill_name: newSkillName.trim(), is_required: newSkillRequired }]);
    setNewSkillName("");
  };

  const handleRemoveSkill = (index) => {
    setSkillsList(skillsList.filter((_, idx) => idx !== index));
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    setFormError("");

    // FR-REC-01: at least 1 required skill
    if (!skillsList.some(s => s.is_required)) {
      setFormError("FR-REC-01 Violation: Every job must contain at least one required skill.");
      return;
    }

    try {
      await apiRequest("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          title: newJobTitle,
          company: newJobCompany,
          location: newJobLocation,
          job_type: newJobType,
          salary_range: newJobSalary,
          description: newJobDesc,
          skills: skillsList
        })
      });

      setShowCreateJobModal(false);
      setNewJobTitle("");
      setNewJobDesc("");
      fetchMyJobs();
    } catch (err) {
      setFormError(err.message || "Failed to create job posting");
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!selectedJobId) return;

    try {
      await apiRequest("/api/interviews/slots", {
        method: "POST",
        body: JSON.stringify({
          job_id: selectedJobId,
          start_time: new Date(slotStartTime).toISOString(),
          end_time: new Date(slotEndTime).toISOString(),
          selection_deadline: new Date(slotDeadline).toISOString(),
          meeting_link: slotMeetingLink,
          notes: slotNotes
        })
      });

      setShowCreateSlotModal(false);
      fetchSlotsForJob(selectedJobId);
    } catch (err) {
      alert("Failed to create slot: " + err.message);
    }
  };

  const handleTransitionState = async (appId, nextStatus) => {
    try {
      await apiRequest(`/api/applications/${appId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          to_status: nextStatus,
          reason: `Recruiter moved to ${nextStatus}`
        })
      });
      fetchApplicationsForJob(selectedJobId);
    } catch (err) {
      alert(err.message || "Invalid state transition");
    }
  };

  const isPending = user?.recruiter_status === "pending";
  const isSuspended = user?.recruiter_status === "suspended";

  return (
    <div>
      {/* Recruiter Account Status Alerts (FR-ADM-01 / 02) */}
      {isPending && (
        <div className="hold-banner" style={{ background: "#fef3c7", borderColor: "#fde68a", color: "#92400e" }}>
          <AlertTriangle size={20} />
          <div>
            <strong>FR-ADM-01 Recruiter Account Pending Approval:</strong> Your recruiter registration has been submitted and is awaiting administrator verification. Job postings will become live once approved.
          </div>
        </div>
      )}

      {isSuspended && (
        <div className="hold-banner" style={{ background: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" }}>
          <AlertTriangle size={20} />
          <div>
            <strong>FR-ADM-02 Recruiter Account Suspended:</strong> This recruiter account has been placed on an administrative hold. Job postings are paused and existing applications have a Hold overlay.
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Recruitment Management Center</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Post openings, sort candidates by ATS score, create interview slots, and coordinate outside interviews.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateJobModal(true)}
          disabled={isPending || isSuspended}
          title={isPending ? "Awaiting admin approval" : isSuspended ? "Account suspended" : "Post a new opening"}
        >
          <Plus size={16} /> Create Job Opening
        </button>
      </div>

      {/* Main Layout: Left job selector, Right job details & candidates */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem" }}>
        {/* Left Column: My Postings List */}
        <div className="card" style={{ padding: "1rem" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
            My Active Jobs ({jobs.length})
          </h3>

          {loading ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading jobs...</p>
          ) : jobs.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No jobs posted yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {jobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => setSelectedJobId(j.id)}
                  style={{
                    textAlign: "left",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: j.id === selectedJobId ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: j.id === selectedJobId ? "#eef2ff" : "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>
                    {j.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                    {j.job_type} • {j.location}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Applications & Slots for Selected Job */}
        <div>
          {selectedJobId ? (
            <div>
              {/* Subtabs: Candidates / Interview Slots */}
              <div className="tabs-nav" style={{ marginBottom: "1rem" }}>
                <button 
                  className={`tab-btn ${activeTab === "applications" ? "active" : ""}`}
                  onClick={() => setActiveTab("applications")}
                >
                  <Users size={16} /> Candidates & ATS Scores ({applications.length})
                </button>
                <button 
                  className={`tab-btn ${activeTab === "slots" ? "active" : ""}`}
                  onClick={() => setActiveTab("slots")}
                >
                  <Calendar size={16} /> Interview Slots ({slots.length})
                </button>
              </div>

              {/* Applications View */}
              {activeTab === "applications" && (
                <div>
                  {applications.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
                      <Users size={32} style={{ color: "var(--text-muted)", margin: "0 auto 0.5rem" }} />
                      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        No candidates have applied to this job yet.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {applications.map((app) => (
                        <div key={app.id} className="card">
                          <div className="card-header">
                            <div>
                              <h4 style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                                {app.candidate?.full_name}
                              </h4>
                              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {app.candidate?.email} • Applied: {new Date(app.created_at).toLocaleDateString()}
                              </p>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span className="status-pill status-applied">
                                {app.status}
                              </span>

                              {app.ats_score !== null && (
                                <span className={`status-pill ${
                                  app.ats_score >= 70 ? "status-selected" : app.ats_score >= 40 ? "status-in-review" : "status-rejected"
                                }`}>
                                  ATS Score: {app.ats_score}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Candidate Skills Match details */}
                          <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", marginBottom: "0.85rem", fontSize: "0.8rem" }}>
                            <div style={{ marginBottom: "0.3rem" }}>
                              <strong style={{ color: "#065f46" }}>Matched Skills: </strong>
                              {JSON.parse(app.matched_skills_json || "[]").join(", ") || "None"}
                            </div>
                            <div>
                              <strong style={{ color: "#991b1b" }}>Missing Skills: </strong>
                              {JSON.parse(app.missing_skills_json || "[]").join(", ") || "None"}
                            </div>
                          </div>

                          {/* Actions: Direct Chat, PDF Download, State Transitions (FR-STAT-01) */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => onOpenChatWith(app.candidate)}
                                title="Direct chat with applicant"
                              >
                                <MessageSquare size={13} /> Chat with Student
                              </button>

                              <a 
                                href={`${API_BASE}/uploads/resumes/${app.resume_file_path.split(/[\\\/]/).pop()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ textDecoration: "none" }}
                              >
                                Download Resume PDF
                              </a>
                            </div>

                            {/* State Transition Guards (FR-STAT-01) */}
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              {app.status === "Applied" && (
                                <button 
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleTransitionState(app.id, "In Review")}
                                >
                                  Move to In Review
                                </button>
                              )}

                              {app.status === "In Review" && (
                                <>
                                  <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleTransitionState(app.id, "Interview")}
                                    title="Invite candidate to book interview slots"
                                  >
                                    Invite to Interview
                                  </button>
                                  <button 
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleTransitionState(app.id, "Rejected")}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}

                              {app.status === "Interview" && (
                                <>
                                  <button 
                                    className="btn btn-success btn-sm"
                                    onClick={() => handleTransitionState(app.id, "Selected")}
                                  >
                                    Select / Offer
                                  </button>
                                  <button 
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleTransitionState(app.id, "Rejected")}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Interview Slots View (FR-REC-04) */}
              {activeTab === "slots" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Candidates in "Interview" stage can select from these slots.
                    </p>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowCreateSlotModal(true)}
                    >
                      <Plus size={14} /> Add Interview Slot
                    </button>
                  </div>

                  {slots.length === 0 ? (
                    <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
                      <Calendar size={32} style={{ color: "var(--text-muted)", margin: "0 auto 0.5rem" }} />
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        No interview slots created yet for this job opening.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {slots.map((s) => (
                        <div key={s.id} className="card" style={{ padding: "1rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                                📅 {new Date(s.start_time).toLocaleString()} – {new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                                Selection Deadline: {new Date(s.selection_deadline).toLocaleString()}
                              </div>
                              {s.notes && (
                                <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: "0.3rem" }}>
                                  Note: {s.notes}
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              {s.is_booked ? (
                                <span className="status-pill status-selected">
                                  <CheckCircle size={12} /> Booked
                                </span>
                              ) : (
                                <span className="status-pill status-in-review">
                                  Available
                                </span>
                              )}

                              {s.meeting_link && (
                                <a 
                                  href={s.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  style={{ textDecoration: "none" }}
                                >
                                  Meeting Link <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
              <p style={{ color: "var(--text-muted)" }}>Select a job from the left or create a new job opening.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Job Opening */}
      {showCreateJobModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Post a New Job Opening</h3>
              <button onClick={() => setShowCreateJobModal(false)}>✕</button>
            </div>

            {formError && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateJob}>
              <div className="form-group">
                <label className="form-label">Job Title *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="e.g. Senior Backend Engineer"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={newJobCompany}
                    onChange={(e) => setNewJobCompany(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newJobLocation}
                    onChange={(e) => setNewJobLocation(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div className="form-group">
                  <label className="form-label">Job Type</label>
                  <select 
                    className="form-select" 
                    value={newJobType}
                    onChange={(e) => setNewJobType(e.target.value)}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Internship">Internship</option>
                    <option value="Contract">Contract</option>
                    <option value="Remote">Remote</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Salary Range</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newJobSalary}
                    onChange={(e) => setNewJobSalary(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  required 
                  placeholder="Role responsibilities and technical context..."
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                />
              </div>

              {/* Skills Configuration (FR-REC-01 & FR-REC-02) */}
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Target Skills (FR-REC-01: at least 1 required)</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>★ = Required</span>
                </label>

                {/* Skill List Pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
                  {skillsList.map((s, idx) => (
                    <span 
                      key={idx} 
                      className={`skill-tag ${s.is_required ? "skill-req" : "skill-pref"}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleRemoveSkill(idx)}
                      title="Click to remove"
                    >
                      {s.skill_name} {s.is_required ? "★" : "(pref)"} ✕
                    </span>
                  ))}
                </div>

                {/* Add Skill Controls */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input 
                    type="text" 
                    placeholder="Skill name (e.g. Python, SQL)" 
                    className="form-input"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                  />
                  <select 
                    className="form-select"
                    style={{ width: "160px" }}
                    value={newSkillRequired ? "true" : "false"}
                    onChange={(e) => setNewSkillRequired(e.target.value === "true")}
                  >
                    <option value="true">Required (70%)</option>
                    <option value="false">Preferred (30%)</option>
                  </select>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddSkill}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateJobModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Interview Slot (FR-REC-04) */}
      {showCreateSlotModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Add Interview Slot</h3>
              <button onClick={() => setShowCreateSlotModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSlot}>
              <div className="form-group">
                <label className="form-label">Interview Start Time *</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  required
                  value={slotStartTime}
                  onChange={(e) => setSlotStartTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Interview End Time *</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  required
                  value={slotEndTime}
                  onChange={(e) => setSlotEndTime(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Candidate Selection Deadline *</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  required
                  value={slotDeadline}
                  onChange={(e) => setSlotDeadline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">External Video Meeting Link</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://meet.google.com/xyz-123"
                  value={slotMeetingLink}
                  onChange={(e) => setSlotMeetingLink(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes for Candidate</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Technical system design screen (45 min)"
                  value={slotNotes}
                  onChange={(e) => setSlotNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateSlotModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
