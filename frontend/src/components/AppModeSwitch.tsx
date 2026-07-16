import React from "react";
import SegmentedControl from "@/src/components/SegmentedControl";
import { useApp } from "@/src/context/AppContext";

export default function AppModeSwitch() {
  const { appMode, setAppMode } = useApp();
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
