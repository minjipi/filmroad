import { readonly, ref, type Ref } from 'vue';

export type GeolocationStatus =
  | 'idle' // 아직 요청한 적 없음
  | 'pending' // 브라우저 권한 팝업 또는 좌표 fix 대기 중
  | 'granted' // 좌표 수신 완료
  | 'denied' // 사용자가 차단 — 자동 재요청 금지 (브라우저가 팝업 안 띄움)
  | 'unavailable'; // navigator.geolocation 없음 / 타임아웃 / POSITION_UNAVAILABLE

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeolocationRequestOptions {
  /** getCurrentPosition 타임아웃. 기본 8초 — 모바일 첫 fix 감안. */
  timeoutMs?: number;
  /**
   * 이 시간 이내에 받아둔 좌표가 있으면 브라우저가 재측정 없이 즉시 재사용.
   * 기본 60초 — 홈 화면 탭 왕복 시 반복 권한 팝업 방지.
   */
  maximumAgeMs?: number;
  /** 기본 false. 첫 진입에선 배터리를 아낀다. */
  enableHighAccuracy?: boolean;
}

// 모듈 레벨 싱글톤 — 여러 컴포넌트가 useGeolocation() 을 호출해도 같은
// 상태/캐시를 공유한다. 홈의 priming 플로우와 미래의 지도 화면이 한 번 받은
// 좌표를 중복 요청 없이 재사용할 수 있게 하려는 의도.
const coordsRef: Ref<Coords | null> = ref(null);
const statusRef: Ref<GeolocationStatus> = ref<GeolocationStatus>('idle');
const errorRef: Ref<string | null> = ref(null);
let pendingRequest: Promise<Coords | null> | null = null;

function isSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'geolocation' in navigator &&
    typeof navigator.geolocation?.getCurrentPosition === 'function'
  );
}

function request(opts: GeolocationRequestOptions = {}): Promise<Coords | null> {
  // 동시 호출 병합 — 여러 곳에서 request() 를 연속 호출해도 브라우저 팝업은
  // 한 번만 뜨도록.
  if (pendingRequest) return pendingRequest;

  if (!isSupported()) {
    statusRef.value = 'unavailable';
    errorRef.value = 'Geolocation API not available';
    return Promise.resolve(null);
  }

  statusRef.value = 'pending';
  errorRef.value = null;

  pendingRequest = new Promise<Coords | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.value = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        statusRef.value = 'granted';
        pendingRequest = null;
        resolve(coordsRef.value);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          statusRef.value = 'denied';
        } else {
          // POSITION_UNAVAILABLE / TIMEOUT / insecure-context 는 UX 상 모두
          // "위치를 받을 수 없음" 으로 동일하게 폴백 처리.
          statusRef.value = 'unavailable';
        }
        errorRef.value = err.message || `Geolocation error ${err.code}`;
        pendingRequest = null;
        resolve(null);
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy ?? false,
        timeout: opts.timeoutMs ?? 8000,
        maximumAge: opts.maximumAgeMs ?? 60000,
      },
    );
  });

  return pendingRequest;
}

function reset(): void {
  // 테스트용. 싱글톤 상태를 깨끗이 리셋.
  coordsRef.value = null;
  statusRef.value = 'idle';
  errorRef.value = null;
  pendingRequest = null;
}

export function useGeolocation() {
  return {
    coords: readonly(coordsRef),
    status: readonly(statusRef),
    error: readonly(errorRef),
    request,
    reset,
  };
}
