import React, { useState } from "react";
import { apiRequest } from "../api/client";
import { Mail, CheckCircle2, AlertCircle, Sparkles, ExternalLink, Key, Send, ShieldCheck } from "lucide-react";

export const EmailConfigModal = ({ onClose, initialEmail = "", onConfigSaved }) => {
  const [provider, setProvider] = useState("gmail"); // default to gmail as recommended by user (nodemailer equivalent)
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [brevoKey, setBrevoKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
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

    if (provider === "gmail") {
      if (!gmailUser.trim() || !gmailPassword.trim()) {
        setResult({ success: false, detail: "Please enter both your Gmail address and 16-character App Password." });
        setLoading(false);
        return;
      }
      payload.smtp_host = "smtp.gmail.com";
      payload.smtp_port = 465; // Direct SSL - bypasses STARTTLS port blocks
      payload.smtp_user = gmailUser.trim();
      payload.smtp_password = gmailPassword.trim().replace(/\s+/g, "");
      payload.from_email = gmailUser.trim();
    } else if (provider === "resend") {
      if (!resendKey.trim()) {
        setResult({ success: false, detail: "Please enter your Resend API key (starts with re_)." });
        setLoading(false);
        return;
      }
      payload.resend_api_key = resendKey.trim();
      payload.from_email = "onboarding@resend.dev";
    } else if (provider === "brevo") {
      if (!brevoKey.trim()) {
        setResult({ success: false, detail: "Please enter your Brevo API key (starts with xkeysib-)." });
        setLoading(false);
        return;
      }
      if (!senderEmail.trim() || !senderEmail.includes("@")) {
        setResult({ success: false, detail: "Please enter your verified Brevo sender email address (the email you used to register on Brevo)." });
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
      <div className="modal-content" style={{ maxWidth: "530px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ padding: "0.4rem", background: "#eff6ff", borderRadius: "8px", color: "var(--primary)" }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Configure Real Email Delivery</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.15rem 0 0" }}>
                Send 6-digit OTP verification codes directly to real inboxes
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: "1.2rem", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        {/* Provider Tabs */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
          <button
            type="button"
            className={`btn btn-sm ${provider === "gmail" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("gmail")}
            style={{ flex: 1, fontSize: "0.8rem" }}
          >
            ⭐ Gmail (Nodemailer method)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "resend" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("resend")}
            style={{ flex: 1, fontSize: "0.8rem" }}
          >
            🚀 Resend API
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "brevo" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("brevo")}
            style={{ flex: 1, fontSize: "0.8rem" }}
          >
            Brevo API
          </button>
        </div>

        {provider === "gmail" && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#1e40af" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              <ShieldCheck size={16} /> 100% Reliable Gmail Method (Direct SSL Port 465)
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              This uses direct SSL on port 465 (the exact method Nodemailer uses). It connects in ~0.5s and is completely immune to cloud network blocks.
            </p>
            <div style={{ marginTop: "0.4rem" }}>
              1. Turn ON <strong>2-Step Verification</strong> in your Google Account.<br />
              2. Go to{" "}
              <a 
                href="https://myaccount.google.com/apppasswords" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: "#1d4ed8", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                Google App Passwords <ExternalLink size={12} />
              </a>
              {" "}➔ Name it <code>HireSphere</code> ➔ Copy the 16-character code.
            </div>
          </div>
        )}

        {provider === "resend" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#166534" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              🚀 Resend API: 3,000 Free Emails / Month (Fastest setup)
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              Unlike Brevo, Resend activates instantly without holding your account for compliance validation.
            </p>
            <div style={{ marginTop: "0.3rem" }}>
              <a 
                href="https://resend.com" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: "#15803d", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                Sign up free at resend.com <ExternalLink size={12} />
              </a>
              {" "}➔ Click <strong>API Keys</strong> ➔ Create an API key (`re_...`).
            </div>
          </div>
        )}

        {provider === "brevo" && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#92400e" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              ⚠️ Why Brevo Fails on New Accounts:
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              Brevo requires completing your account profile before they activate transactional emails. If Brevo gives an error, use <strong>Gmail</strong> or <strong>Resend</strong> above for instant delivery.
            </p>
          </div>
        )}

        <form onSubmit={handleSaveAndTest}>
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
                  This is the 16-letter App Password from myaccount.google.com/apppasswords (not your normal password).
                </span>
              </div>
            </>
          )}

          {provider === "resend" && (
            <div className="form-group">
              <label className="form-label">Resend API Key (starts with <code>re_</code>) *</label>
              <input
                type="password"
                className="form-input"
                required
                placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
              />
            </div>
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
                <strong>{result.success ? "Success!" : "Email Dispatch Failed:"}</strong>
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
