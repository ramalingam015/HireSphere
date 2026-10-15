import React, { useState } from "react";
import { apiRequest } from "../api/client";
import { 
  FileText, CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Send, X, Sparkles, UploadCloud, Info 
} from "lucide-react";

export const ATSModal = ({ job, onClose, onAppliedSuccess }) => {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAiFailurePrompt, setShowAiFailurePrompt] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    // FR-DAT-01: PDF only
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("FR-DAT-01 Violation: Only PDF resume files are accepted.");
      setFile(null);
      return;
    }

    // FR-DAT-02: Size <= 5 MB
    if (selected.size > 5 * 1024 * 1024) {
      setErrorMsg(`FR-DAT-02 Violation: Resume exceeds 5 MB limit (${(selected.size / (1024 * 1024)).toFixed(2)} MB).`);
      setFile(null);
      return;
    }

    setErrorMsg("");
    setFile(selected);
    setAnalysisResult(null);
    setShowAiFailurePrompt(false);
  };

  const handleScanResume = async () => {
    if (!file) {
      setErrorMsg("Please select a PDF resume to analyze.");
      return;
    }

    setAnalyzing(true);
    setErrorMsg("");
    setShowAiFailurePrompt(false);

    try {
      const formData = new FormData();
      formData.append("job_id", job.id);
      formData.append("file", file);

      // FR-ANA-01 / FR-ANA-02: Call pre-analyze endpoint
      const result = await apiRequest("/api/applications/pre-analyze-resume", {
        method: "POST",
        body: formData,
      });

      setAnalysisResult(result);
    } catch (err) {
      console.error("ATS analysis error:", err);
      // FR-ERR-01: AI failure prompt trigger
      setShowAiFailurePrompt(true);
      setErrorMsg(err.message || "AI Analysis unavailable or extraction failure.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitApplication = async (submitWithoutScore = false) => {
    if (!file) {
      setErrorMsg("Please select a PDF resume file.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("job_id", job.id);
      formData.append("file", file);
      formData.append("submit_without_ai_score", submitWithoutScore);

      const appData = await apiRequest("/api/applications/apply", {
        method: "POST",
        body: formData,
      });

      onAppliedSuccess(appData);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)" }}>
              ATS Resume Match & Apply
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Applying for: <strong style={{ color: "var(--primary)" }}>{job.title}</strong> at {job.company}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem"
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* FR-ERR-01, 02, 03: AI Failure Fallback Prompt */}
        {showAiFailurePrompt && (
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            padding: "1rem",
            borderRadius: "10px",
            marginBottom: "1.25rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, marginBottom: "0.4rem" }}>
              <AlertCircle size={18} />
              <span>FR-ERR-01: AI Resume Analysis Fallback</span>
            </div>
            <p style={{ fontSize: "0.85rem", marginBottom: "0.85rem" }}>
              AI service is currently unreachable or could not extract text. Would you like to submit your application without an automated AI score?
            </p>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => handleSubmitApplication(true)}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Yes, Submit Application"}
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => { setShowAiFailurePrompt(false); setErrorMsg(""); }}
              >
                No, Abort & Try Another Resume
              </button>
            </div>
          </div>
        )}

        {/* PDF File Picker */}
        <div style={{
          border: "2px dashed #cbd5e1",
          borderRadius: "12px",
          padding: "1.5rem",
          textAlign: "center",
          backgroundColor: "#f8fafc",
          marginBottom: "1.25rem"
        }}>
          <UploadCloud size={36} style={{ color: "#64748b", margin: "0 auto 0.5rem auto" }} />
          <p style={{ fontWeight: 600, fontSize: "0.95rem", color: "#334155" }}>
            {file ? file.name : "Select your PDF Resume"}
          </p>
          <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.8rem" }}>
            PDF only, max 5 MB (FR-DAT-01 & FR-DAT-02)
          </p>

          <input 
            type="file" 
            accept=".pdf,application/pdf"
            id="resume-upload-input"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <div style={{ display: "flex", justifyContent: "center", gap: "0.6rem" }}>
            <label 
              htmlFor="resume-upload-input" 
              className="btn btn-secondary btn-sm"
              style={{ cursor: "pointer" }}
            >
              <FileText size={14} />
              <span>{file ? "Choose Different PDF" : "Browse PDF"}</span>
            </label>

            {file && (
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleScanResume}
                disabled={analyzing}
              >
                <Sparkles size={14} />
                <span>{analyzing ? "Analyzing Skills..." : "Calculate ATS Match"}</span>
              </button>
            )}
          </div>
        </div>

        {/* ATS Analysis Breakdown Result */}
        {analysisResult && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div className="ats-score-meter">
              <div className={`score-circle ${
                analysisResult.score >= 70 ? "score-high" : analysisResult.score >= 40 ? "score-med" : "score-low"
              }`}>
                <span>{analysisResult.score}%</span>
                <span style={{ fontSize: "0.65rem", fontWeight: 500 }}>MATCH</span>
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)" }}>
                  ATS Compatibility Score
                </h4>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                  {analysisResult.formula_used}
                </p>
                <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", fontWeight: 600 }}>
                  <span style={{ color: "#065f46" }}>
                    ✓ {analysisResult.matched_skills.length} Matched
                  </span>
                  <span style={{ color: "#991b1b" }}>
                    ✗ {analysisResult.missing_skills.length} Missing
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Skills Breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
              {/* Required Skills */}
              <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.85rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#3730a3", display: "block", marginBottom: "0.5rem" }}>
                  REQUIRED SKILLS (70% Weight)
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {analysisResult.matched_required.map((sk) => (
                    <span key={sk} className="skill-tag skill-matched">
                      <CheckCircle2 size={12} /> {sk}
                    </span>
                  ))}
                  {analysisResult.missing_required.map((sk) => (
                    <span key={sk} className="skill-tag skill-missing">
                      <XCircle size={12} /> {sk}
                    </span>
                  ))}
                </div>
              </div>

              {/* Preferred Skills */}
              {(analysisResult.matched_preferred.length > 0 || analysisResult.missing_preferred.length > 0) && (
                <div style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.85rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#475569", display: "block", marginBottom: "0.5rem" }}>
                    PREFERRED SKILLS (30% Weight)
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {analysisResult.matched_preferred.map((sk) => (
                      <span key={sk} className="skill-tag skill-matched">
                        <CheckCircle2 size={12} /> {sk}
                      </span>
                    ))}
                    {analysisResult.missing_preferred.map((sk) => (
                      <span key={sk} className="skill-tag skill-pref">
                        {sk} (optional)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* FR-ANA-03 Recommendation */}
            {analysisResult.score < 60 && (
              <div style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                color: "#92400e",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1rem"
              }}>
                <Info size={16} />
                <span>
                  <strong>Score is below 60%:</strong> Per FR-ANA-03, you can revise your resume to highlight the missing required skills and re-upload before submitting!
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border)"
        }}>
          <button 
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            {analysisResult && analysisResult.score < 70 && (
              <label 
                htmlFor="resume-upload-input"
                className="btn btn-secondary"
                style={{ cursor: "pointer" }}
                title="Revise and re-analyze PDF before submitting (FR-ANA-03)"
              >
                <RefreshCw size={14} />
                <span>Revise Resume</span>
              </label>
            )}

            <button 
              className="btn btn-primary"
              onClick={() => handleSubmitApplication(false)}
              disabled={submitting || !file}
            >
              <Send size={15} />
              <span>{submitting ? "Submitting Application..." : "Submit Application"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
