/**
 * Promise-based wrapper around `navigator.geolocation.getCurrentPosition` that
 * exposes the failure **reason** (denied / unavailable / timeout) instead of
 * collapsing every error into `null`. Callers branch UX on the reason — a
 * permission banner for 'denied', a GPS hint for 'unavailable', a retry
 * affordance for 'timeout'.
 *
 * Also ships `peekPermission()` — a prompt-less probe of the current browser
 * permission state, useful for the priming flow (skip the intro if already
 * granted; jump straight to the settings banner if already denied).
 */

export interface Coords {
  lat: number;
  lng: number;
}

export type LocationFailReason = 'denied' | 'unavailable' | 'timeout';

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: LocationFailReason };

export interface RequestLocationOptions {
  /** Milliseconds before giving up. Default 5000. */
  timeoutMs?: number;
  /** Whether to request high-accuracy GPS (slower but more precise). */
  highAccuracy?: boolean;
  /** Max age of a cached browser fix that may be returned without a fresh read. */
  maximumAgeMs?: number;
}

const DEFAULT_TIMEOUT = 5000;

export async function requestLocation(
  options: RequestLocationOptions = {},
): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { ok: false, reason: 'unavailable' };
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const highAccuracy = options.highAccuracy ?? false;
  const maximumAgeMs = options.maximumAgeMs ?? 60_000;

  return new Promise<LocationResult>((resolve) => {
    // Belt-and-suspenders timer: if the platform ignores our `timeout` option
    // (some Safari versions do), this guarantees the caller still unblocks.
    let settled = false;
    const settle = (r: LocationResult): void => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const timer = setTimeout(
      () => settle({ ok: false, reason: 'timeout' }),
      timeoutMs,
    );

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          settle({
            ok: true,
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
        },
        (err) => {
          clearTimeout(timer);
          const reason: LocationFailReason =
            err.code === err.PERMISSION_DENIED
              ? 'denied'
              : err.code === err.TIMEOUT
                ? 'timeout'
                : 'unavailable';
          settle({ ok: false, reason });
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs,
        },
      );
    } catch {
      // Synchronous throw from navigator.geolocation (seen on older Safari
      // and in some WebView embeddings). Treat as unavailable rather than
      // crashing the caller.
      clearTimeout(timer);
      settle({ ok: false, reason: 'unavailable' });
    }
  });
}

export type PermissionPeekState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Probes the current geolocation permission state WITHOUT triggering the
 * browser's permission prompt. Useful for the priming UX: if the browser
 * already knows the answer, skip the intro sheet.
 *
 * Returns `'unknown'` when the Permissions API is missing (older browsers)
 * or the query throws — callers should fall back to requestLocation() and
 * let the native prompt resolve it.
 */
export async function peekPermission(): Promise<PermissionPeekState> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== 'function'
  ) {
    return 'unknown';
  }
  try {
    const res = await navigator.permissions.query({ name: 'geolocation' });
    return res.state;
  } catch {
    return 'unknown';
  }
}
