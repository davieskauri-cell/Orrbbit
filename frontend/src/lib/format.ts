// Approximate distance labels — INTRO never shows exact GPS positions.
export function distLabel(d: number) {
  if (d >= 480) return "Within 500m";
  if (d >= 100) return `About ${Math.round(d / 25) * 25}m away`;
  if (d >= 95) return "Within 100m";
  return `About ${Math.max(5, Math.round(d / 5) * 5)}m away`;
}
