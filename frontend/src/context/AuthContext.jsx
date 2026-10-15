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
    setAuthToken(data.access_token);
    setTokenState(data.access_token);
    setUser(data.user);
    return data.user;
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
