let loadPromise: Promise<unknown> | null = null;

export function loadKakaoMap(): Promise<unknown> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;
    if (!key) {
      reject(new Error('VITE_KAKAO_MAP_KEY is not set'));
      return;
    }
    const w = window as unknown as { kakao?: { maps?: { load: (cb: () => void) => void } } };
    if (w.kakao?.maps) {
      w.kakao.maps.load(() => resolve(w.kakao));
      return;
    }
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;
    script.async = true;
    script.onload = () => {
      const ww = window as unknown as { kakao: { maps: { load: (cb: () => void) => void } } };
      ww.kakao.maps.load(() => resolve(ww.kakao));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Kakao Maps SDK'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
