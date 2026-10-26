import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../types";

interface Props {
  role?: Role;
  children: ReactNode;
}

export default function Guard({ role, children }: Props) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center-msg">Carregando…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
