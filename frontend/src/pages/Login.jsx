import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Briefcase, Sparkles, AlertCircle } from "lucide-react";

export const Login = ({ onSwitchToRegister }) => {
  const { login, loginAsDemo } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

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
