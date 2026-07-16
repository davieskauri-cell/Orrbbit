// INTRO brand palette — clean white, orange & teal
export const colors = {
  surface: "#FFFFFF",
  card: "#F8FAFC",
  text: "#111827",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  orange: "#FF5A1F",
  orangeSoft: "#FFF0E9",
  teal: "#20B2AA",
  tealSoft: "#E4F6F5",
  pink: "#FF2D55",
  success: "#22C55E",
  warning: "#F59E0B",
  purple: "#8B5CF6",
  grey: "#9CA3AF",
  overlay: "#0F172A",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 26,
  display: 34,
};

// Global typography hierarchy — use for all new/updated text styles
export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800" as const, letterSpacing: -0.3, color: colors.text },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const, color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, color: colors.textSecondary },
  helper: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const, color: colors.textTertiary },
  button: { fontSize: 16, lineHeight: 20, fontWeight: "700" as const },
};

export const shadow = {
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  soft: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  button: {
    shadowColor: "#FF5A1F",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};
