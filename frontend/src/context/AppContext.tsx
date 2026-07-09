import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";
import {
  DEMO_LOCATION,
  requestLocationPermission,
  getCurrentLocation,
} from "@/src/services/locationService";
import { createPing, dismissPing as dismissPingApi } from "@/src/services/pingService";

export type NearbyUser = {
  id: string;
  name: string;
  age: number;
  bio: string;
  photo_url: string | null;
  interests: string[];
  vibe: string | null;
  distance: number;
  bearing: number;
  lat: number;
  lng: number;
  compatible: boolean;
  verified: boolean;
  active_now: boolean;
  intent?: string | null;
  context?: string | null;
  tags?: string[];
  vibe_details?: Record<string, any>;
  availability?: string | null;
  intent_strength?: string | null;
  event_name?: string | null;
  mutual_reason?: string | null;
  score?: number;
};

export type Vibe = {
  key: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  ping_title: string | null;
  action: string | null;
};

export type Ping = {
  id: string;
  status: string;
  vibe: string;
  title: string;
  distance: number;
  created_at: string;
  user: { id: string; name: string; age: number; photo_url: string | null; vibe: string; bio: string };
};

type PermState = "unknown" | "granted" | "denied" | "fallback";

type AppValue = {
  coords: { lat: number; lng: number } | null;
  permission: PermState;
  nearby: NearbyUser[];
  vibes: Vibe[];
  vibeMap: Record<string, Vibe>;
  requestLocation: () => Promise<void>;
  refresh: () => Promise<void>;
  activePing: Ping | null;
  dismissActivePing: (alsoDismissOnServer?: boolean) => void;
  findUser: (id: string) => NearbyUser | undefined;
  visibilityEnded: boolean;
};

const AppContext = createContext<AppValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { token, user, setUser } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permission, setPermission] = useState<PermState>("unknown");
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [activePing, setActivePing] = useState<Ping | null>(null);
  const [visibilityEnded, setVisibilityEnded] = useState(false);
  const nearbyPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  // visibility session timer — turn invisible when the session expires
  useEffect(() => {
    if (!token || !user?.visible) return;
    const check = async () => {
      const exp = user.visibility_expires_at;
      if (exp && new Date(exp).getTime() <= Date.now()) {
        try {
          const updated = await api("/users/me/state", {
            method: "PUT",
            body: { visible: false },
          });
          setUser(updated as any);
          setVisibilityEnded(true);
        } catch {}
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.visible, user?.visibility_expires_at]);

  useEffect(() => {
    if (user?.visible) setVisibilityEnded(false);
  }, [user?.visible]);

  const vibeMap = vibes.reduce((acc, v) => {
    acc[v.key] = v;
    return acc;
  }, {} as Record<string, Vibe>);

  useEffect(() => {
    api<Vibe[]>("/vibes", { token: null }).then(setVibes).catch(() => {});
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      const perm = await requestLocationPermission();
      if (perm.granted) {
        const pos = await getCurrentLocation();
        setCoords(pos);
        setPermission("granted");
        return;
      }
      setCoords(DEMO_LOCATION);
      setPermission("denied");
    } catch {
      setCoords(DEMO_LOCATION);
      setPermission("fallback");
    }
  }, []);

  const visibleAndActive =
    !!user?.visible && !user?.ghost_mode && !user?.paused;

  const refresh = useCallback(async () => {
    if (!token || !coords || !visibleAndActive) {
      setNearby([]);
      return;
    }
    try {
      const res = await api<{ users: NearbyUser[] }>(
        `/nearby?lat=${coords.lat}&lng=${coords.lng}`
      );
      setNearby(res.users);
    } catch {}
  }, [token, coords, visibleAndActive, user?.radius, user?.vibe, user?.only_same_vibe, user?.verified_only]);

  // push location to backend when it changes
  useEffect(() => {
    if (token && coords) {
      api("/users/me/state", { method: "PUT", body: { lat: coords.lat, lng: coords.lng } })
        .then(() => refresh())
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // poll nearby every 8s
  useEffect(() => {
    if (nearbyPoll.current) clearInterval(nearbyPoll.current);
    if (token && coords && visibleAndActive) {
      nearbyPoll.current = setInterval(() => refresh(), 8000);
    }
    return () => {
      if (nearbyPoll.current) clearInterval(nearbyPoll.current);
    };
  }, [token, coords, visibleAndActive, refresh]);

  // demo ping generator every 20s — quiet mode & busy users never get pinged
  useEffect(() => {
    if (pingPoll.current) clearInterval(pingPoll.current);
    const canPing =
      token && coords && visibleAndActive && !user?.quiet_mode && user?.vibe && user.vibe !== "busy";
    if (canPing) {
      const tick = async () => {
        try {
          const res = await createPing(coords!);
          if (res.ping) {
            setActivePing((prev) => prev || res.ping);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
          }
        } catch {}
      };
      pingPoll.current = setInterval(tick, 20000);
      // first ping arrives quickly in demo mode
      const t = setTimeout(tick, 4000);
      return () => {
        clearTimeout(t);
        if (pingPoll.current) clearInterval(pingPoll.current);
      };
    }
    return () => {
      if (pingPoll.current) clearInterval(pingPoll.current);
    };
  }, [token, coords, visibleAndActive, user?.vibe, user?.radius, user?.quiet_mode]);

  const dismissActivePing = useCallback(
    (alsoDismissOnServer = false) => {
      if (alsoDismissOnServer && activePing) {
        dismissPingApi(activePing.id).catch(() => {});
      }
      setActivePing(null);
    },
    [activePing]
  );

  const findUser = useCallback(
    (id: string) => nearby.find((n) => n.id === id),
    [nearby]
  );

  return (
    <AppContext.Provider
      value={{
        coords,
        permission,
        nearby,
        vibes,
        vibeMap,
        requestLocation,
        refresh,
        activePing,
        dismissActivePing,
        findUser,
        visibilityEnded,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
