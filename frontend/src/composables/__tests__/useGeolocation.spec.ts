import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  requestLocation,
  peekPermission,
} from '@/composables/useGeolocation';

type Success = (pos: GeolocationPosition) => void;
type Fail = (err: GeolocationPositionError) => void;

function installGeolocation(impl: {
  getCurrentPosition: (s: Success, f: Fail, opts?: PositionOptions) => void;
}): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: impl,
  });
}
function uninstallGeolocation(): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: undefined,
  });
}

function installPermissions(impl: { query: (descriptor: { name: string }) => Promise<{ state: string }> }): void {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: impl,
  });
}
function uninstallPermissions(): void {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: undefined,
  });
}

const ERR_CONST = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };

describe('requestLocation', () => {
  afterEach(() => {
    uninstallGeolocation();
    uninstallPermissions();
  });

  it('returns { ok: false, reason: "unavailable" } when navigator.geolocation is missing', async () => {
    uninstallGeolocation();
    const result = await requestLocation();
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('resolves { ok: true, coords } on a successful getCurrentPosition callback', async () => {
    installGeolocation({
      getCurrentPosition: (success) => {
        success({
          coords: {
            latitude: 37.5665,
            longitude: 126.978,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      },
    });

    const result = await requestLocation();
    expect(result).toEqual({
      ok: true,
      coords: { lat: 37.5665, lng: 126.978 },
    });
  });

  it('maps PERMISSION_DENIED (code=1) to reason="denied"', async () => {
    installGeolocation({
      getCurrentPosition: (_s, fail) => {
        fail({
          code: 1,
          message: 'denied',
          ...ERR_CONST,
        } as GeolocationPositionError);
      },
    });

    const result = await requestLocation();
    expect(result).toEqual({ ok: false, reason: 'denied' });
  });

  it('maps POSITION_UNAVAILABLE (code=2) to reason="unavailable"', async () => {
    installGeolocation({
      getCurrentPosition: (_s, fail) => {
        fail({
          code: 2,
          message: 'no signal',
          ...ERR_CONST,
        } as GeolocationPositionError);
      },
    });

    const result = await requestLocation();
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('maps TIMEOUT (code=3) from the platform to reason="timeout"', async () => {
    installGeolocation({
      getCurrentPosition: (_s, fail) => {
        fail({
          code: 3,
          message: 'timeout',
          ...ERR_CONST,
        } as GeolocationPositionError);
      },
    });

    const result = await requestLocation();
    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });

  it('belt-and-suspenders timer: hung platform API resolves as timeout', async () => {
    vi.useFakeTimers();
    installGeolocation({
      // Intentionally do nothing — simulate a hung platform API.
      getCurrentPosition: () => undefined,
    });

    try {
      const pending = requestLocation({ timeoutMs: 100 });
      vi.advanceTimersByTime(200);
      const result = await pending;
      expect(result).toEqual({ ok: false, reason: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('synchronous throws from navigator.geolocation collapse to reason="unavailable"', async () => {
    installGeolocation({
      getCurrentPosition: () => {
        throw new Error('boom');
      },
    });

    const result = await requestLocation();
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('peekPermission', () => {
  afterEach(() => {
    uninstallPermissions();
  });

  it("returns 'unknown' when navigator.permissions is missing", async () => {
    uninstallPermissions();
    const state = await peekPermission();
    expect(state).toBe('unknown');
  });

  it("proxies 'granted' / 'denied' / 'prompt' from Permissions.query", async () => {
    for (const expected of ['granted', 'denied', 'prompt'] as const) {
      installPermissions({
        query: async () => ({ state: expected }),
      });
      const state = await peekPermission();
      expect(state).toBe(expected);
    }
  });

  it("returns 'unknown' when Permissions.query throws", async () => {
    installPermissions({
      query: async () => {
        throw new Error('not supported');
      },
    });
    const state = await peekPermission();
    expect(state).toBe('unknown');
  });
});
