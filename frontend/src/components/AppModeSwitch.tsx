import React from "react";
import SegmentedControl from "@/src/components/SegmentedControl";
import { useApp } from "@/src/context/AppContext";
import { FEATURE_FLAGS } from "@/src/config/featureFlags";

export default function AppModeSwitch() {
  const { appMode, setAppMode } = useApp();
  // Professional Mode is temporarily disabled — People is the sole Radar experience.
  if (!FEATURE_FLAGS.professionalModeEnabled) return null;
  return (
    <SegmentedControl
      testID="app-mode-switch"
      options={[
        { value: "people", label: "People", testID: "mode-people", accessibilityLabel: "People mode" },
        { value: "professional", label: "Professional", testID: "mode-professional", accessibilityLabel: "Professional mode" },
      ]}
      value={appMode}
      onChange={(v) => setAppMode(v as "people" | "professional")}
    />
  );
}
