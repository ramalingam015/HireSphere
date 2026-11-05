import React, { useState } from "react";
import { apiRequest } from "../api/client";
import { Mail, CheckCircle2, AlertCircle, Sparkles, ExternalLink, Key, Send, ShieldCheck, Zap } from "lucide-react";

export const EmailConfigModal = ({ onClose, initialEmail = "", onConfigSaved }) => {
  // Default to Resend API because it uses HTTPS Port 443 which works 100% on Render
  const [provider, setProvider] = useState("resend");
  const [resendKey, setResendKey] = useState("");
  const [brevoKey, setBrevoKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");
  const [testRecipient, setTestRecipient] = useState(initialEmail || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSaveAndTest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const payload = {
      provider,
      test_recipient: testRecipient.trim()
    };

    if (provider === "resend") {
      if (!resendKey.trim()) {
        setResult({ success: false, detail: "Please enter your Resend API key (starts with re_)." });
        setLoading(false);
        return;
      }
      payload.resend_api_key = resendKey.trim();
      payload.from_email = "onboarding@resend.dev";
    } else if (provider === "gmail") {
      if (!gmailUser.trim() || !gmailPassword.trim()) {
        setResult({ success: false, detail: "Please enter both your Gmail address and 16-character App Password." });
        setLoading(false);
        return;
      }
      payload.smtp_host = "smtp.gmail.com";
      payload.smtp_port = 465;
      payload.smtp_user = gmailUser.trim();
      payload.smtp_password = gmailPassword.trim().replace(/\s+/g, "");
      payload.from_email = gmailUser.trim();
    } else if (provider === "brevo") {
      if (!brevoKey.trim()) {
        setResult({ success: false, detail: "Please enter your Brevo API key (starts with xkeysib-)." });
        setLoading(false);
        return;
      }
      if (!senderEmail.trim() || !senderEmail.includes("@")) {
        setResult({ success: false, detail: "Please enter your registered Brevo account email address." });
        setLoading(false);
        return;
      }
      payload.brevo_api_key = brevoKey.trim();
      payload.from_email = senderEmail.trim();
      payload.smtp_user = senderEmail.trim();
    }

    try {
      const data = await apiRequest("/api/auth/configure-email", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult(data);
      if (data.success && onConfigSaved) {
        onConfigSaved(data.status, testRecipient.trim());
      }
    } catch (err) {
      setResult({
        success: false,
        detail: err.message || "Failed to configure email service"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: "540px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ padding: "0.4rem", background: "#eff6ff", borderRadius: "8px", color: "var(--primary)" }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Real Email Delivery Setup</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.15rem 0 0" }}>
                Send real 6-digit OTP verification codes directly to inboxes
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: "1.2rem", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        {/* Quick Bypass Banner */}
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "0.6rem 0.8rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          fontSize: "0.78rem"
        }}>
          <div>
            <strong style={{ color: "#166534" }}>⚡ No email setup needed for testing:</strong>
            <p style={{ margin: "0.1rem 0 0", color: "#15803d" }}>
              The registration/login screen shows your 6-digit code with a 1-click verify button.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem", whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={onClose}
          >
            Close & Use 1-Click
          </button>
        </div>

        {/* Provider Tabs */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
          <button
            type="button"
            className={`btn btn-sm ${provider === "resend" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("resend")}
            style={{ flex: 1, fontSize: "0.78rem" }}
          >
            🚀 Resend API (Recommended)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "brevo" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("brevo")}
            style={{ flex: 1, fontSize: "0.78rem" }}
          >
            Brevo API
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "gmail" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("gmail")}
            style={{ flex: 1, fontSize: "0.78rem" }}
          >
            Gmail SMTP (Blocked on Render)
          </button>
        </div>

        {provider === "resend" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#166534" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Zap size={15} /> Works 100% on Render (HTTPS Port 443 - Never Blocked)
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              Render cloud allows outbound web traffic on Port 443. Resend delivers in ~0.3s without compliance delays.
            </p>
            <div style={{ marginTop: "0.4rem", lineHeight: 1.5 }}>
              1. Sign up free at{" "}
              <a 
                href="https://resend.com" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: "#15803d", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                resend.com <ExternalLink size={12} />
              </a> (takes 30 seconds with Google/GitHub).<br />
              2. Click <strong>API Keys</strong> ➔ <strong>Create API Key</strong>.<br />
              3. Copy the key (starts with <code>re_...</code>) and paste it below.
            </div>
          </div>
        )}

        {provider === "gmail" && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#9f1239" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              <AlertCircle size={16} /> Render Cloud Firewall Notice
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              <strong>Render permanently blocks outbound SMTP ports 25, 465, and 587</strong> with <code>[Errno 101] Network is unreachable</code>. This applies to both Python and Nodemailer.
            </p>
            <p style={{ margin: "0.3rem 0 0", color: "#881337" }}>
              👉 To send real emails from Render, please switch to the <strong>Resend API</strong> tab above (uses HTTPS Port 443).
            </p>
          </div>
        )}

        {provider === "brevo" && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#92400e" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              ⚠️ Brevo Account Validation Notice
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              Brevo uses HTTPS Port 443, but new Brevo accounts frequently pause transactional sending until account profile validation is complete. If Brevo gives an error, use <strong>Resend API</strong> above for instant delivery.
            </p>
          </div>
        )}

        <form onSubmit={handleSaveAndTest}>
          {provider === "resend" && (
            <div className="form-group">
              <label className="form-label">Resend API Key (starts with <code>re_</code>) *</label>
              <input
                type="password"
                className="form-input"
                required
                placeholder="re_123456789_abcdefghijklmnopqrstuvwxyz"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
              />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
                Created in 30 seconds at resend.com ➔ API Keys
              </span>
            </div>
          )}

          {provider === "gmail" && (
            <>
              <div className="form-group">
                <label className="form-label">Gmail Address *</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="your_email@gmail.com"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">16-Character Google App Password *</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  placeholder="abcd efgh ijkl mnop"
                  value={gmailPassword}
                  onChange={(e) => setGmailPassword(e.target.value)}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
                  Note: Blocked on Render cloud with Errno 101. Only works on localhost.
                </span>
              </div>
            </>
          )}

          {provider === "brevo" && (
            <>
              <div className="form-group">
                <label className="form-label">Brevo API Key (starts with <code>xkeysib-</code>) *</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={brevoKey}
                  onChange={(e) => setBrevoKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Registered Brevo Sender Email *</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="The exact email you signed up with on Brevo"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-group" style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Send Real Test OTP Email To *</label>
            <input
              type="email"
              className="form-input"
              required
              placeholder="your_inbox@gmail.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
              A real 6-digit verification code will be dispatched immediately to this address to verify your connection.
            </span>
          </div>

          {result && (
            <div style={{
              background: result.success ? "#dcfce7" : "#fee2e2",
              border: `1px solid ${result.success ? "#bbf7d0" : "#fecaca"}`,
              color: result.success ? "#166534" : "#991b1b",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.82rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.4rem"
            }}>
              {result.success ? <CheckCircle2 size={16} style={{ marginTop: "2px", flexShrink: 0 }} /> : <AlertCircle size={16} style={{ marginTop: "2px", flexShrink: 0 }} />}
              <div>
                <strong>{result.success ? "Success!" : "Email Dispatch Result:"}</strong>
                <p style={{ margin: "0.2rem 0 0" }}>{result.message || result.detail}</p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              {result?.success ? "Close" : "Cancel"}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Send size={14} />
              {loading ? "Sending Test Email..." : "Test & Save Email Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
