import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/client";
import { Briefcase, AlertCircle, Mail, CheckCircle2, RefreshCw, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";

export const Login = ({ onSwitchToRegister }) => {
  const { login, verifyEmail, resendVerification, sessionMessage } = useAuth();
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

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: code + new pwd, 3: success
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotError, setForgotError] = useState("");

  const handleRequestResetCode = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotMsg("");
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your email address.");
      return;
    }
    try {
      setForgotLoading(true);
      const res = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotMsg(res.message || "A 6-digit password reset code has been sent to your email.");
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || "Failed to send reset code. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotMsg("");
    if (!forgotCode.trim() || forgotCode.trim().length !== 6) {
      setForgotError("Please enter the 6-digit code received on your email.");
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError("Password must be at least 6 characters long.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    try {
      setForgotLoading(true);
      const res = await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: forgotCode.trim(),
          new_password: forgotNewPassword,
        }),
      });
      setForgotMsg(res.message || "Password reset successfully!");
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.message || "Invalid or expired code. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };


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

        </div>
      </div>
    );
  }

  // 2. Forgot / Reset Password View
  if (showForgotPassword) {
    return (
      <div style={{ maxWidth: "440px", margin: "2rem auto" }}>
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{
              display: "inline-flex", padding: "0.75rem", borderRadius: "12px",
              background: "#eff6ff", color: "var(--primary)", marginBottom: "0.75rem"
            }}>
              <KeyRound size={28} />
            </div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>Reset Password</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {forgotStep === 1 && "Enter your registered email to receive a 6-digit recovery code."}
              {forgotStep === 2 && `Enter the 6-digit code sent to ${forgotEmail} and choose a new password.`}
              {forgotStep === 3 && "Your password has been reset successfully!"}
            </p>
          </div>

          {forgotError && (
            <div style={{
              background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem",
              fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem"
            }}>
              <AlertCircle size={16} />
              <span>{forgotError}</span>
            </div>
          )}

          {forgotMsg && (
            <div style={{
              background: "#d1fae5", border: "1px solid #a7f3d0", color: "#065f46",
              padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem",
              fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem"
            }}>
              <CheckCircle2 size={16} />
              <span>{forgotMsg}</span>
            </div>
          )}

          {forgotStep === 1 && (
            <form onSubmit={handleRequestResetCode}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "0.5rem" }}
                disabled={forgotLoading}
              >
                {forgotLoading ? "Sending Code..." : "Send 6-Digit Reset Code"}
              </button>
            </form>
          )}

          {forgotStep === 2 && (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">6-Digit Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-input"
                  style={{ textAlign: "center", letterSpacing: "6px", fontSize: "1.2rem", fontWeight: 700 }}
                  required
                  value={forgotCode}
                  onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  minLength={6}
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  minLength={6}
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "0.5rem" }}
                disabled={forgotLoading}
              >
                {forgotLoading ? "Resetting Password..." : "Save New Password"}
              </button>

              <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => { setForgotStep(1); setForgotError(""); }}
                  style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                >
                  Change Email or Resend Code
                </button>
              </div>
            </form>
          )}

          {forgotStep === 3 && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-main)", marginBottom: "1.25rem" }}>
                You can now log in using your updated password.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={() => {
                  setEmail(forgotEmail);
                  setShowForgotPassword(false);
                  setForgotStep(1);
                  setForgotError("");
                  setForgotMsg("");
                }}
              >
                Sign In Now
              </button>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <button
              type="button"
              onClick={() => { setShowForgotPassword(false); setForgotStep(1); setForgotError(""); setForgotMsg(""); }}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", color: "var(--text-muted)", fontSize: "0.85rem" }}
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Standard Login Form
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

        {sessionMessage && !error && (
          <div style={{
            background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af",
            padding: "0.75rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.85rem"
          }}>
            {sessionMessage}
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

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-0.25rem", marginBottom: "0.85rem" }}>
            <button
              type="button"
              onClick={() => {
                setForgotEmail(email);
                setShowForgotPassword(true);
                setForgotStep(1);
                setForgotError("");
                setForgotMsg("");
              }}
              style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 500 }}
            >
              Forgot password?
            </button>
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
