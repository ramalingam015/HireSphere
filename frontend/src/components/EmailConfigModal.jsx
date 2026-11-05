import React, { useState } from "react";
import { apiRequest } from "../api/client";
import { Mail, CheckCircle2, AlertCircle, Sparkles, ExternalLink, Key, Send } from "lucide-react";

export const EmailConfigModal = ({ onClose, initialEmail = "", onConfigSaved }) => {
  const [provider, setProvider] = useState("brevo");
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

    if (provider === "brevo") {
      if (!brevoKey.trim()) {
        setResult({ success: false, detail: "Please enter your Brevo API key (starts with xkeysib-)" });
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
    } else {
      if (!gmailUser.trim() || !gmailPassword.trim()) {
        setResult({ success: false, detail: "Please enter both your Gmail address and 16-character App Password." });
        setLoading(false);
        return;
      }
      payload.smtp_host = "smtp.gmail.com";
      payload.smtp_port = 587;
      payload.smtp_user = gmailUser.trim();
      payload.smtp_password = gmailPassword.trim().replace(/\s+/g, "");
      payload.from_email = gmailUser.trim();
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
      <div className="modal-content" style={{ maxWidth: "520px" }}>
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
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
          <button
            type="button"
            className={`btn btn-sm ${provider === "brevo" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("brevo")}
            style={{ flex: 1, fontSize: "0.82rem" }}
          >
            ⭐ Brevo API (Recommended)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "gmail" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("gmail")}
            style={{ flex: 1, fontSize: "0.82rem" }}
          >
            Gmail SMTP
          </button>
        </div>

        {provider === "brevo" ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#166534" }}>
            <strong>Why Brevo?</strong> Free 300 emails/day, no credit card, and works over HTTPS port 443 so Render never blocks it.
            <div style={{ marginTop: "0.3rem" }}>
              <a 
                href="https://www.brevo.com" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: "#15803d", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                Sign up free at brevo.com <ExternalLink size={12} />
              </a>
              {" "}➔ Go to <strong>SMTP & API</strong> ➔ <strong>API Keys</strong> ➔ Generate a key.
            </div>
          </div>
        ) : (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#1e40af" }}>
            <strong>Gmail Requirements:</strong> Google requires an <strong>App Password</strong> (not your regular Gmail password).
            <div style={{ marginTop: "0.3rem" }}>
              Enable 2-Step Verification ➔ Generate a 16-character code at{" "}
              <a 
                href="https://myaccount.google.com/apppasswords" 
                target="_blank" 
                rel="noreferrer"
                style={{ color: "#1d4ed8", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                Google App Passwords <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveAndTest}>
          {provider === "brevo" ? (
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
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
                  Brevo requires emails to be sent from your verified account email address.
                </span>
              </div>
            </>
          ) : (
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
