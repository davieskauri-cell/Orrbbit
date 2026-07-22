// IntroYu brand palette — clean white, orange & teal
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
  twenty: 20,
  xl: 24,
  xxl: 32,
  forty: 40,
  xxxl: 48,
};

// Standard page layout tokens
export const layout = {
  pagePaddingH: 24,
  pageTop: 8,
  sectionGap: 24,
  bottomSafe: 32,
};

// Standard icon sizes
export const iconSize = {
  inline: 14,
  list: 18,
  button: 20,
  section: 24,
  nav: 26,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
  // semantic aliases
  control: 8,
  input: 14,
  chip: 999,
  card: 22,
  sheet: 22,
  container: 22,
};

export const font = {
  micro: 10, // smallest permitted text (map labels, dots)
  label: 11, // tiny badges & meta labels
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 26,
  display: 34,
};

// Standard avatar sizes — use instead of arbitrary numbers
export const avatarSize = {
  xs: 32,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 96,
};

// Standard control heights (buttons, inputs, chips) + minimum touch target
export const controlHeight = {
  buttonLg: 56, // PrimaryButton
  button: 52, // SecondaryButton / OutlineButton
  input: 52, // FormField inputs
  compact: 44, // small tappable controls — never go below this for touchables
  chip: 36, // PillChip / SegmentedControl segments (non-primary targets)
};
export const touchTarget = 44;

// Card & screen padding
export const cardPadding = {
  standard: 16, // AppCard default
  roomy: 20,
  compact: 12,
};

// Animation durations & easing — keep motion consistent app-wide
export const anim = {
  fast: 150, // micro-interactions (press feedback, image fade)
  base: 250, // sheet/modal transitions
  slow: 400, // screen-level emphasis
  pulse: 1500, // ambient loops (radar pulse)
  easing: "ease-out" as const,
};

// Global typography hierarchy — use for all new/updated text styles
export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
  pageTitle: { fontSize: 34, lineHeight: 40, fontWeight: "800" as const, letterSpacing: -0.5, color: colors.text },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800" as const, letterSpacing: -0.3, color: colors.text },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "700" as const, color: colors.text },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: "800" as const, letterSpacing: 1.2, color: colors.textTertiary, textTransform: "uppercase" as const },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const, color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const, color: colors.textSecondary },
  helper: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const, color: colors.textTertiary },
  micro: { fontSize: 10, lineHeight: 13, fontWeight: "700" as const, color: colors.textTertiary },
  button: { fontSize: 16, lineHeight: 20, fontWeight: "700" as const },
  chip: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const },
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
  // selected segmented-control tab
  segment: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  // modals & bottom sheets
  sheet: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
};
