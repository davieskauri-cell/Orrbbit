import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/context/AuthContext";

// Melbourne fallback so the demo always shows nearby people
const FALLBACK = { lat: -37.8136, lng: 144.9631 };

export type NearbyUser = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  status: string | null;
  bio: string;
  lat: number;
  lng: number;
  distance: number;
  bearing: number;
  is_mock: boolean;
  is_match: boolean;
};

export type StatusOption = {
  key: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  is_default: boolean;
};

type PermState = "unknown" | "granted" | "denied" | "fallback";

type RadarValue = {
  coords: { lat: number; lng: number } | null;
  permission: PermState;
  nearby: NearbyUser[];
  statuses: StatusOption[];
  statusMap: Record<string, StatusOption>;
  loading: boolean;
  requestLocation: () => Promise<void>;
  setStatus: (key: string) => Promise<void>;
  setVisible: (v: boolean) => Promise<void>;
  setRadius: (r: number) => Promise<void>;
  refresh: () => Promise<void>;
  reloadStatuses: () => Promise<void>;
  activeMatch: NearbyUser | null;
  dismissMatch: () => void;
};

const RadarContext = createContext<RadarValue | undefined>(undefined);

export function RadarProvider({ children }: { children: React.ReactNode }) {
  const { token, user, setUser } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [permission, setPermission] = useState<PermState>("unknown");
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMatch, setActiveMatch] = useState<NearbyUser | null>(null);
  const seenMatches = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const statusMap = statuses.reduce((acc, s) => {
    acc[s.key] = s;
    return acc;
  }, {} as Record<string, StatusOption>);

  const reloadStatuses = useCallback(async () => {
    try {
      const s = await api<StatusOption[]>("/statuses", { token });
      setStatuses(s);
    } catch {}
  }, [token]);

  useEffect(() => {
    if (token) reloadStatuses();
  }, [token, reloadStatuses]);

  const requestLocation = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let perm = current;
      if (!current.granted && current.canAskAgain) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.granted) {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermission("granted");
        return;
      }
      // denied -> fall back to demo location so the radar still works
      setCoords(FALLBACK);
      setPermission("denied");
    } catch {
      setCoords(FALLBACK);
      setPermission("fallback");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!token || !coords || !user?.visible) {
      setNearby([]);
      return;
    }
    try {
      const radius = Math.min(user?.radius || 50, 50);
      const res = await api<{ users: NearbyUser[] }>(
        `/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=${radius}`,
        { token }
      );
      setNearby(res.users);
      // detect a new match
      const newMatch = res.users.find(
        (u) => u.is_match && !seenMatches.current.has(u.id)
      );
      res.users.forEach((u) => {
        if (u.is_match) seenMatches.current.add(u.id);
      });
      if (newMatch && user?.status) {
        setActiveMatch(newMatch);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    } catch {}
  }, [token, coords, user?.visible, user?.radius, user?.status]);

  const pushState = useCallback(
    async (patch: Record<string, any>) => {
      if (!token) return;
      const updated = await api("/users/me/state", {
        method: "PUT",
        body: patch,
        token,
      });
      setUser(updated as any);
    },
    [token, setUser]
  );

  // push location up whenever it changes
  useEffect(() => {
    if (token && coords) {
      pushState({ lat: coords.lat, lng: coords.lng }).then(() => refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, token]);

  // poll nearby
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (token && coords && user?.visible) {
      pollRef.current = setInterval(() => refresh(), 6000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, coords, user?.visible, refresh]);

  const setStatus = useCallback(
    async (key: string) => {
      seenMatches.current.clear();
      await pushState({ status: key });
      await refresh();
    },
    [pushState, refresh]
  );

  const setVisible = useCallback(
    async (v: boolean) => {
      await pushState({ visible: v });
      if (!v) setNearby([]);
      else await refresh();
    },
    [pushState, refresh]
  );

  const setRadius = useCallback(
    async (r: number) => {
      await pushState({ radius: r });
      await refresh();
    },
    [pushState, refresh]
  );

  return (
    <RadarContext.Provider
      value={{
        coords,
        permission,
        nearby,
        statuses,
        statusMap,
        loading,
        requestLocation,
        setStatus,
        setVisible,
        setRadius,
        refresh,
        reloadStatuses,
        activeMatch,
        dismissMatch: () => setActiveMatch(null),
      }}
    >
      {children}
    </RadarContext.Provider>
  );
}

export function useRadar() {
  const ctx = useContext(RadarContext);
  if (!ctx) throw new Error("useRadar must be used within RadarProvider");
  return ctx;
}
