/**
 * Thin wrapper around `navigator.geolocation.getCurrentPosition` that
 * presents a Promise-based API with a bounded timeout and swallows every
 * failure mode into `null`. Consumers treat "no coords" as a first-class
 * state — the feed's NEARBY tab renders an empty result in that case
 * instead of bubbling an exception up into the UI.
 *
 * Failure cases that all return `null` (not throw):
 *   - `navigator.geolocation` missing (older browsers / SSR)
 *   - PERMISSION_DENIED (user said no)
 *   - POSITION_UNAVAILABLE (GPS off, no signal)
 *   - TIMEOUT (default 5s — task #37 brief)
 *   - any other unexpected throw
 */

export interface Coords {
  lat: number;
  lng: number;
}

export interface GetCurrentCoordsOptions {
  /** Milliseconds before giving up. Defaults to 5000 per task #37 brief. */
  timeoutMs?: number;
  /** Whether to request high-accuracy GPS (slower but more precise). */
  highAccuracy?: boolean;
  /** Max age of a cached fix the browser may return without a fresh read. */
  maximumAgeMs?: number;
}

const DEFAULT_TIMEOUT = 5000;

export async function getCurrentCoords(
  options: GetCurrentCoordsOptions = {},
): Promise<Coords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const highAccuracy = options.highAccuracy ?? false;
  const maximumAgeMs = options.maximumAgeMs ?? 60_000;

  return new Promise<Coords | null>((resolve) => {
    // Belt-and-suspenders timer: if the platform geolocation ignores our
    // `timeout` option (some Safari versions do), this guarantees the
    // caller still unblocks at `timeoutMs`.
    let settled = false;
    const settle = (value: Coords | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => settle(null), timeoutMs);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          settle({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Any error code (permission, unavailable, timeout) → null.
          clearTimeout(timer);
          settle(null);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs,
        },
      );
    } catch {
      clearTimeout(timer);
      settle(null);
    }
  });
}
