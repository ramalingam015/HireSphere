import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/client";
import { Briefcase, Sparkles, AlertCircle, Mail, CheckCircle2, RefreshCw, Eye, EyeOff, Wrench } from "lucide-react";

export const Login = ({ onSwitchToRegister, onOpenEmailConfig }) => {
  const { login, loginAsDemo, verifyEmail, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Unverified email handler state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailDetail, setEmailDetail] = useState("");
  const [devCode, setDevCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState("");

  // Diagnostics state
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagInfo, setDiagInfo] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      const msg = err.message || "Invalid email or password";
      if (msg.toLowerCase().includes("email not verified")) {
        setNeedsVerification(true);
        const match = msg.match(/Dev Code:\s*(\d{6})/i);
        if (match && match[1]) {
          setDevCode(match[1]);
          setEmailSent(false);
          setEmailDetail(msg);
          setError("Email verification is required before signing in.");
        } else {
          setEmailSent(true);
          setError("Email verification is required before signing in.");
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e, codeOverride = null) => {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    setVerifyLoading(true);

    const codeToSubmit = (codeOverride || verificationCode || "").trim();
    if (!codeToSubmit || codeToSubmit.length !== 6) {
      setError("Please enter a valid 6-digit verification code.");
      setVerifyLoading(false);
      return;
    }

    try {
      await verifyEmail(email, codeToSubmit);
      setVerifySuccessMsg("Email verified successfully! Logging you in...");
    } catch (err) {
      setError(err.message || "Invalid verification code. Please check and try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      const res = await resendVerification(email);
      if (res) {
        setEmailSent(res.email_sent === true);
        if (res.email_detail) setEmailDetail(res.email_detail);
        if (res.dev_code) setDevCode(res.dev_code);
        setVerifySuccessMsg(res.message || "A new verification code has been dispatched to your email!");
      }
      setTimeout(() => setVerifySuccessMsg(""), 6000);
    } catch (err) {
      setError(err.message || "Failed to resend verification code");
    }
  };

  const handleCheckDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const data = await apiRequest("/api/auth/email-diagnostics");
      setDiagInfo(data);
      setShowDiagnostics(true);
    } catch (err) {
      alert("Failed to load email server diagnostics: " + err.message);
    } finally {
      setDiagLoading(false);
    }
  };

  // 1. Unverified Email Verification Prompt View
  if (needsVerification) {
    return (
      <div style={{ maxWidth: "440px", margin: "2rem auto" }}>
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{
              display: "inline-flex", padding: "0.75rem", borderRadius: "12px",
              background: "#eff6ff", color: "var(--primary)", marginBottom: "0.75rem"
            }}>
              <Mail size={30} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700 }}>Email Verification Required</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              <span>A 6-digit confirmation code was emailed to<br /><strong style={{ color: "var(--text-main)" }}>{email}</strong></span>
            </p>
          </div>

          {emailSent ? (
            <div style={{
              background: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.82rem",
              display: "flex", alignItems: "flex-start", gap: "0.5rem"
            }}>
              <CheckCircle2 size={16} style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <strong>Verification email dispatched!</strong>
                <p style={{ margin: "0.2rem 0 0" }}>Please check your inbox (and Spam folder) for the 6-digit code.</p>
              </div>
            </div>
          ) : (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.82rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                <AlertCircle size={15} /> Email Delivery Notice
              </div>
              <p style={{ margin: "0.2rem 0" }}>
                {emailDetail || "Could not dispatch verification email. Please check your email configuration."}
              </p>
              {onOpenEmailConfig && (
                <div style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    onClick={() => onOpenEmailConfig(email)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", fontSize: "0.75rem", background: "#fef3c7", borderColor: "#fde68a", color: "#92400e", fontWeight: 600 }}
                  >
                    ⚙️ Configure Real Email Delivery (Brevo / SendGrid / Resend)
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{
              background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem",
              fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem"
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {verifySuccessMsg && (
            <div style={{
              background: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem",
              fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem"
            }}>
              <CheckCircle2 size={16} />
              <span>{verifySuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label className="form-label" style={{ textAlign: "center", display: "block" }}>
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                className="form-input"
                required
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                style={{
                  textAlign: "center",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  letterSpacing: "6px",
                  padding: "0.6rem"
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", display: "block", marginTop: "0.3rem" }}>
                Check your email inbox or backend console logs
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              disabled={verifyLoading || verificationCode.length !== 6}
            >
              {verifyLoading ? "Verifying..." : "Verify & Sign In"}
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem", fontSize: "0.82rem" }}>
            <button
              type="button"
              onClick={handleResend}
              style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 500 }}
            >
              <RefreshCw size={13} /> Resend Code
            </button>
            <button
              type="button"
              onClick={() => { setNeedsVerification(false); setError(""); }}
              style={{ color: "var(--text-muted)" }}
            >
              Back to Login
            </button>
          </div>

          {/* Email Server Diagnostics Toggle */}
          <div style={{ textAlign: "center", marginTop: "1.25rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--border)" }}>
            <button
              type="button"
              onClick={handleCheckDiagnostics}
              style={{ fontSize: "0.75rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 600 }}
            >
              <Wrench size={13} /> {diagLoading ? "Checking email server..." : "Check Email Server Status"}
            </button>
          </div>

          {showDiagnostics && diagInfo && (
            <div style={{
              marginTop: "0.75rem", padding: "0.85rem", background: "#f8fafc",
              border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.75rem", color: "#334155", textAlign: "left"
            }}>
              <div style={{ fontWeight: 700, marginBottom: "0.4rem", color: "#0f172a" }}>Server Email Configuration:</div>
              <div style={{ marginBottom: "0.2rem" }}>• <strong>Email Provider:</strong> {diagInfo.provider}</div>
              <div style={{ marginBottom: "0.2rem" }}>• <strong>Credentials Set on Server:</strong> {diagInfo.configured ? "✅ Yes" : "❌ No"}</div>
              <div style={{ marginBottom: "0.2rem" }}>• <strong>Sender Address:</strong> {diagInfo.from_email || "Not configured"}</div>
              <div style={{ marginBottom: "0.2rem" }}>• <strong>SMTP Host:Port:</strong> {diagInfo.smtp_host}:{diagInfo.smtp_port}</div>
              {!diagInfo.configured && (
                <div style={{ marginTop: "0.5rem", color: "#b45309", background: "#fef3c7", padding: "0.5rem", borderRadius: "6px", lineHeight: "1.4" }}>
                  💡 <strong>To receive real emails:</strong> Add <code>SMTP_USER</code> and <code>SMTP_PASSWORD</code> in your Render Dashboard (Environment tab) or provide a <code>BREVO_API_KEY</code>.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Standard Login Form
  return (
    <div style={{ maxWidth: "440px", margin: "2rem auto" }}>
      <div className="card">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            display: "inline-flex", padding: "0.75rem", borderRadius: "12px",
            background: "var(--primary-light)", color: "var(--primary)", marginBottom: "0.75rem"
          }}>
            <Briefcase size={28} />
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Welcome to HireSphere</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Campus & Industry Recruitment System
          </p>
        </div>

        {error && (
          <div style={{
            background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b",
            padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem",
            fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem"
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: "relative" }}>
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-input" 
                style={{ paddingRight: "2.5rem" }}
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  padding: "0.25rem"
                }}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Don't have an account?{" "}
          <button 
            type="button" 
            onClick={onSwitchToRegister} 
            style={{ color: "var(--primary)", fontWeight: 600 }}
          >
            Create an Account
          </button>
        </div>
      </div>
    </div>
  );
};
