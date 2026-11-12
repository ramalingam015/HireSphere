import React from "react";
import { useAuth } from "../context/AuthContext";
import { 
  Briefcase, Users, MessageSquare, Shield, User, LogOut, 
  CheckCircle2, Clock, AlertTriangle 
} from "lucide-react";

export const Navbar = ({ currentTab, setCurrentTab, onOpenChatWith, onOpenComplaints }) => {
  const { user, logout } = useAuth();
  const isAuthPage = currentTab === "login" || currentTab === "register";

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <button 
            onClick={() => {
              if (user?.role === "recruiter") setCurrentTab("recruiter_dashboard");
              else if (user?.role === "admin") setCurrentTab("admin");
              else if (user?.role === "candidate") setCurrentTab("jobs");
            }} 
            className="brand-logo"
            style={{ textAlign: "left" }}
          >
            <Briefcase size={26} />
            <span>HireSphere</span>
          </button>

          {/* Navigation Links ONLY shown when user is logged in (hidden on sign-in / register pages) */}
          {user && !isAuthPage && (
            <nav className="nav-links">
              {/* Candidate-only Jobs & ATS tab (Candidate dashboard already includes Applications tab inside) */}
              {user.role === "candidate" && (
                <button 
                  className={`nav-item ${currentTab === "jobs" || currentTab === "applications" ? "active" : ""}`}
                  onClick={() => setCurrentTab("jobs")}
                >
                  <Briefcase size={16} />
                  <span>Jobs & ATS</span>
                </button>
              )}

              {user.role === "recruiter" && (
                <button 
                  className={`nav-item ${currentTab === "recruiter_dashboard" ? "active" : ""}`}
                  onClick={() => setCurrentTab("recruiter_dashboard")}
                >
                  <Briefcase size={16} />
                  <span>Recruiter Hub</span>
                </button>
              )}

              {user.role === "admin" && (
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
          )}
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

              {onOpenComplaints && user?.role !== "admin" && (
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={onOpenComplaints}
                  title="Submit a complaint, suggestion, or report spam"
                  style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <MessageSquare size={13} />
                  <span>Complaints & Suggestions</span>
                </button>
              )}

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
