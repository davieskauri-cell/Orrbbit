import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/lib/api";
import { setSessionToken } from "@/src/lib/session";

const TOKEN_KEY = "auth_token";

export type User = {
  id: string;
  email: string;
  name: string | null;
  age: number | null;
  bio: string;
  photo_url: string | null;
  photos: string[];
  interests: string[];
  vibe: string | null;
  visible: boolean;
  radius: number;
  ghost_mode: boolean;
  paused: boolean;
  quiet_mode: boolean;
  only_same_vibe: boolean;
  verified_only: boolean;
  who_can_see: string;
  visible_for: number;
  visibility_expires_at: string | null;
  verified: boolean;
  active_now: boolean;
  trial_mode_active: boolean;
  event_active: boolean;
  mode: string;
  intent?: string | null;
  vibe_details?: Record<string, any>;
  show_recruiters?: boolean;
  mutual_only?: boolean;
  event_code?: string | null;
  event_name?: string | null;
  plan: string;
  max_radius: number;
  radius_options: number[];
  radius_migration_notice?: boolean;
  city: string;
  country: string;
  ambassador: boolean;
  is_demo: boolean;
  high_density_demo?: boolean;
  app_mode?: string;
  people_min_age?: number;
  people_max_age?: number;
  people_allow_age_expansion?: boolean;
  relationship_age_prompt_seen?: boolean;
  home_city?: string | null;
  occupation?: string | null;
  education?: string | null;
  languages?: string | null;
  prompts?: { prompt: string; answer: string }[];
  email_verified?: boolean;
  photo_verified?: boolean;
  joined?: string;
  people_discoverable?: boolean;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name: string;
  date_of_birth: string; // YYYY-MM-DD
  accept_policies: boolean;
  marketing_opt_in: boolean;
  platform?: string;
  app_version?: string;
  locale?: string;
  bio?: string;
  interests?: string[];
  photo_url?: string | null;
};

type AuthValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  demoLogin: (email?: string) => Promise<User>;
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
          setSessionToken(saved);
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
    setSessionToken(t);
    setToken(t);
    setUser(u);
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await persist(res.access_token, res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await api<{ access_token: string; user: User }>("/auth/register", {
      method: "POST",
      body: payload,
    });
    await persist(res.access_token, res.user);
    return res.user;
  }, []);

  const demoLogin = useCallback(async (email?: string) => {
    const res = await api<{ access_token: string; user: User }>("/auth/demo-login", {
      method: "POST",
      body: email ? { email } : {},
    });
    await persist(res.access_token, res.user);
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setSessionToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const me = await api<User>("/auth/me", { token });
    setUser(me);
    return me;
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ token, user, loading, signIn, register, demoLogin, signOut, setUser, refreshUser }}
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
