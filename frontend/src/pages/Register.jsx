import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Briefcase, AlertCircle } from "lucide-react";

export const Register = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("candidate"); // candidate, recruiter, admin
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register({
        full_name: fullName,
        email,
        password,
        role,
        company: role === "recruiter" ? company : "",
      });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

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
            {loading ? "Creating Account..." : "Create Account"}
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
