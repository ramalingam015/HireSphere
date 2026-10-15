import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Briefcase, Sparkles, AlertCircle, Mail, CheckCircle2, RefreshCw, Eye, EyeOff } from "lucide-react";

export const Login = ({ onSwitchToRegister }) => {
  const { login, loginAsDemo, verifyEmail, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Unverified email handler state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState("");

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
        setError("Email verification is required before signing in.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setVerifyLoading(true);

    try {
      await verifyEmail(email, verificationCode.trim());
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
      await resendVerification(email);
      setVerifySuccessMsg("A new verification code has been dispatched to your email!");
      setTimeout(() => setVerifySuccessMsg(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to resend verification code");
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
              A 6-digit confirmation code has been sent to<br />
              <strong style={{ color: "var(--text-main)" }}>{email}</strong>
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

        {/* 1-Click Demo Login Box */}
        <div style={{
          background: "#f8fafc", border: "1px dashed var(--border)",
          borderRadius: "8px", padding: "0.85rem", marginBottom: "1.25rem"
        }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.5rem" }}>
            <Sparkles size={13} /> 1-CLICK INSTANT DEMO ROLES:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => loginAsDemo("candidate")}
              style={{ fontSize: "0.75rem" }}
            >
              🎓 Student
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => loginAsDemo("recruiter")}
              style={{ fontSize: "0.75rem" }}
            >
              👔 Recruiter
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => loginAsDemo("pending_recruiter")}
              style={{ fontSize: "0.75rem" }}
            >
              ⏳ Pending Recruiter
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => loginAsDemo("admin")}
              style={{ fontSize: "0.75rem" }}
            >
              🛡️ Admin
            </button>
          </div>
        </div>

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
