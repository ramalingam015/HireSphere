import React from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBase, setApiBase } from "../api/client";
import { 
  Briefcase, Users, MessageSquare, Shield, User, LogOut, 
  Sparkles, CheckCircle2, Clock, AlertTriangle 
} from "lucide-react";

export const Navbar = ({ currentTab, setCurrentTab, onOpenChatWith }) => {
  const { user, logout, loginAsDemo } = useAuth();

  return (
    <header className="navbar">
      {/* Demo Switcher Quick Bar */}
      <div className="demo-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sparkles size={14} style={{ color: "#38bdf8" }} />
          <span>CS455 Deliverable 1 - Quick Role Switcher:</span>
        </div>
        <div className="demo-buttons">
          <button 
            className="btn-demo" 
            onClick={() => loginAsDemo("candidate")}
            title="Switch to Student / Candidate account"
          >
            🎓 Student (Alex Rivera)
          </button>
          <button 
            className="btn-demo" 
            onClick={() => loginAsDemo("recruiter")}
            title="Switch to Approved Recruiter account"
          >
            👔 Recruiter (CloudScale Systems)
          </button>
          <button 
            className="btn-demo" 
            onClick={() => loginAsDemo("pending_recruiter")}
            title="Switch to Pending Recruiter account (tests Admin approval flow)"
          >
            ⏳ Pending Recruiter
          </button>
          <button 
            className="btn-demo" 
            onClick={() => loginAsDemo("admin")}
            title="Switch to Admin account"
          >
            🛡️ Admin Portal
          </button>
          <button 
            className="btn-demo" 
            onClick={() => {
              const current = getApiBase();
              const next = window.prompt("Enter your Backend API URL (e.g. https://hiresphere.onrender.com or http://localhost:8000). Leave blank for same-origin / demo fallback:", current || "");
              if (next !== null) {
                setApiBase(next);
                window.location.reload();
              }
            }}
            title="Configure backend server URL for GitHub Pages"
            style={{ background: "#0369a1", borderColor: "#0284c7" }}
          >
            ⚙️ Backend: {getApiBase() ? "Custom API" : "Auto / Demo"}
          </button>
        </div>
      </div>

      <div className="navbar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <button 
            onClick={() => setCurrentTab("jobs")} 
            className="brand-logo"
            style={{ textAlign: "left" }}
          >
            <Briefcase size={26} />
            <span>HireSphere</span>
          </button>

          <nav className="nav-links">
            <button 
              className={`nav-item ${currentTab === "jobs" ? "active" : ""}`}
              onClick={() => setCurrentTab("jobs")}
            >
              <Briefcase size={16} />
              <span>Jobs & ATS</span>
            </button>

            {user?.role === "candidate" && (
              <button 
                className={`nav-item ${currentTab === "applications" ? "active" : ""}`}
                onClick={() => setCurrentTab("applications")}
              >
                <CheckCircle2 size={16} />
                <span>My Applications</span>
              </button>
            )}

            {(user?.role === "recruiter" || user?.role === "admin") && (
              <button 
                className={`nav-item ${currentTab === "recruiter_dashboard" ? "active" : ""}`}
                onClick={() => setCurrentTab("recruiter_dashboard")}
              >
                <Briefcase size={16} />
                <span>Recruiter Hub</span>
              </button>
            )}

            {user?.role === "admin" && (
              <button 
                className={`nav-item ${currentTab === "admin" ? "active" : ""}`}
                onClick={() => setCurrentTab("admin")}
              >
                <Shield size={16} />
                <span>Admin Console</span>
              </button>
            )}

            <button 
              className={`nav-item ${currentTab === "network" ? "active" : ""}`}
              onClick={() => setCurrentTab("network")}
            >
              <Users size={16} />
              <span>Network & Feed</span>
            </button>
          </nav>
        </div>

        {/* User Info & Role */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {user ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span className={`nav-role-badge badge-${user.role}`}>
                  {user.role}
                </span>

                {user.role === "recruiter" && user.recruiter_status === "pending" && (
                  <span className="status-pill status-in-review" title="Approval pending from Admin">
                    <Clock size={12} /> Pending Approval
                  </span>
                )}
                {user.role === "recruiter" && user.recruiter_status === "suspended" && (
                  <span className="status-pill status-rejected" title="Recruiter account suspended">
                    <AlertTriangle size={12} /> Suspended
                  </span>
                )}

                <button 
                  onClick={() => setCurrentTab("profile")}
                  style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}
                  title="View / Edit Profile"
                >
                  {user.full_name}
                </button>
              </div>

              <button 
                className="btn btn-secondary btn-sm"
                onClick={logout}
                title="Sign out"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => setCurrentTab("login")}
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
