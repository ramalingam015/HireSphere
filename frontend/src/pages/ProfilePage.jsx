import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/client";
import { ResumeViewerModal } from "../components/ResumeViewerModal";
import { 
  User, CheckCircle2, FileText, UploadCloud, Trash2, 
  ExternalLink, Sparkles, AlertCircle, RefreshCw 
} from "lucide-react";

export const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [viewingResume, setViewingResume] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [headline, setHeadline] = useState(user?.headline || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [company, setCompany] = useState(user?.company || "");
  const [location, setLocation] = useState(user?.location || "");
  const [skills, setSkills] = useState(user?.skills || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Resume state
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeMsg, setResumeMsg] = useState("");
  const [resumeError, setResumeError] = useState("");

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      await apiRequest("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: fullName,
          headline,
          bio,
          company,
          location,
          skills
        })
      });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Failed to save profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResumeFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setResumeError("Resume must be in PDF format only (.pdf).");
      setResumeFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setResumeError(`Resume exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      setResumeFile(null);
      return;
    }

    setResumeError("");
    setResumeFile(file);
  };

  const handleUploadResume = async () => {
    if (!resumeFile) return;

    setUploadingResume(true);
    setResumeError("");
    setResumeMsg("");

    try {
      const formData = new FormData();
      formData.append("file", resumeFile);

      const updatedUser = await apiRequest("/api/auth/profile/resume", {
        method: "POST",
        body: formData
      });

      await refreshUser();
      if (updatedUser?.skills) {
        setSkills(updatedUser.skills);
      }
      setResumeFile(null);
      setResumeMsg("Resume uploaded successfully! Technical skills extracted and saved to your profile.");
      setTimeout(() => setResumeMsg(""), 5000);
    } catch (err) {
      setResumeError(err.message || "Failed to upload resume.");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDeleteResume = async () => {
    if (!window.confirm("Are you sure you want to remove your uploaded resume?")) {
      return;
    }

    try {
      await apiRequest("/api/auth/profile/resume", {
        method: "DELETE"
      });
      await refreshUser();
      setResumeMsg("Resume removed from profile.");
      setTimeout(() => setResumeMsg(""), 4000);
    } catch (err) {
      alert("Failed to delete resume: " + err.message);
    }
  };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Profile Header */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            width: "60px", height: "60px", borderRadius: "50%",
            background: "var(--primary-light)", color: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: "1.5rem"
          }}>
            {user?.full_name?.[0] || "U"}
          </div>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>{user?.full_name}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {user?.email} • Role: <strong style={{ textTransform: "capitalize" }}>{user?.role}</strong>
            </p>
          </div>
        </div>

        {saved && (
          <div style={{ background: "#d1fae5", color: "#065f46", padding: "0.75rem", borderRadius: "8px", marginTop: "1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CheckCircle2 size={16} /> Profile changes updated successfully!
          </div>
        )}

        <form onSubmit={handleSave} style={{ marginTop: "1.25rem" }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Professional Headline</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. CS Senior | Full Stack Developer"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="form-group">
              <label className="form-label">Company / University</label>
              <input 
                type="text" 
                className="form-input" 
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. San Francisco, CA / Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Key Skills (Comma Separated)</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "normal" }}>Used for AI matching & ATS</span>
            </label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Python, React, FastAPI, PostgreSQL, Docker, Git"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Professional Bio</label>
            <textarea 
              className="form-textarea" 
              rows={3} 
              placeholder="Brief summary of your background, career interests, and goals..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save Profile Details"}
            </button>
          </div>
        </form>
      </div>

      {/* Resume Management Section for AI Recommendations */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FileText size={20} color="var(--primary)" />
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Profile Resume & AI Matching</h3>
          </div>
          <span style={{ 
            fontSize: "0.75rem", 
            background: "var(--primary-light)", 
            color: "var(--primary)", 
            padding: "0.2rem 0.6rem", 
            borderRadius: "12px", 
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.25rem"
          }}>
            <Sparkles size={12} /> AI Powered
          </span>
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.25rem", lineHeight: 1.4 }}>
          Upload your latest PDF resume. Our AI engine scans it to recommend tailored jobs, compute match scores, and enable 1-click ATS pre-screening.
        </p>

        {resumeMsg && (
          <div style={{ background: "#d1fae5", color: "#065f46", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <CheckCircle2 size={16} /> {resumeMsg}
          </div>
        )}

        {resumeError && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <AlertCircle size={16} /> {resumeError}
          </div>
        )}

        {/* Existing Resume Display */}
        {user?.resume_filename ? (
          <div style={{ 
            background: "#f8fafc", 
            border: "1px solid #cbd5e1", 
            borderRadius: "10px", 
            padding: "1rem", 
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ 
                width: "40px", height: "40px", borderRadius: "8px", 
                background: "#e0f2fe", color: "#0284c7", 
                display: "flex", alignItems: "center", justifyContent: "center" 
              }}>
                <FileText size={22} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-main)" }}>
                  {user.resume_filename}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <CheckCircle2 size={12} /> Active for AI Job Recommendations
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {user.resume_file_path && (
                <button
                  type="button"
                  onClick={() => setViewingResume(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <ExternalLink size={13} /> View PDF
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-danger btn-sm"
                onClick={handleDeleteResume}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
          </div>
        ) : null}

        {/* File Upload Form */}
        <div style={{ 
          border: "2px dashed var(--border)", 
          borderRadius: "10px", 
          padding: "1.5rem", 
          textAlign: "center",
          background: "#fafafa"
        }}>
          <UploadCloud size={32} color="var(--primary)" style={{ margin: "0 auto 0.5rem" }} />
          <p style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
            {user?.resume_filename ? "Upload a New Resume to Replace" : "Select your PDF Resume"}
          </p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            PDF format only, maximum file size 5 MB (FR-DAT-01 / FR-DAT-02)
          </p>

          <input 
            type="file" 
            id="profile-resume-input" 
            accept=".pdf,application/pdf"
            onChange={handleResumeFileSelect}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <label 
              htmlFor="profile-resume-input" 
              className="btn btn-secondary btn-sm"
              style={{ cursor: "pointer" }}
            >
              Choose PDF File
            </label>

            {resumeFile && (
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>
                {resumeFile.name} ({(resumeFile.size / 1024).toFixed(1)} KB)
              </span>
            )}

            {resumeFile && (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={handleUploadResume}
                disabled={uploadingResume}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                {uploadingResume ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Scanning & Uploading...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Upload & Extract Skills
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {viewingResume && user?.resume_file_path && (
        <ResumeViewerModal
          resumePath={user.resume_file_path}
          filename={user.resume_filename}
          onClose={() => setViewingResume(false)}
        />
      )}
    </div>
  );
};
