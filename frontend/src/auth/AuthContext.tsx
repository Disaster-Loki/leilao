import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type { Role, User } from "../types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; password: string; role: Role }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const finish = (res: { user: User; token: string }) => {
    localStorage.setItem("token", res.token);
    setUser(res.user);
    return res.user;
  };

  const login = useCallback(
    async (email: string, password: string) =>
      finish(
        await api<{ user: User; token: string }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
      ),
    []
  );

  const register = useCallback(
    async (data: { name: string; email: string; password: string; role: Role }) =>
      finish(
        await api<{ user: User; token: string }>("/auth/register", {
          method: "POST",
          body: JSON.stringify(data),
        })
      ),
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
