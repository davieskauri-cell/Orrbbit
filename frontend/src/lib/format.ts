// Approximate distance labels — INTRO never shows exact GPS positions.
export function distLabel(d: number) {
  if (d >= 480) return "Within 500m";
  if (d >= 100) return `About ${Math.round(d / 25) * 25}m away`;
  if (d >= 95) return "Within 100m";
  return `About ${Math.max(5, Math.round(d / 5) * 5)}m away`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(Math.abs(diff) / 60000);
  const future = diff < 0;
  const label =
    mins < 1 ? "just now" : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  if (label === "just now") return label;
  return future ? `in ${label}` : `${label} ago`;
}
