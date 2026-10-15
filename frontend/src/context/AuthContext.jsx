import React, { createContext, useContext, useState, useEffect } from "react";
import { apiRequest, setAuthToken, getAuthToken } from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      if (getAuthToken()) {
        const userData = await apiRequest("/api/auth/me");
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn("Session check failed:", err.message);
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, [token]);

  const login = async (email, password) => {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
    if (data.user?.is_email_verified) {
      setAuthToken(data.access_token);
      setTokenState(data.access_token);
      setUser(data.user);
    }
    return data;
  };

  const verifyEmail = async (email, code) => {
    const data = await apiRequest("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    setAuthToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user);
    return data;
  };

  const resendVerification = async (email) => {
    return await apiRequest("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const loginAsDemo = async (role) => {
    if (role === "admin") {
      return login("admin@recruit.com", "admin123");
    } else if (role === "recruiter") {
      return login("recruiter@techcorp.com", "recruiter123");
    } else if (role === "pending_recruiter") {
      return login("pending@startup.io", "pending123");
    } else {
      return login("student@university.edu", "student123");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        verifyEmail,
        resendVerification,
        logout,
        loginAsDemo,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
