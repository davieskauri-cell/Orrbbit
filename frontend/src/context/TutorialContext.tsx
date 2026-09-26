import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/lib/api";

export type TutorialTarget =
  | "tab-today"
  | "tab-radar"
  | "tab-nearby"
  | "tab-encounters"
  | "vibe-pill"
  | null;

export type TutorialStep = {
  id: string;
  eyebrow: string;
  headline: string;
  tagline?: string;
  body: string;
  icon: string;
  primaryLabel: string;
  target: TutorialTarget;
  route?: string;
};

// Exact copy as specified — a short, 8-step guided tour for new People users.
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    eyebrow: "WELCOME",
    headline: "Welcome to Orrbbit",
    tagline: "People. Places. Possibilities. Around you.",
    body: "Orrbbit helps you discover people, events and opportunities happening around you.",
    icon: "planet-outline",
    primaryLabel: "Show me around",
    target: null,
  },
  {
    id: "today",
    eyebrow: "TODAY",
    headline: "See what's happening around you",
    body: "Get a quick snapshot of nearby people, events and activity when you open Orrbbit.",
    icon: "home-outline",
    primaryLabel: "Next",
    target: "tab-today",
    route: "/(tabs)/today",
  },
  {
    id: "radar",
    eyebrow: "RADAR",
    headline: "Discover what's around you",
    body: "Explore nearby people, events and businesses. Zoom, move the Radar and use filters to find what matters to you.",
    icon: "radio-outline",
    primaryLabel: "Next",
    target: "tab-radar",
    route: "/(tabs)",
  },
  {
    id: "vibe",
    eyebrow: "YOUR VIBE",
    headline: "Let people know what you're open to",
    body: "Choose a Vibe such as Coffee / Drinks, Chat, Networking, Advice or Activity and control how long you're visible.",
    icon: "sparkles-outline",
    primaryLabel: "Next",
    target: "vibe-pill",
    route: "/(tabs)",
  },
  {
    id: "nearby",
    eyebrow: "NEARBY",
    headline: "Browse nearby people",
    body: "See relevant people around you in a simpler list-style view.",
    icon: "people-outline",
    primaryLabel: "Next",
    target: "tab-nearby",
    route: "/(tabs)/nearby",
  },
  {
    id: "encounters",
    eyebrow: "ENCOUNTERS",
    headline: "See who you've crossed paths with",
    body: "Reconnect with relevant people you encountered while using Orrbbit, while keeping location privacy protected.",
    icon: "footsteps-outline",
    primaryLabel: "Next",
    target: "tab-encounters",
    route: "/(tabs)/encounters",
  },
  {
    id: "meetups",
    eyebrow: "SAFETY",
    headline: "Meet somewhere public",
    body: "When you choose to meet, Orrbbit can help you select a public meetup point or an Orrbbit Verified Meetup Spot.",
    icon: "shield-checkmark-outline",
    primaryLabel: "Next",
    target: null,
  },
  {
    id: "ready",
    eyebrow: "YOU'RE ALL SET",
    headline: "Your Orrbbit starts here.",
    body: "See what's around you and make something happen.",
    icon: "rocket-outline",
    primaryLabel: "Explore Orrbbit",
    target: null,
  },
];

type TutorialValue = {
  visible: boolean;
  stepIndex: number;
  steps: TutorialStep[];
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
};

const TutorialContext = createContext<TutorialValue | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const autoShown = useRef(false);

  const persistCompleted = useCallback(async () => {
    try {
      const updated = await api("/users/me/state", {
        method: "PUT",
        body: { tutorial_completed: true },
      });
      setUser(updated as any);
    } catch {
      // best-effort — worst case it can still be replayed from Profile
    }
  }, [setUser]);

  const goToStep = useCallback(
    (idx: number) => {
      setStepIndex(idx);
      const step = TUTORIAL_STEPS[idx];
      if (step?.route) {
        try {
          router.push(step.route as any);
        } catch {}
      }
    },
    [router]
  );

  const start = useCallback(() => {
    setVisible(true);
    goToStep(0);
  }, [goToStep]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      const ni = i + 1;
      if (ni >= TUTORIAL_STEPS.length) {
        setVisible(false);
        persistCompleted();
        return i;
      }
      const step = TUTORIAL_STEPS[ni];
      if (step?.route) {
        try {
          router.push(step.route as any);
        } catch {}
      }
      return ni;
    });
  }, [persistCompleted, router]);

  const back = useCallback(() => {
    setStepIndex((i) => {
      const pi = Math.max(0, i - 1);
      const step = TUTORIAL_STEPS[pi];
      if (step?.route) {
        try {
          router.push(step.route as any);
        } catch {}
      }
      return pi;
    });
  }, [router]);

  const skip = useCallback(() => {
    setVisible(false);
    persistCompleted();
  }, [persistCompleted]);

  // Auto-start exactly once for a brand-new People user who hasn't seen it yet.
  // Existing accounts (tutorial_completed defaults to true server-side) and
  // business/demo accounts are never auto-started.
  useEffect(() => {
    if (autoShown.current) return;
    if (!user) return;
    if (user.is_demo) return;
    if (user.account_type === "business") return;
    if ((user as any).tutorial_completed !== false) return;
    autoShown.current = true;
    const t = setTimeout(() => start(), 700);
    return () => clearTimeout(t);
  }, [user, start]);

  return (
    <TutorialContext.Provider
      value={{ visible, stepIndex, steps: TUTORIAL_STEPS, start, next, back, skip }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
