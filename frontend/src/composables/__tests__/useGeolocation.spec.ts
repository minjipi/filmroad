import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentCoords } from '@/composables/useGeolocation';

type Success = (pos: GeolocationPosition) => void;
type Fail = (err: GeolocationPositionError) => void;

function installGeolocation(impl: {
  getCurrentPosition: (s: Success, f: Fail, opts?: PositionOptions) => void;
}) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: impl,
  });
}
function uninstallGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: undefined,
  });
}

describe('useGeolocation', () => {
  afterEach(() => {
    uninstallGeolocation();
  });

  it('returns null when navigator.geolocation is missing (older browsers / SSR)', async () => {
    uninstallGeolocation();
    const coords = await getCurrentCoords();
    expect(coords).toBeNull();
  });

  it('resolves {lat,lng} on a successful getCurrentPosition callback', async () => {
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

    const coords = await getCurrentCoords();
    expect(coords).toEqual({ lat: 37.5665, lng: 126.978 });
  });

  it('returns null on PERMISSION_DENIED (code=1)', async () => {
    installGeolocation({
      getCurrentPosition: (_s, fail) => {
        fail({
          code: 1,
          message: 'denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      },
    });

    const coords = await getCurrentCoords();
    expect(coords).toBeNull();
  });

  it('returns null when the platform never calls back (belt-and-suspenders timeout)', async () => {
    vi.useFakeTimers();
    installGeolocation({
      // Intentionally do nothing — simulate a hung platform API.
      getCurrentPosition: () => undefined,
    });

    try {
      const pending = getCurrentCoords({ timeoutMs: 100 });
      vi.advanceTimersByTime(200);
      const coords = await pending;
      expect(coords).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('swallows synchronous throws from navigator.geolocation and returns null', async () => {
    installGeolocation({
      getCurrentPosition: () => {
        throw new Error('boom');
      },
    });

    const coords = await getCurrentCoords();
    expect(coords).toBeNull();
  });
});
