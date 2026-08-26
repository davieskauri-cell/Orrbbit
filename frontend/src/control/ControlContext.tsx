import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The Control Centre can be pointed at a different backend than the product app
// (owner choice: browser-based admin over LIVE production data). Falls back to the
// standard app backend when the override is not set.
const CONTROL_BACKEND = process.env.EXPO_PUBLIC_CONTROL_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
const BASE = `${CONTROL_BACKEND}/api/control`;

// Deployment environment — preview backends live on *.preview.emergentagent.com.
// In LIVE PRODUCTION the Control Centre must always boot in LIVE data mode;
// demo data is opt-in per session and never silently restored on boot.
const IS_PREVIEW_ENV = String(CONTROL_BACKEND || '').includes('preview');

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
  /** Message shown on the login screen after a forced logout (e.g. expired session). */
  sessionNotice: string | null;
  /** true = last authenticated API call succeeded; false = backend unreachable; null = not yet known. */
  backendOk: boolean | null;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: (notice?: string) => Promise<void>;
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
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, a, m, n] = await Promise.all([
          AsyncStorage.getItem('cc_token'),
          AsyncStorage.getItem('cc_admin'),
          AsyncStorage.getItem('cc_mode'),
          AsyncStorage.getItem('cc_notice'),
        ]);
        if (t && a) {
          setToken(t);
          setAdmin(JSON.parse(a));
        }
        if (n) setSessionNotice(n);
        // Only Preview restores a stored data mode. Production always boots LIVE
        // so real users/KPIs are never silently replaced by demo data.
        if (IS_PREVIEW_ENV && (m === 'live' || m === 'demo')) setModeState(m);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const logout = useCallback(async (notice?: string) => {
    const t = token;
    setToken(null);
    setAdmin(null);
    // Only a string counts — logout is also used directly as a press handler.
    // Persisted because the control layout can remount on redirect, which would
    // otherwise drop the in-memory notice before the login screen shows it.
    const msg = typeof notice === 'string' ? notice : null;
    setSessionNotice(msg);
    if (msg) await AsyncStorage.setItem('cc_notice', msg);
    else await AsyncStorage.removeItem('cc_notice');
    await AsyncStorage.multiRemove(['cc_token', 'cc_admin']);
    if (t) {
      fetch(`${BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    }
  }, [token]);

  const rawReq = useCallback(
    async (path: string, opts: RequestInit = {}, tok?: string | null, m?: string) => {
      let res: Response;
      try {
        res = await fetch(`${BASE}${path}`, {
          ...opts,
          headers: {
            'Content-Type': 'application/json',
            ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
            'X-Admin-Mode': m || mode,
            ...(opts.headers || {}),
          },
        });
      } catch {
        // Network-level failure: the backend is unreachable. Never render this as empty data.
        setBackendOk(false);
        throw new ApiError(0, 'Unable to reach the Orrbbit backend. Check your connection and retry.');
      }
      let data: any = null;
      try {
        data = await res.json();
      } catch {}
      if (!res.ok) {
        if (res.status === 401 && tok) {
          // Expired/invalid admin token: clear stale auth state and route to login with a clear message.
          logout('Your admin session has expired. Please log in again.');
          throw new ApiError(401, 'Your admin session has expired. Please log in again.');
        }
        const detail = data?.detail;
        throw new ApiError(res.status, typeof detail === 'string' ? detail : `Request failed (${res.status})`);
      }
      // Backend connectivity is only asserted from a successful authenticated response.
      if (tok) setBackendOk(true);
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
      setSessionNotice(null);
      AsyncStorage.removeItem('cc_notice');
      setBackendOk(true);
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
      let res: Response;
      try {
        res = await fetch(`${BASE}${path}`, {
          headers: { Authorization: `Bearer ${token}`, 'X-Admin-Mode': mode },
        });
      } catch {
        setBackendOk(false);
        throw new ApiError(0, 'Unable to reach the Orrbbit backend. Check your connection and retry.');
      }
      if (res.status === 401) {
        logout('Your admin session has expired. Please log in again.');
        throw new ApiError(401, 'Your admin session has expired. Please log in again.');
      }
      if (!res.ok) throw new ApiError(res.status, 'Download failed');
      setBackendOk(true);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [token, mode, logout]
  );

  const value = useMemo(
    () => ({ admin, token, mode, booting, sessionNotice, backendOk, login, logout, changePassword, reauth, setMode, req, download }),
    [admin, token, mode, booting, sessionNotice, backendOk, login, logout, changePassword, reauth, setMode, req, download]
  );

  return <ControlCtx.Provider value={value}>{children}</ControlCtx.Provider>;
}

export function useCC() {
  const ctx = useContext(ControlCtx);
  if (!ctx) throw new Error('useCC must be used within ControlProvider');
  return ctx;
}
