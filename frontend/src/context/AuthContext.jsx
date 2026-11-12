import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest, setAuthToken, getAuthToken, UNAUTHORIZED_EVENT } from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");

  const clearSession = useCallback(() => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const startSession = (data) => {
    setSessionMessage("");
    setAuthToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user);
  };

  const fetchCurrentUser = useCallback(async () => {
    try {
      if (getAuthToken()) {
        setUser(await apiRequest("/api/auth/me"));
      } else {
        setUser(null);
      }
    } catch (err) {
      // Only an auth failure ends the session; a network blip must not log the user out.
      if (err.status === 401 || err.status === 403) {
        clearSession();
      }
      console.warn("Session check failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    fetchCurrentUser();
  }, [token, fetchCurrentUser]);

  // Any API call that comes back 401 (expired/invalid token) signs the user out everywhere.
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setSessionMessage("Your session has expired. Please sign in again.");
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [clearSession]);

  // Proactively sign out when the token's own expiry passes.
  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => {
      if (!getAuthToken()) {
        clearSession();
        setSessionMessage("Your session has expired. Please sign in again.");
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [token, clearSession]);

  const login = async (email, password) => {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    startSession(data);
    return data.user;
  };

  const register = async (userData) => {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
    if (data.user?.is_email_verified) {
      startSession(data);
    }
    return data;
  };

  const verifyEmail = async (email, code) => {
    const data = await apiRequest("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    startSession(data);
    return data;
  };

  const resendVerification = async (email) => {
    return await apiRequest("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };

  const logout = () => {
    setSessionMessage("");
    clearSession();
  };

  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        sessionMessage,
        login,
        register,
        verifyEmail,
        resendVerification,
        logout,
        hasRole,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
