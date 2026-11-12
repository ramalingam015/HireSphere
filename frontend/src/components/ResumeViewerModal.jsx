import React, { useEffect, useState } from "react";
import { X, Download, ExternalLink, FileText } from "lucide-react";
import { fetchResumeBlob } from "../api/client";

/**
 * Shows an uploaded resume PDF inside the app. The file is fetched with the user's JWT
 * (the backend only serves it to the owner, the job's recruiter or an admin) and displayed
 * from a blob URL, so there is no pop-up that a browser could block.
 */
export const ResumeViewerModal = ({ resumePath, filename, onClose }) => {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    fetchResumeBlob(resumePath)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => !cancelled && setError(err.message || "Could not load the resume."));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resumePath]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Resume viewer">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "900px", width: "95vw", height: "90vh", padding: "1rem", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "1rem", margin: 0 }}>
            <FileText size={16} /> {filename || "Resume"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {url && (
              <>
                <a className="btn btn-secondary btn-sm" href={url} download={filename || "resume.pdf"}
                   style={{ display: "flex", alignItems: "center", gap: "0.3rem", textDecoration: "none" }}>
                  <Download size={13} /> Download
                </a>
                <a className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noopener noreferrer"
                   style={{ display: "flex", alignItems: "center", gap: "0.3rem", textDecoration: "none" }}>
                  <ExternalLink size={13} /> New tab
                </a>
              </>
            )}
            <button type="button" onClick={onClose} aria-label="Close" style={{ color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {error ? (
            <p style={{ color: "#b91c1c", padding: "1rem" }}>{error}</p>
          ) : !url ? (
            <p style={{ color: "var(--text-muted)", padding: "1rem" }}>Loading resume…</p>
          ) : (
            <iframe title="Resume PDF" src={url} style={{ width: "100%", height: "100%", border: "1px solid var(--border)", borderRadius: "8px" }} />
          )}
        </div>
      </div>
    </div>
  );
};
