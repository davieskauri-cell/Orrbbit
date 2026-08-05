const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";

/**
 * Resolve a stored profile-photo value to a renderable URI.
 * Internal asset paths (e.g. /api/demo-assets/x.jpg) are environment-agnostic in the
 * database and resolved against the current backend at render time.
 * Includes a stable version param for controlled cache refresh (no random cache-busting).
 */
export function resolvePhotoUri(uri?: string | null, version?: number | string | null): string | null {
  if (!uri) return null;
  let out = uri;
  if (uri.startsWith("/api/")) out = `${BACKEND}${uri}`;
  if (version && !out.startsWith("data:")) out += `${out.includes("?") ? "&" : "?"}v=${version}`;
  return out;
}
