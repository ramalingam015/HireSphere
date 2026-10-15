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

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState("jobs");
  const [authMode, setAuthMode] = useState("login");
  const [chatTargetUser, setChatTargetUser] = useState(null);

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
        <Navbar currentTab={authMode} setCurrentTab={setCurrentTab} onOpenChatWith={setChatTargetUser} />
        <main className="main-content">
          {authMode === "login" ? (
            <Login onSwitchToRegister={() => setAuthMode("register")} />
          ) : (
            <Register onSwitchToLogin={() => setAuthMode("login")} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        onOpenChatWith={setChatTargetUser} 
      />

      <main className="main-content">
        {currentTab === "jobs" && (
          <CandidateDashboard 
            onOpenChatWith={setChatTargetUser} 
            activeSubTab="jobs" 
          />
        )}

        {currentTab === "applications" && (
          <CandidateDashboard 
            onOpenChatWith={setChatTargetUser} 
            activeSubTab="applications" 
          />
        )}

        {currentTab === "recruiter_dashboard" && (
          <RecruiterDashboard 
            onOpenChatWith={setChatTargetUser} 
          />
        )}

        {currentTab === "admin" && (
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
