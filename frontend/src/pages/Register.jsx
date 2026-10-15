import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Briefcase, AlertCircle, ShieldCheck, Mail, CheckCircle2, RefreshCw, Eye, EyeOff } from "lucide-react";

export const Register = ({ onSwitchToLogin }) => {
  const { register, verifyEmail, resendVerification } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState("candidate"); // candidate, recruiter, admin
  const [company, setCompany] = useState("");
  const [adminSecretKey, setAdminSecretKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Email verification state
  const [verificationStep, setVerificationStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySuccessMsg, setVerifySuccessMsg] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 1. Password confirmation check
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter identical passwords in both fields.");
      return;
    }

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
        setEnteredCode("");
        setEmailSent(res.email_sent === true);
        setDevCode(res.dev_code || "");
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
      setVerifyError(err.message || "Invalid 6-digit verification code. Please check and try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    setVerifyError("");
    try {
      const res = await resendVerification(pendingEmail);
      if (res) {
        setEmailSent(res.email_sent === true);
        if (res.dev_code) setDevCode(res.dev_code);
        setVerifySuccessMsg(res.message || "A new 6-digit verification code has been dispatched!");
      }
      setTimeout(() => setVerifySuccessMsg(""), 5000);
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
              {emailSent ? (
                <span>A 6-digit confirmation code was emailed to<br /><strong style={{ color: "var(--text-main)" }}>{pendingEmail}</strong></span>
              ) : (
                <span>Verification code generated for<br /><strong style={{ color: "var(--text-main)" }}>{pendingEmail}</strong></span>
              )}
            </p>
          </div>

          {!emailSent && (
            <div style={{
              background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.82rem"
            }}>
              <strong>ℹ️ Real Email Delivery Notice:</strong>
              <p style={{ margin: "0.25rem 0" }}>
                To send emails directly to inboxes on Render, set <code>SMTP_USER</code> and <code>SMTP_PASSWORD</code> in your Render Environment settings.
              </p>
              {devCode && (
                <div style={{ marginTop: "0.4rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Test Code (SMTP unconfigured): <strong style={{ letterSpacing: "2px", fontSize: "1rem" }}>{devCode}</strong></span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}
                    onClick={() => setEnteredCode(devCode)}
                  >
                    Auto-fill
                  </button>
                </div>
              )}
            </div>
          )}

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
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", display: "block", marginTop: "0.3rem" }}>
                Please check your email inbox or backend console logs
              </span>
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

          {/* Password with Eye Toggle */}
          <div className="form-group">
            <label className="form-label">Password * (min 6 characters)</label>
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

          {/* Confirm Password with Eye Toggle */}
          <div className="form-group">
            <label className="form-label">Confirm Password *</label>
            <div style={{ position: "relative" }}>
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                className="form-input" 
                style={{ paddingRight: "2.5rem" }}
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                title={showConfirmPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <span style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem", display: "block" }}>
                ⚠️ Passwords do not match
              </span>
            )}
            {confirmPassword && password === confirmPassword && (
              <span style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: "0.25rem", display: "block" }}>
                ✓ Passwords match
              </span>
            )}
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
