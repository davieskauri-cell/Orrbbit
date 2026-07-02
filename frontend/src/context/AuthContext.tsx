import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/lib/api";

const TOKEN_KEY = "auth_token";

export type User = {
  id: string;
  email: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  status: string | null;
  visible: boolean;
  radius: number;
};

type AuthValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    display_name: string;
    bio?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await storage.secureGet(TOKEN_KEY, null);
      if (saved && typeof saved === "string") {
        try {
          const me = await api<User>("/auth/me", { token: saved });
          setToken(saved);
          setUser(me);
        } catch {
          await storage.secureRemove(TOKEN_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  const persist = async (t: string, u: User) => {
    await storage.secureSet(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await persist(res.access_token, res.user);
  }, []);

  const register = useCallback(
    async (payload: { email: string; password: string; display_name: string; bio?: string }) => {
      const res = await api<{ access_token: string; user: User }>("/auth/register", {
        method: "POST",
        body: payload,
      });
      await persist(res.access_token, res.user);
    },
    []
  );

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const me = await api<User>("/auth/me", { token });
    setUser(me);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ token, user, loading, signIn, register, signOut, setUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
