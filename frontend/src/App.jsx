import React, { useState } from "react";
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
import { resolveTab } from "./auth/access";
import { ComplaintsModal } from "./components/ComplaintsModal";

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState("jobs");
  const [authMode, setAuthMode] = useState("login");
  const [chatTargetUser, setChatTargetUser] = useState(null);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);

  // Role-based tab isolation, derived during render (no flash of a forbidden page):
  // recruiters/admins never see candidate tabs and vice versa. The backend enforces the same rules.
  const activeTab = user ? resolveTab(user.role, currentTab) : currentTab;

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

  // Not logged in view
  if (!user) {
    return (
      <div className="app-container">
        <Navbar 
          currentTab={authMode} 
          setCurrentTab={setCurrentTab} 
          onOpenChatWith={setChatTargetUser} 
        />
        <main className="main-content">
          {authMode === "login" ? (
            <Login 
              onSwitchToRegister={() => setAuthMode("register")} 
            />
          ) : (
            <Register 
              onSwitchToLogin={() => setAuthMode("login")} 
            />
          )}
        </main>

      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar 
        currentTab={activeTab} 
        setCurrentTab={setCurrentTab} 
        onOpenChatWith={setChatTargetUser} 
        onOpenComplaints={() => setShowComplaintsModal(true)}
      />

      <main className="main-content">
        {/* Candidates ONLY: Jobs & ATS interface */}
        {activeTab === "jobs" && user?.role === "candidate" && (
          <CandidateDashboard 
            onOpenChatWith={setChatTargetUser} 
            activeSubTab="jobs" 
          />
        )}

        {/* Candidates ONLY: My Applications */}
        {activeTab === "applications" && user?.role === "candidate" && (
          <CandidateDashboard 
            onOpenChatWith={setChatTargetUser} 
            activeSubTab="applications" 
          />
        )}

        {/* Recruiters Hub */}
        {activeTab === "recruiter_dashboard" && (user?.role === "recruiter" || user?.role === "admin") && (
          <RecruiterDashboard 
            onOpenChatWith={setChatTargetUser} 
          />
        )}

        {/* Admin Console */}
        {activeTab === "admin" && user?.role === "admin" && (
          <AdminDashboard />
        )}

        {activeTab === "network" && (
          <NetworkPage 
            onOpenChatWith={setChatTargetUser} 
          />
        )}

        {activeTab === "profile" && (
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
