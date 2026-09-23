/**
 * Central feature flags for controlled, reversible product changes.
 *
 * professionalModeEnabled — Professional Mode (People|Professional Radar switch,
 * professional discovery/booking, verification flow, Requests/Sessions tabs) is
 * temporarily disabled from the consumer app UI. No backend data, APIs, or
 * verification records are deleted — flip this back to `true` to fully restore
 * the experience without any rebuild.
 */
export const FEATURE_FLAGS = {
  professionalModeEnabled: false,
};
