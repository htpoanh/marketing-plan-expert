import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    username: null,
    isLoading: true,
  });

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json() as { isAuthenticated: boolean; username: string };
          setState({ isAuthenticated: data.isAuthenticated, username: data.username, isLoading: false });
        } else {
          setState({ isAuthenticated: false, username: null, isLoading: false });
        }
      })
      .catch(() => {
        setState({ isAuthenticated: false, username: null, isLoading: false });
      });
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json() as { success: boolean; username: string };
        setState({ isAuthenticated: true, username: data.username, isLoading: false });
        return { success: true };
      } else {
        const data = await res.json() as { error: string };
        return { success: false, error: data.error };
      }
    } catch {
      return { success: false, error: "Không thể kết nối đến máy chủ." };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setState({ isAuthenticated: false, username: null, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
