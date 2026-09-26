import { createRef } from "react";
import type { View } from "react-native";

// Module-level ref so the Tutorial overlay (mounted once at the tabs-layout
// level) can measure the real "current vibe" pill rendered on the Radar
// screen, without prop-drilling through unrelated screens.
export const vibePillTargetRef = createRef<View>();
