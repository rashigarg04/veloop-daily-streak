import { createContext, useContext, useEffect, useState } from "react";
import { registerRequest, loginRequest, getMeRequest } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("veloop_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await getMeRequest();
        setUser(data.user);
        setWallet(data.wallet);
      } catch {
        localStorage.removeItem("veloop_token");
        localStorage.removeItem("veloop_user");
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  function persistSession(data) {
    localStorage.setItem("veloop_token", data.token);
    localStorage.setItem("veloop_user", JSON.stringify(data.user));
    setUser(data.user);
    setWallet(data.wallet);
  }

  async function register(formValues) {
    const data = await registerRequest(formValues);
    persistSession(data);
    return data;
  }

  async function login(formValues) {
    const data = await loginRequest(formValues);
    persistSession(data);
    return data;
  }

  function logout() {
    localStorage.removeItem("veloop_token");
    localStorage.removeItem("veloop_user");
    setUser(null);
    setWallet(null);
  }

  const value = {
    user,
    wallet,
    setWallet,
    loading,
    isAuthenticated: Boolean(user),
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}