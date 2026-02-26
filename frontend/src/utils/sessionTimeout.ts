export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;
export const MIN_SESSION_TIMEOUT_MINUTES = 5;
export const MAX_SESSION_TIMEOUT_MINUTES = 480;

export function resolveSessionTimeoutMinutes(rawValue: string | undefined): number {
  if (!rawValue) return DEFAULT_SESSION_TIMEOUT_MINUTES;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  if (parsed < MIN_SESSION_TIMEOUT_MINUTES) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  if (parsed > MAX_SESSION_TIMEOUT_MINUTES) return DEFAULT_SESSION_TIMEOUT_MINUTES;

  return parsed;
}
