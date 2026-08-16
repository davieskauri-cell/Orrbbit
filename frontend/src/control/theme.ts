// Orrbbit Control Centre design tokens — sourced from the official app palette
// (src/theme.ts): white interface, navy headings, teal primary actions, orange accents.
export const CC = {
  bg: '#F6F8FB',
  surface: '#FFFFFF',
  navy: '#16294E',
  navyDark: '#0F1D3A',
  teal: '#20B2AA',       // official Orrbbit teal (matches mobile app)
  tealSoft: '#E4F6F5',   // official light teal background
  tealDark: '#178F89',   // darkened teal for text-on-light contrast
  orange: '#FF5A1F',     // official Orrbbit orange
  orangeSoft: '#FFF0E9', // official light orange background
  orangeDark: '#D64A15', // darkened orange for text-on-light contrast
  text: '#1E2A3B',
  sub: '#64748B',
  border: '#E2E8F0',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  blue: '#20B2AA',       // legacy alias — generic blue retired, maps to brand teal
  blueSoft: '#E4F6F5',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
};

// Quicksand is loaded app-wide (app/_layout.tsx) — shared with the consumer app.
export const CCF = {
  bold: 'Quicksand-Bold',
  semi: 'Quicksand-SemiBold',
  med: 'Quicksand-Medium',
  reg: 'Quicksand-Regular',
};

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Approved: { bg: CC.greenSoft, fg: CC.green },
  approved: { bg: CC.greenSoft, fg: CC.green },
  active: { bg: CC.tealSoft, fg: CC.tealDark },
  accepted: { bg: CC.tealSoft, fg: CC.tealDark },
  operational: { bg: CC.greenSoft, fg: CC.green },
  verified: { bg: CC.tealSoft, fg: CC.tealDark },
  Pending: { bg: CC.orangeSoft, fg: CC.orangeDark },
  pending: { bg: CC.orangeSoft, fg: CC.orangeDark },
  new: { bg: CC.tealSoft, fg: CC.tealDark },
  demo: { bg: CC.tealSoft, fg: CC.tealDark },
  DEMO: { bg: CC.tealSoft, fg: CC.tealDark },
  Rejected: { bg: CC.redSoft, fg: CC.red },
  rejected: { bg: CC.redSoft, fg: CC.red },
  banned: { bg: CC.redSoft, fg: CC.red },
  down: { bg: CC.redSoft, fg: CC.red },
  Expired: { bg: CC.amberSoft, fg: CC.amber },
  expired: { bg: CC.amberSoft, fg: CC.amber },
  Suspended: { bg: CC.amberSoft, fg: CC.amber },
  suspended: { bg: CC.amberSoft, fg: CC.amber },
  closed: { bg: '#F1F5F9', fg: CC.sub },
  dismissed: { bg: '#F1F5F9', fg: CC.sub },
  actioned: { bg: CC.tealSoft, fg: CC.tealDark },
  not_configured: { bg: '#F1F5F9', fg: CC.sub },
  mocked: { bg: CC.amberSoft, fg: CC.amber },
  free: { bg: '#F1F5F9', fg: CC.navy },
  plus: { bg: CC.tealSoft, fg: CC.tealDark },
  pro: { bg: CC.tealSoft, fg: CC.tealDark },
};
