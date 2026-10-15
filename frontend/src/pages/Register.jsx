import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Briefcase, AlertCircle, ShieldCheck, Mail, CheckCircle2, RefreshCw } from "lucide-react";

export const Register = ({ onSwitchToLogin }) => {
  const { register, verifyEmail, resendVerification } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("candidate"); // candidate, recruiter, admin
  const [company, setCompany] = useState("");
  const [adminSecretKey, setAdminSecretKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Email verification state
  const [verificationStep, setVerificationStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await register({
        full_name: fullName,
        email,
        password,
        role,
        company: role === "recruiter" ? company : "",
        admin_secret_key: role === "admin" ? adminSecretKey : undefined,
      });

      if (res && res.user && !res.user.is_email_verified) {
        setPendingEmail(email);
        setDemoCode(res.verification_code || "");
        setEnteredCode(res.verification_code || ""); // Pre-fill evaluation code for convenience
        setVerificationStep(true);
      }
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setVerifyError("");
    setVerifyLoading(true);

    try {
      await verifyEmail(pendingEmail, enteredCode.trim());
      setVerifySuccessMsg("Email verified successfully! Logging you in...");
    } catch (err) {
      setVerifyError(err.message || "Invalid verification code");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    setVerifyError("");
    try {
      const res = await resendVerification(pendingEmail);
      if (res && res.verification_code) {
        setDemoCode(res.verification_code);
        setEnteredCode(res.verification_code);
      }
      setVerifySuccessMsg("A new 6-digit code has been dispatched!");
      setTimeout(() => setVerifySuccessMsg(""), 4000);
    } catch (err) {
      setVerifyError(err.message || "Failed to resend code");
    }
  };

  // 1. Email Verification Step
  if (verificationStep) {
    return (
      <div style={{ maxWidth: "480px", margin: "2rem auto" }}>
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{
              display: "inline-flex", padding: "0.75rem", borderRadius: "12px",
              background: "#eff6ff", color: "var(--primary)", marginBottom: "0.75rem"
            }}>
              <Mail size={30} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700 }}>Verify Your Email</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              We sent a 6-digit verification code to<br />
              <strong style={{ color: "var(--text-main)" }}>{pendingEmail}</strong>
            </p>
          </div>

          {verifyError && (
            <div style={{
              background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem",
              fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem"
            }}>
              <AlertCircle size={16} />
              <span>{verifyError}</span>
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

          {demoCode && (
            <div style={{
              background: "#f0fdf4", border: "1px dashed #86efac", borderRadius: "8px",
              padding: "0.75rem", marginBottom: "1.25rem", fontSize: "0.82rem", color: "#166534"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🧪 <strong>Demo/Evaluation Code:</strong> <code style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "2px" }}>{demoCode}</code></span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                  onClick={() => setEnteredCode(demoCode)}
                >
                  Use Code
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleVerifyEmail}>
            <div className="form-group">
              <label className="form-label" style={{ textAlign: "center", display: "block" }}>
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                className="form-input"
                required
                maxLength={6}
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                style={{
                  textAlign: "center",
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  letterSpacing: "6px",
                  padding: "0.6rem"
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              disabled={verifyLoading || enteredCode.length !== 6}
            >
              {verifyLoading ? "Verifying..." : "Verify & Complete Registration"}
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
              onClick={() => setVerificationStep(false)}
              style={{ color: "var(--text-muted)" }}
            >
              Back to Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Main Registration Form
  return (
    <div style={{ maxWidth: "480px", margin: "2rem auto" }}>
      <div className="card">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            display: "inline-flex", padding: "0.75rem", borderRadius: "12px",
            background: "var(--primary-light)", color: "var(--primary)", marginBottom: "0.75rem"
          }}>
            <Briefcase size={28} />
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Join HireSphere</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Select your role to get started
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
          {/* Role Selection */}
          <div className="form-group">
            <label className="form-label">I am joining as a:</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <button
                type="button"
                className={`btn btn-sm ${role === "candidate" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setRole("candidate")}
              >
                🎓 Student
              </button>
              <button
                type="button"
                className={`btn btn-sm ${role === "recruiter" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setRole("recruiter")}
              >
                👔 Recruiter
              </button>
              <button
                type="button"
                className={`btn btn-sm ${role === "admin" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setRole("admin")}
              >
                🛡️ Admin
              </button>
            </div>
            {role === "recruiter" && (
              <p style={{ fontSize: "0.75rem", color: "#d97706", marginTop: "0.4rem" }}>
                ℹ️ Recruiter accounts require administrator review and approval before publishing jobs (FR-ADM-01).
              </p>
            )}
            {role === "admin" && (
              <p style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.4rem" }}>
                🔒 Admin accounts require an authorization key to prevent unauthorized platform administrators.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input 
              type="text" 
              className="form-input" 
              required 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jordan Miller"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@organization.com"
            />
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", display: "block" }}>
              A 6-digit confirmation code will be required to verify your email.
            </span>
          </div>

          {role === "recruiter" && (
            <div className="form-group">
              <label className="form-label">Company / Organization</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stripe, Google, Acme Corp"
              />
            </div>
          )}

          {/* Admin Passcode Protection */}
          {role === "admin" && (
            <div className="form-group" style={{ background: "#fef2f2", padding: "0.75rem", borderRadius: "8px", border: "1px solid #fecaca" }}>
              <label className="form-label" style={{ color: "#991b1b", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <ShieldCheck size={16} /> Admin Security Passcode *
              </label>
              <input 
                type="password" 
                className="form-input" 
                required 
                value={adminSecretKey}
                onChange={(e) => setAdminSecretKey(e.target.value)}
                placeholder="Enter system admin passcode"
              />
              <p style={{ fontSize: "0.72rem", color: "#b91c1c", marginTop: "0.3rem" }}>
                🔑 Authorized system administrator key required. (Evaluation Key: <code>CS455-ADMIN-2026</code>)
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: "100%", marginTop: "0.5rem" }}
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account & Verify Email"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Already registered?{" "}
          <button 
            type="button" 
            onClick={onSwitchToLogin} 
            style={{ color: "var(--primary)", fontWeight: 600 }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
