import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/client";
import { 
  Briefcase, AlertCircle, Mail, CheckCircle2, RefreshCw, Eye, EyeOff, 
  KeyRound, ArrowLeft, Sparkles, Clock, Shield, Users, ThumbsUp, 
  Calendar, Zap, Lock, Check, ChevronRight, User, Award, Layers
} from "lucide-react";

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

  // Interactive showcase state
  const [activeFeatureTab, setActiveFeatureTab] = useState("ats"); // "ats" | "slots" | "network"
  const [mockRoleIndex, setMockRoleIndex] = useState(0);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(1);
  const [mockLiked, setMockLiked] = useState(false);
  const [quickFillMsg, setQuickFillMsg] = useState("");

  const mockRoles = [
    {
      title: "Senior Full-Stack Engineer",
      company: "CloudScale Systems",
      score: 94,
      level: "High Match",
      skills: ["Python", "React", "FastAPI", "Docker", "PostgreSQL"],
      missing: ["Kubernetes"],
      reason: "Strong alignment with backend architecture and frontend components. Location matches remote preference."
    },
    {
      title: "AI & ML Systems Engineer",
      company: "NextGen AI Lab",
      score: 88,
      level: "High Match",
      skills: ["Python", "PyTorch", "FastAPI", "PostgreSQL"],
      missing: ["TensorFlow", "MLOps"],
      reason: "High relevancy in core deep learning frameworks and REST API service development."
    }
  ];

  const handleQuickFill = (roleEmail, rolePass, roleName) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError("");
    setQuickFillMsg(`Filled ${roleName} credentials! Click 'Sign In' below.`);
    setTimeout(() => setQuickFillMsg(""), 5000);
  };

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

  // Render the right-hand authentication form (Login / Forgot Password / Verify)
  const renderAuthForm = () => {
    if (needsVerification) {
      return (
        <div className="card auth-card-glass" style={{ padding: "1.65rem 1.75rem" }}>
          <div style={{ textAlign: "center", marginBottom: "1.15rem" }}>
            <div style={{
              display: "inline-flex", padding: "0.55rem", borderRadius: "10px",
              background: "#eff6ff", color: "var(--primary)", marginBottom: "0.5rem"
            }}>
              <Mail size={24} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Verify Your Email</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              A 6-digit code was sent to <strong>{email}</strong>
            </p>
          </div>

          {verifySuccessMsg && (
            <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", color: "#065f46", padding: "0.6rem", borderRadius: "8px", marginBottom: "0.75rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <CheckCircle2 size={15} /> {verifySuccessMsg}
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "0.6rem", borderRadius: "8px", marginBottom: "0.75rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <form onSubmit={handleVerify}>
            <div className="form-group" style={{ marginBottom: "0.85rem" }}>
              <label className="form-label" style={{ fontSize: "0.8rem" }}>6-Digit Code</label>
              <input 
                type="text" 
                maxLength={6} 
                className="form-input" 
                style={{ textAlign: "center", letterSpacing: "5px", fontSize: "1.15rem", fontWeight: 700 }}
                required 
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "0.6rem", fontSize: "0.88rem" }} disabled={verifyLoading}>
              {verifyLoading ? "Verifying..." : "Verify & Sign In"}
            </button>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.85rem", fontSize: "0.78rem" }}>
            <button type="button" onClick={handleResend} style={{ color: "var(--primary)", fontWeight: 600 }}>
              Resend Code
            </button>
            <button type="button" onClick={() => { setNeedsVerification(false); setError(""); }} style={{ color: "var(--text-muted)" }}>
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    if (showForgotPassword) {
      return (
        <div className="card auth-card-glass" style={{ padding: "1.65rem 1.75rem" }}>
          <div style={{ textAlign: "center", marginBottom: "1.15rem" }}>
            <div style={{
              display: "inline-flex", padding: "0.55rem", borderRadius: "10px",
              background: "#eff6ff", color: "var(--primary)", marginBottom: "0.5rem"
            }}>
              <KeyRound size={24} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Reset Password</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              {forgotStep === 1 && "Enter your email to receive a recovery code."}
              {forgotStep === 2 && `Enter the 6-digit code sent to ${forgotEmail}.`}
              {forgotStep === 3 && "Your password has been reset successfully!"}
            </p>
          </div>

          {forgotError && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "0.6rem", borderRadius: "8px", marginBottom: "0.75rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <AlertCircle size={15} /> <span>{forgotError}</span>
            </div>
          )}

          {forgotMsg && (
            <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", color: "#065f46", padding: "0.6rem", borderRadius: "8px", marginBottom: "0.75rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <CheckCircle2 size={15} /> <span>{forgotMsg}</span>
            </div>
          )}

          {forgotStep === 1 && (
            <form onSubmit={handleRequestResetCode}>
              <div className="form-group" style={{ marginBottom: "0.85rem" }}>
                <label className="form-label" style={{ fontSize: "0.8rem" }}>Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="user@example.com"
                  autoFocus
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "0.6rem", fontSize: "0.88rem" }} disabled={forgotLoading}>
                {forgotLoading ? "Sending Code..." : "Send Reset Code"}
              </button>
            </form>
          )}

          {forgotStep === 2 && (
            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: "0.7rem" }}>
                <label className="form-label" style={{ fontSize: "0.78rem" }}>6-Digit Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  className="form-input"
                  style={{ textAlign: "center", letterSpacing: "5px", fontSize: "1.1rem", fontWeight: 700 }}
                  required
                  value={forgotCode}
                  onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: "0.7rem" }}>
                <label className="form-label" style={{ fontSize: "0.78rem" }}>New Password</label>
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

              <div className="form-group" style={{ marginBottom: "0.85rem" }}>
                <label className="form-label" style={{ fontSize: "0.78rem" }}>Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  minLength={6}
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "0.6rem", fontSize: "0.88rem" }} disabled={forgotLoading}>
                {forgotLoading ? "Resetting Password..." : "Save New Password"}
              </button>

              <div style={{ textAlign: "center", marginTop: "0.65rem" }}>
                <button type="button" onClick={() => { setForgotStep(1); setForgotError(""); }} style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                  Change Email or Resend
                </button>
              </div>
            </form>
          )}

          {forgotStep === 3 && (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <p style={{ fontSize: "0.85rem", color: "var(--text-main)", marginBottom: "1rem" }}>
                You can now log in using your updated password.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%", padding: "0.6rem" }}
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

          <div style={{ textAlign: "center", marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
            <button
              type="button"
              onClick={() => { setShowForgotPassword(false); setForgotStep(1); setForgotError(""); setForgotMsg(""); }}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "var(--text-muted)", fontSize: "0.8rem" }}
            >
              <ArrowLeft size={13} /> Back to Sign In
            </button>
          </div>
        </div>
      );
    }

    // Default Sign In Form
    return (
      <div className="card auth-card-glass" style={{ padding: "1.75rem 2rem" }}>
        <div style={{ marginBottom: "1.15rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
            <div style={{
              display: "inline-flex", padding: "0.45rem", borderRadius: "8px",
              background: "var(--primary-light)", color: "var(--primary)"
            }}>
              <Briefcase size={20} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main)" }}>
              Welcome back
            </h2>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Sign in to access your HireSphere account & dashboard.
          </p>
        </div>

        {error && (
          <div style={{
            background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b",
            padding: "0.6rem 0.75rem", borderRadius: "8px", marginBottom: "0.85rem",
            fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem"
          }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {sessionMessage && !error && (
          <div style={{
            background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af",
            padding: "0.6rem 0.75rem", borderRadius: "8px", marginBottom: "0.85rem", fontSize: "0.8rem"
          }}>
            {sessionMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "0.85rem" }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.3rem" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={15} color="var(--text-muted)" style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="email" 
                className="form-input" 
                style={{ paddingLeft: "34px", paddingRight: "0.75rem", fontSize: "0.88rem" }}
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com or student@univ.edu"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "1.1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: "0.8rem", margin: 0 }}>
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotPassword(true);
                  setForgotStep(1);
                  setForgotError("");
                  setForgotMsg("");
                }}
                style={{ fontSize: "0.78rem", color: "var(--primary)", fontWeight: 600 }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <Lock size={15} color="var(--text-muted)" style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type={showPassword ? "text" : "password"} 
                className="form-input" 
                style={{ paddingLeft: "34px", paddingRight: "2.5rem", fontSize: "0.88rem" }}
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
                  right: "0.65rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  padding: "0.2rem"
                }}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: "100%", padding: "0.65rem", fontSize: "0.92rem", fontWeight: 700, borderRadius: "9px" }}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In to HireSphere"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.1rem", fontSize: "0.82rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "0.85rem" }}>
          Don't have an account yet?{" "}
          <button 
            type="button" 
            onClick={onSwitchToRegister} 
            style={{ color: "var(--primary)", fontWeight: 700 }}
          >
            Create an Account
          </button>
        </div>
      </div>
    );
  };

  const currentRole = mockRoles[mockRoleIndex];

  return (
    <div className="auth-wrapper">
      <div className="auth-ambient-bg" />
      <div className="auth-grid-overlay" />
      <div style={{
        position: "relative",
        zIndex: 2,
        maxWidth: "1120px",
        width: "100%",
        margin: "0 auto"
      }}>
        {/* 2-Column Responsive Layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
          gap: "2.25rem",
          alignItems: "center"
        }}>
          {/* LEFT COLUMN: Interactive Feature Showcase */}
          <div>
            {/* Header & Value Proposition */}
            <div style={{ marginBottom: "0.85rem" }}>
              <div className="auth-floating-badge" style={{ marginBottom: "0.45rem", padding: "0.3rem 0.75rem", fontSize: "0.74rem" }}>
                <span className="auth-pulse-dot" />
                <Sparkles size={13} /> AI-Powered Recruitment Platform
              </div>

              <h1 className="auth-hero-gradient-text" style={{
                fontSize: "1.85rem",
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                marginBottom: "0.35rem"
              }}>
                Where talent meets opportunity with precision AI.
              </h1>

              <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                Campus & industry recruitment with automated ATS resume scoring, atomic interview booking, and zero-trust verified networking.
              </p>
            </div>

            {/* Interactive Feature Explorer Box */}
            <div className="card auth-card-glass" style={{
              padding: "0.85rem 1rem",
              marginBottom: "0.65rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Interactive Feature Preview
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--primary)", fontWeight: 600 }}>
                  Click tabs to preview ▾
                </span>
              </div>

              {/* Feature Tabs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.35rem", marginBottom: "0.65rem" }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeFeatureTab === "ats" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveFeatureTab("ats")}
                  style={{ fontSize: "0.74rem", padding: "0.3rem 0.45rem" }}
                >
                  🎯 AI ATS Match
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeFeatureTab === "slots" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveFeatureTab("slots")}
                  style={{ fontSize: "0.74rem", padding: "0.3rem 0.45rem" }}
                >
                  ⚡ Atomic Slots
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeFeatureTab === "network" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setActiveFeatureTab("network")}
                  style={{ fontSize: "0.74rem", padding: "0.3rem 0.45rem" }}
                >
                  🤝 Verified Feed
                </button>
              </div>

              {/* TAB 1: Live Interactive ATS Preview */}
              {activeFeatureTab === "ats" && (
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "0.75rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text-main)" }}>
                        {currentRole.title}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        {currentRole.company} • Remote / Hybrid
                      </div>
                    </div>
                    <div style={{
                      background: "#dcfce7", color: "#15803d",
                      border: "1px solid #86efac",
                      padding: "0.2rem 0.5rem", borderRadius: "16px",
                      fontWeight: 800, fontSize: "0.78rem"
                    }}>
                      {currentRole.score}% {currentRole.level}
                    </div>
                  </div>

                  <div style={{ marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {currentRole.skills.slice(0, 4).map(s => (
                        <span key={s} style={{ background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: "4px", fontSize: "0.68rem", fontWeight: 600 }}>
                          ✓ {s}
                        </span>
                      ))}
                      {currentRole.missing.slice(0, 1).map(s => (
                        <span key={s} style={{ background: "#fee2e2", color: "#991b1b", padding: "1px 6px", borderRadius: "4px", fontSize: "0.68rem" }}>
                          ✕ {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.72rem", color: "#334155", background: "#ffffff", padding: "0.35rem 0.6rem", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "0.4rem" }}>
                    <strong>AI Note:</strong> {currentRole.reason}
                  </div>

                  <button
                    type="button"
                    onClick={() => setMockRoleIndex((mockRoleIndex + 1) % mockRoles.length)}
                    style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}
                  >
                    <RefreshCw size={11} /> Test Scan Another Role ↵
                  </button>
                </div>
              )}

              {/* TAB 2: Live Interactive Interview Slots Preview */}
              {activeFeatureTab === "slots" && (
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "0.75rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                    <Calendar size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>
                      Selectable Interview Slots (Technical Round)
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.35rem", marginBottom: "0.5rem" }}>
                    {[
                      { time: "10:00 AM", day: "Tomorrow" },
                      { time: "02:00 PM", day: "Tomorrow" },
                      { time: "04:30 PM", day: "Friday" }
                    ].map((slot, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedSlotIndex(idx)}
                        style={{
                          padding: "0.4rem 0.2rem",
                          borderRadius: "7px",
                          textAlign: "center",
                          border: selectedSlotIndex === idx ? "2px solid var(--primary)" : "1px solid var(--border)",
                          background: selectedSlotIndex === idx ? "#eff6ff" : "#ffffff",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: "0.78rem", color: selectedSlotIndex === idx ? "var(--primary)" : "var(--text-main)" }}>
                          {slot.time}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                          {slot.day}
                        </div>
                        {selectedSlotIndex === idx && (
                          <div style={{ fontSize: "0.65rem", color: "var(--primary)", fontWeight: 700, marginTop: "1px" }}>
                            ✓ Confirmed
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: "0.7rem", color: "#065f46", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "0.35rem 0.6rem", borderRadius: "6px", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Lock size={12} />
                    <span>Row-level locking guarantees zero double-bookings.</span>
                  </div>
                </div>
              )}

              {/* TAB 3: Live Interactive Feed / Social Preview */}
              {activeFeatureTab === "network" && (
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "0.75rem", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#e0e7ff", color: "#4338ca", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.75rem" }}>
                      ER
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>Elena Rostova</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Recruiter @ CloudScale Systems • Verified</div>
                    </div>
                  </div>

                  <p style={{ fontSize: "0.75rem", color: "var(--text-main)", margin: "0.25rem 0 0.5rem 0", lineHeight: 1.35 }}>
                    "Hiring new graduates! Our ATS scans your profile resume automatically."
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <button
                      type="button"
                      onClick={() => setMockLiked(!mockLiked)}
                      className="btn btn-sm"
                      style={{
                        background: mockLiked ? "#fee2e2" : "#ffffff",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.72rem",
                        color: mockLiked ? "#dc2626" : "var(--text-muted)",
                        padding: "0.2rem 0.5rem"
                      }}
                    >
                      <ThumbsUp size={11} /> {mockLiked ? "Liked (15)" : "Like (14)"}
                    </button>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                      • Direct chat with verified connections
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick-Fill Demo Personas Bar */}
            <div className="card auth-card-glass" style={{
              padding: "0.55rem 0.85rem",
              marginBottom: "0.65rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.03em" }}>
                  ⚡ 1-CLICK DEMO ACCOUNTS:
                </span>
                {quickFillMsg && (
                  <span style={{ fontSize: "0.68rem", color: "#16a34a", fontWeight: 700 }}>
                    ✓ {quickFillMsg}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                <button
                  type="button"
                  onClick={() => handleQuickFill("student@university.edu", "student123", "Student")}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: "0.72rem", padding: "0.22rem 0.55rem", background: "rgba(255, 255, 255, 0.9)" }}
                  title="Fill student demo credentials"
                >
                  🎓 Student
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill("recruiter@techcorp.com", "recruiter123", "Recruiter")}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: "0.72rem", padding: "0.22rem 0.55rem", background: "rgba(255, 255, 255, 0.9)" }}
                  title="Fill recruiter demo credentials"
                >
                  👔 Recruiter
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill("admin@recruit.com", "admin123", "Admin")}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: "0.72rem", padding: "0.22rem 0.55rem", background: "rgba(255, 255, 255, 0.9)" }}
                  title="Fill administrator demo credentials"
                >
                  🛡️ Admin
                </button>
              </div>
            </div>

            {/* Platform Performance Metric Badges */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
              <div className="card auth-card-glass" style={{ padding: "0.45rem 0.4rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>94%</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "1px", fontWeight: 600 }}>ATS Precision</div>
              </div>
              <div className="card auth-card-glass" style={{ padding: "0.45rem 0.4rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#10b981" }}>&lt; 40ms</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "1px", fontWeight: 600 }}>Async Dispatch</div>
              </div>
              <div className="card auth-card-glass" style={{ padding: "0.45rem 0.4rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f59e0b" }}>100%</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "1px", fontWeight: 600 }}>Zero-Trust PII</div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: The Auth Card */}
          <div style={{ maxWidth: "410px", margin: "0 auto", width: "100%" }}>
            {renderAuthForm()}
          </div>
        </div>
      </div>
    </div>
  );
};
