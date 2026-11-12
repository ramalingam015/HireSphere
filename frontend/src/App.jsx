import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { CandidateDashboard } from "./pages/CandidateDashboard";
import { RecruiterDashboard } from "./pages/RecruiterDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { NetworkPage } from "./pages/NetworkPage";
import { ProfilePage } from "./pages/ProfilePage";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ChatDrawer } from "./components/ChatDrawer";
import { EmailConfigModal } from "./components/EmailConfigModal";
import { ComplaintsModal } from "./components/ComplaintsModal";

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState("jobs");
  const [authMode, setAuthMode] = useState("login");
  const [chatTargetUser, setChatTargetUser] = useState(null);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const [emailConfigInitialEmail, setEmailConfigInitialEmail] = useState("");

  // Role-based tab isolation: Recruiters and Admins must NEVER see candidate Jobs/ATS
  useEffect(() => {
    if (user?.role === "recruiter") {
      if (currentTab === "jobs" || currentTab === "applications" || currentTab === "admin") {
        setCurrentTab("recruiter_dashboard");
      }
    } else if (user?.role === "admin") {
      if (currentTab === "jobs" || currentTab === "applications" || currentTab === "recruiter_dashboard") {
        setCurrentTab("admin");
      }
    } else if (user?.role === "candidate") {
      if (currentTab === "recruiter_dashboard" || currentTab === "admin") {
        setCurrentTab("jobs");
      }
    }
  }, [user?.role]);

  const handleOpenEmailConfig = (email = "") => {
    setEmailConfigInitialEmail(email);
    setShowEmailConfig(true);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", color: "var(--text-muted)"
      }}>
        Loading HireSphere...
      </div>
    );
  }

  // Not logged in view (Guest on Sign In / Register page)
  if (!user) {
    return (
      <div className="app-container">
        <Navbar 
          currentTab={authMode} 
          setCurrentTab={setCurrentTab} 
          onOpenChatWith={setChatTargetUser} 
          onOpenEmailConfig={() => handleOpenEmailConfig("")}
        />
        <main className="main-content">
          {authMode === "login" ? (
            <Login 
              onSwitchToRegister={() => setAuthMode("register")} 
              onOpenEmailConfig={handleOpenEmailConfig}
            />
          ) : (
            <Register 
              onSwitchToLogin={() => setAuthMode("login")} 
              onOpenEmailConfig={handleOpenEmailConfig}
            />
          )}
        </main>

        {showEmailConfig && (
          <EmailConfigModal 
            initialEmail={emailConfigInitialEmail} 
            onClose={() => setShowEmailConfig(false)} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        onOpenChatWith={setChatTargetUser} 
        onOpenEmailConfig={() => handleOpenEmailConfig(user?.email || "")}
        onOpenComplaints={() => setShowComplaintsModal(true)}
      />

      <main className="main-content">
        {/* Candidates ONLY: Jobs & ATS interface (includes Applications tab inside) */}
        {(currentTab === "jobs" || currentTab === "applications") && user?.role === "candidate" && (
          <CandidateDashboard 
            onOpenChatWith={setChatTargetUser} 
            activeSubTab={currentTab === "applications" ? "applications" : "jobs"} 
          />
        )}

        {/* Recruiters Hub */}
        {currentTab === "recruiter_dashboard" && (user?.role === "recruiter" || user?.role === "admin") && (
          <RecruiterDashboard 
            onOpenChatWith={setChatTargetUser} 
          />
        )}

        {/* Admin Console */}
        {currentTab === "admin" && user?.role === "admin" && (
          <AdminDashboard />
        )}

        {currentTab === "network" && (
          <NetworkPage 
            onOpenChatWith={setChatTargetUser} 
          />
        )}

        {currentTab === "profile" && (
          <ProfilePage />
        )}
      </main>

      {/* Floating 1-on-1 Chat Drawer (FR-NET-02/03 & outside interview link) */}
      {chatTargetUser && (
        <ChatDrawer 
          targetUser={chatTargetUser} 
          onClose={() => setChatTargetUser(null)} 
        />
      )}

      {/* Email Service Configuration Modal */}
      {showEmailConfig && (
        <EmailConfigModal 
          initialEmail={emailConfigInitialEmail || user?.email || ""} 
          onClose={() => setShowEmailConfig(false)} 
        />
      )}

      {/* Complaints, Suggestions & Spam Reports Modal */}
      {showComplaintsModal && (
        <ComplaintsModal 
          onClose={() => setShowComplaintsModal(false)} 
        />
      )}
    </div>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
