import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchMe, login as apiLogin, register as apiRegister } from "@/lib/api";
import type { AuthUser } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      try {
        const raw = localStorage.getItem("auth_user");
        setUser(raw ? (JSON.parse(raw) as AuthUser) : null);
      } catch {
        setUser(null);
      }
      setLoading(false);
      return;
    }
    const me = await fetchMe();
    if (!me) {
      try {
        const raw = localStorage.getItem("auth_user");
        setUser(raw ? (JSON.parse(raw) as AuthUser) : null);
      } catch {
        setUser(null);
      }
    } else {
      setUser(me);
      localStorage.setItem("auth_user", JSON.stringify(me));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const persist = (payload: { access: string; refresh: string; user: AuthUser }) => {
    localStorage.setItem("access_token", payload.access);
    localStorage.setItem("refresh_token", payload.refresh);
    localStorage.setItem("auth_user", JSON.stringify(payload.user));
    setUser(payload.user);
  };

  const signIn = useCallback(async (identifier: string, password: string) => {
    const payload = await apiLogin({ username: identifier, password });
    persist(payload);
  }, []);

  const signUp = useCallback(async (username: string, email: string, password: string) => {
    const payload = await apiRegister({ username, email, password });
    persist(payload);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_user");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refreshUser }),
    [user, loading, signIn, signUp, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
