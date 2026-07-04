import { api } from "@/src/lib/api";
import type { RegisterPayload } from "@/src/context/AuthContext";

export const signUp = (payload: RegisterPayload) =>
  api("/auth/register", { method: "POST", body: payload });

export const login = (email: string, password: string) =>
  api("/auth/login", { method: "POST", body: { email, password } });

export const demoLogin = (email?: string) =>
  api("/auth/demo-login", { method: "POST", body: email ? { email } : {} });

export const logout = () => Promise.resolve();
