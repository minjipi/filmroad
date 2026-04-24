import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGeolocation } from '../useGeolocation';

/**
 * useGeolocation 은 모듈 싱글톤이라 각 테스트 앞에서 reset() 하고,
 * navigator.geolocation 도 신선한 mock 으로 교체한다.
 */

type PosSuccess = (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;
type PosError = (err: { code: number; message: string; PERMISSION_DENIED: number; POSITION_UNAVAILABLE: number; TIMEOUT: number }) => void;

interface MockGeolocation {
  getCurrentPosition: ReturnType<typeof vi.fn>;
}

function installMockGeolocation(impl: (success: PosSuccess, error: PosError) => void): MockGeolocation {
  const mock: MockGeolocation = {
    getCurrentPosition: vi.fn(impl),
  };
  Object.defineProperty(global, 'navigator', {
    value: { geolocation: mock },
    writable: true,
    configurable: true,
  });
  return mock;
}

function uninstallNavigator(): void {
  Object.defineProperty(global, 'navigator', {
    value: undefined,
    writable: true,
    configurable: true,
  });
}

const POS_ERR_CONST = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };

describe('useGeolocation', () => {
  beforeEach(() => {
    useGeolocation().reset();
  });

  afterEach(() => {
    uninstallNavigator();
  });

  it('granted path populates coords and status', async () => {
    installMockGeolocation((success) => {
      success({ coords: { latitude: 37.5665, longitude: 126.978, accuracy: 15 } });
    });
    const { request, coords, status } = useGeolocation();
    const c = await request();
    expect(c).toEqual({ latitude: 37.5665, longitude: 126.978, accuracy: 15 });
    expect(coords.value).toEqual(c);
    expect(status.value).toBe('granted');
  });

  it('PERMISSION_DENIED maps to status=denied and returns null', async () => {
    installMockGeolocation((_s, error) => {
      error({ code: POS_ERR_CONST.PERMISSION_DENIED, message: 'denied', ...POS_ERR_CONST });
    });
    const { request, coords, status, error } = useGeolocation();
    const c = await request();
    expect(c).toBeNull();
    expect(coords.value).toBeNull();
    expect(status.value).toBe('denied');
    expect(error.value).toBe('denied');
  });

  it('TIMEOUT maps to status=unavailable', async () => {
    installMockGeolocation((_s, error) => {
      error({ code: POS_ERR_CONST.TIMEOUT, message: 'timeout', ...POS_ERR_CONST });
    });
    const { request, status } = useGeolocation();
    await request({ timeoutMs: 10 });
    expect(status.value).toBe('unavailable');
  });

  it('POSITION_UNAVAILABLE maps to status=unavailable', async () => {
    installMockGeolocation((_s, error) => {
      error({ code: POS_ERR_CONST.POSITION_UNAVAILABLE, message: 'unavailable', ...POS_ERR_CONST });
    });
    const { request, status } = useGeolocation();
    await request();
    expect(status.value).toBe('unavailable');
  });

  it('missing navigator.geolocation yields status=unavailable without calling API', async () => {
    uninstallNavigator();
    const { request, status } = useGeolocation();
    const c = await request();
    expect(c).toBeNull();
    expect(status.value).toBe('unavailable');
  });

  it('concurrent request() calls share a single native getCurrentPosition invocation', async () => {
    let resolveSuccess: PosSuccess | null = null;
    const mock = installMockGeolocation((success) => {
      resolveSuccess = success;
    });
    const { request } = useGeolocation();
    const p1 = request();
    const p2 = request();
    expect(mock.getCurrentPosition).toHaveBeenCalledTimes(1);
    resolveSuccess!({ coords: { latitude: 1, longitude: 2, accuracy: 3 } });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
  });

  it('reset() clears coords/status back to idle', async () => {
    installMockGeolocation((success) => {
      success({ coords: { latitude: 10, longitude: 20, accuracy: 5 } });
    });
    const geo = useGeolocation();
    await geo.request();
    expect(geo.status.value).toBe('granted');
    geo.reset();
    expect(geo.status.value).toBe('idle');
    expect(geo.coords.value).toBeNull();
  });
});
