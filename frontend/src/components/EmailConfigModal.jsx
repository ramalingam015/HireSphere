import React, { useState } from "react";
import { apiRequest } from "../api/client";
import { Mail, CheckCircle2, AlertCircle, ExternalLink, Send, Zap, Globe, Shield } from "lucide-react";

export const EmailConfigModal = ({ onClose, initialEmail = "", onConfigSaved }) => {
  // Default to Brevo because it allows sending to ANY recipient email without requiring a custom domain
  const [provider, setProvider] = useState("brevo");
  const [brevoKey, setBrevoKey] = useState("");
  const [sendgridKey, setSendgridKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("hirepro455@gmail.com");
  const [customDomainSender, setCustomDomainSender] = useState("noreply@hiresphere.app");
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
        setResult({ success: false, detail: "Please enter your Brevo API key (starts with xkeysib-)." });
        setLoading(false);
        return;
      }
      if (!senderEmail.trim() || !senderEmail.includes("@")) {
        setResult({ success: false, detail: "Please enter your registered Brevo account email address (e.g. hirepro455@gmail.com)." });
        setLoading(false);
        return;
      }
      payload.brevo_api_key = brevoKey.trim();
      payload.from_email = senderEmail.trim();
      payload.smtp_user = senderEmail.trim();
    } else if (provider === "sendgrid") {
      if (!sendgridKey.trim()) {
        setResult({ success: false, detail: "Please enter your SendGrid API key (starts with SG.)." });
        setLoading(false);
        return;
      }
      if (!senderEmail.trim() || !senderEmail.includes("@")) {
        setResult({ success: false, detail: "Please enter your verified SendGrid single sender email." });
        setLoading(false);
        return;
      }
      payload.sendgrid_api_key = sendgridKey.trim();
      payload.from_email = senderEmail.trim();
      payload.smtp_user = senderEmail.trim();
    } else if (provider === "resend") {
      if (!resendKey.trim()) {
        setResult({ success: false, detail: "Please enter your Resend API key (starts with re_)." });
        setLoading(false);
        return;
      }
      payload.resend_api_key = resendKey.trim();
      payload.from_email = customDomainSender.trim() || "onboarding@resend.dev";
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
      <div className="modal-content" style={{ maxWidth: "560px" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ padding: "0.4rem", background: "#eff6ff", borderRadius: "8px", color: "var(--primary)" }}>
              <Mail size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Production Email Dispatch Setup</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0.15rem 0 0" }}>
                Send real 6-digit OTP verification codes to ANY recipient email worldwide
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: "1.2rem", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        {/* Provider Tabs */}
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn btn-sm ${provider === "brevo" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("brevo")}
            style={{ flex: 1, fontSize: "0.76rem" }}
          >
            ⭐ Brevo API (No Domain Needed)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "sendgrid" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("sendgrid")}
            style={{ flex: 1, fontSize: "0.76rem" }}
          >
            SendGrid API (No Domain Needed)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "resend" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("resend")}
            style={{ flex: 1, fontSize: "0.76rem" }}
          >
            Resend API (Custom Domain)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${provider === "gmail" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setProvider("gmail")}
            style={{ fontSize: "0.76rem" }}
          >
            Gmail SMTP
          </button>
        </div>

        {/* Brevo Guide */}
        {provider === "brevo" && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#166534" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Globe size={15} /> Sends to ANY Email Address in the World (300 Free / Day)
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              Brevo allows sending to candidates with <strong>@gmail.com, @yahoo.com, etc.</strong> without owning a custom domain!
            </p>
            <div style={{ marginTop: "0.4rem", lineHeight: 1.5 }}>
              1. Sign in to{" "}
              <a href="https://app.brevo.com" target="_blank" rel="noreferrer" style={{ color: "#15803d", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                Brevo <ExternalLink size={12} />
              </a>.<br />
              2. Go to <strong>SMTP & API</strong> ➔ <strong>API Keys</strong> ➔ Generate key (starts with <code>xkeysib-</code>).<br />
              3. Set <strong>Sender Email</strong> to your exact Brevo login email below.
            </div>
          </div>
        )}

        {/* SendGrid Guide */}
        {provider === "sendgrid" && (
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#1e40af" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Zap size={15} /> Sends to ANY Email Address in the World (100 Free / Day)
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              SendGrid allows sending to anyone using <strong>Single Sender Verification</strong> (no custom domain needed).
            </p>
            <div style={{ marginTop: "0.4rem", lineHeight: 1.5 }}>
              1. Sign in to{" "}
              <a href="https://app.sendgrid.com" target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                SendGrid <ExternalLink size={12} />
              </a>.<br />
              2. Go to <strong>Settings</strong> ➔ <strong>Sender Authentication</strong> ➔ <strong>Verify a Single Sender</strong> (verify your Gmail).<br />
              3. Go to <strong>API Keys</strong> ➔ Create API Key (starts with <code>SG.</code>) and paste below.
            </div>
          </div>
        )}

        {/* Resend Guide */}
        {provider === "resend" && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#92400e" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              ⚠️ Why Resend Said: "You can only send testing emails to your own email address"
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              Resend’s free test domain (<code>onboarding@resend.dev</code>) restricts dispatches <strong>only to the account owner's email</strong> to prevent spam.
            </p>
            <p style={{ margin: "0.3rem 0 0" }}>
              👉 <strong>To send to other users/candidates:</strong> Add your website domain at{" "}
              <a href="https://resend.com/domains" target="_blank" rel="noreferrer" style={{ color: "#b45309", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                resend.com/domains <ExternalLink size={12} />
              </a> and add the DNS records. Once verified, you can send from <code>noreply@yourdomain.com</code> to anyone!
            </p>
          </div>
        )}

        {/* Gmail SMTP Guide */}
        {provider === "gmail" && (
          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.8rem", color: "#9f1239" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              🛑 Render Cloud Firewall Notice
            </div>
            <p style={{ margin: "0.2rem 0" }}>
              Render permanently blocks raw SMTP ports 25, 465, and 587 with <code>[Errno 101] Network is unreachable</code>. Gmail SMTP works on localhost, but on Render cloud, you must use <strong>Brevo</strong>, <strong>SendGrid</strong>, or <strong>Resend</strong> over HTTPS Port 443.
            </p>
          </div>
        )}

        <form onSubmit={handleSaveAndTest}>
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
                  placeholder="hirepro455@gmail.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
                  Must match the exact email you signed up with on Brevo. Brevo uses this to deliver to ANY recipient in the world!
                </span>
              </div>
            </>
          )}

          {provider === "sendgrid" && (
            <>
              <div className="form-group">
                <label className="form-label">SendGrid API Key (starts with <code>SG.</code>) *</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={sendgridKey}
                  onChange={(e) => setSendgridKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Verified Single Sender Email *</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="hirepro455@gmail.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
                  Must be verified under SendGrid ➔ Sender Authentication ➔ Single Sender Verification.
                </span>
              </div>
            </>
          )}

          {provider === "resend" && (
            <>
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

              <div className="form-group">
                <label className="form-label">Sender Address (Requires Verified Domain on Resend) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="noreply@yourdomain.com (or onboarding@resend.dev for testing)"
                  value={customDomainSender}
                  onChange={(e) => setCustomDomainSender(e.target.value)}
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
                  To send to other recipients, use an email with your verified custom domain from resend.com/domains.
                </span>
              </div>
            </>
          )}

          {provider === "gmail" && (
            <>
              <div className="form-group">
                <label className="form-label">Gmail Address *</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="hirepro455@gmail.com"
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
                <span style={{ fontSize: "0.72rem", color: "#991b1b", marginTop: "0.2rem", display: "block" }}>
                  Note: Port 465 is blocked on Render cloud with Errno 101. Only works on localhost.
                </span>
              </div>
            </>
          )}

          <div className="form-group" style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)" }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Send Real Test OTP Email To Any Address *</label>
            <input
              type="email"
              className="form-input"
              required
              placeholder="any_test_email@gmail.com"
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
