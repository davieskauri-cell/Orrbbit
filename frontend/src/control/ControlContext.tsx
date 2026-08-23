import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/control`;

// Deployment environment — preview builds point at *.preview.emergentagent.com.
// In LIVE PRODUCTION the Control Centre must always boot in LIVE data mode;
// demo data is opt-in per session and never silently restored on boot.
const IS_PREVIEW_ENV = String(process.env.EXPO_PUBLIC_BACKEND_URL || '').includes('preview');

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  must_change_password: boolean;
  last_login_at?: string | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Ctx = {
  admin: AdminUser | null;
  token: string | null;
  mode: 'live' | 'demo';
  booting: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  reauth: (password: string) => Promise<void>;
  setMode: (m: 'live' | 'demo') => void;
  req: (path: string, opts?: RequestInit) => Promise<any>;
  download: (path: string, filename: string) => Promise<void>;
};

const ControlCtx = createContext<Ctx | null>(null);

export function ControlProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mode, setModeState] = useState<'live' | 'demo'>(IS_PREVIEW_ENV ? 'demo' : 'live');
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, a, m] = await Promise.all([
          AsyncStorage.getItem('cc_token'),
          AsyncStorage.getItem('cc_admin'),
          AsyncStorage.getItem('cc_mode'),
        ]);
        if (t && a) {
          setToken(t);
          setAdmin(JSON.parse(a));
        }
        // Only Preview restores a stored data mode. Production always boots LIVE
        // so real users/KPIs are never silently replaced by demo data.
        if (IS_PREVIEW_ENV && (m === 'live' || m === 'demo')) setModeState(m);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    const t = token;
    setToken(null);
    setAdmin(null);
    await AsyncStorage.multiRemove(['cc_token', 'cc_admin']);
    if (t) {
      fetch(`${BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    }
  }, [token]);

  const rawReq = useCallback(
    async (path: string, opts: RequestInit = {}, tok?: string | null, m?: string) => {
      const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
          'X-Admin-Mode': m || mode,
          ...(opts.headers || {}),
        },
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {}
      if (!res.ok) {
        if (res.status === 401 && tok) logout();
        throw new ApiError(res.status, data?.detail || `Request failed (${res.status})`);
      }
      return data;
    },
    [mode, logout]
  );

  const req = useCallback((path: string, opts: RequestInit = {}) => rawReq(path, opts, token), [rawReq, token]);

  const login = useCallback(
    async (email: string, password: string) => {
      const d = await rawReq('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, null);
      setToken(d.token);
      setAdmin(d.admin);
      await AsyncStorage.multiSet([
        ['cc_token', d.token],
        ['cc_admin', JSON.stringify(d.admin)],
      ]);
      return d.admin as AdminUser;
    },
    [rawReq]
  );

  const changePassword = useCallback(
    async (current: string, next: string) => {
      const d = await rawReq(
        '/auth/change-password',
        { method: 'POST', body: JSON.stringify({ current_password: current, new_password: next }) },
        token
      );
      setToken(d.token);
      setAdmin(d.admin);
      await AsyncStorage.multiSet([
        ['cc_token', d.token],
        ['cc_admin', JSON.stringify(d.admin)],
      ]);
    },
    [rawReq, token]
  );

  const reauth = useCallback(
    async (password: string) => {
      await rawReq('/auth/reauth', { method: 'POST', body: JSON.stringify({ password }) }, token);
    },
    [rawReq, token]
  );

  const setMode = useCallback((m: 'live' | 'demo') => {
    setModeState(m);
    AsyncStorage.setItem('cc_mode', m);
  }, []);

  const download = useCallback(
    async (path: string, filename: string) => {
      const res = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Admin-Mode': mode },
      });
      if (!res.ok) throw new ApiError(res.status, 'Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [token, mode]
  );

  const value = useMemo(
    () => ({ admin, token, mode, booting, login, logout, changePassword, reauth, setMode, req, download }),
    [admin, token, mode, booting, login, logout, changePassword, reauth, setMode, req, download]
  );

  return <ControlCtx.Provider value={value}>{children}</ControlCtx.Provider>;
}

export function useCC() {
  const ctx = useContext(ControlCtx);
  if (!ctx) throw new Error('useCC must be used within ControlProvider');
  return ctx;
}
