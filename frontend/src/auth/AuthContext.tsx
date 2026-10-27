import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type { Role, User } from "../types";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Se não há token, já não há nada para carregar (evita setState síncrono no efeito).
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("token")));

  useEffect(() => {
    if (!localStorage.getItem("token")) return;

    let cancelled = false;
    api<User>("/auth/me")
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) localStorage.removeItem("token");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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

  const updateProfile = useCallback(async (data: {
    name?: string;
    email?: string;
    newPassword?: string;
    currentPassword: string;
  }) => {
    const result = await api<{ user: User; token: string }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    localStorage.setItem("token", result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const deleteAccount = useCallback(async (currentPassword: string) => {
    await api<void>("/auth/me", {
      method: "DELETE",
      body: JSON.stringify({ currentPassword }),
    });
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, deleteAccount, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
