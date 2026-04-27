<template>
  <section class="vm-root" data-testid="visit-map">
    <!-- 빈 상태: 방문한 성지가 0곳 — 지도 타일은 의미 없으므로 숨기고
         "전국 0곳 방문" 오버레이만 띄운다. -->
    <div v-if="pins.length === 0" class="vm-empty" data-testid="visit-map-empty">
      <div class="vm-empty-msg">아직 방문한 성지가 없어요</div>
    </div>

    <!-- Kakao SDK 로드 실패 (dev 환경 / 키 미설정 / 오프라인) — 지도가 없으면
         대시보드 카드가 비는 게 어색하니 안내 placeholder 로 폴백. -->
    <div
      v-else-if="loadError"
      class="vm-fallback"
      data-testid="visit-map-fallback"
    >
      <div class="vm-fallback-msg">지도를 불러올 수 없어요</div>
    </div>

    <!-- 정상 경로: kakao 지도 인스턴스가 자동으로 setBounds 로 모든 핀을
         viewport 안에 맞춰 줌/팬한다. 핀은 단일 PRIMARY 컬러. -->
    <div v-show="!loadError && pins.length > 0" ref="mapEl" class="vm-canvas" />

    <button
      v-if="pins.length > 0"
      type="button"
      class="vm-overlay"
      data-testid="visit-map-overlay"
      @click="onOpen"
    >
      <span class="vm-overlay-l">
        <ion-icon :icon="locationOutline" class="ic-16" />전국 {{ pins.length }}곳 방문
      </span>
      <span class="vm-overlay-r">
        지도로 보기<ion-icon :icon="chevronForwardOutline" class="ic-16" />
      </span>
    </button>
    <button
      v-else
      type="button"
      class="vm-overlay"
      data-testid="visit-map-overlay"
      @click="onOpen"
    >
      <span class="vm-overlay-l">
        <ion-icon :icon="locationOutline" class="ic-16" />전국 0곳 방문
      </span>
      <span class="vm-overlay-r">
        지도로 보기<ion-icon :icon="chevronForwardOutline" class="ic-16" />
      </span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { locationOutline, chevronForwardOutline } from 'ionicons/icons';
import { loadKakaoMap } from '@/services/kakaoMap';

interface Pin {
  latitude: number;
  longitude: number;
}

const props = defineProps<{ pins: Pin[] }>();
const emit = defineEmits<{ (e: 'open'): void }>();

const mapEl = ref<HTMLDivElement | null>(null);
const loadError = ref<string | null>(null);

// 핀 1개일 때 setBounds 가 만드는 줌은 너무 가까우므로 고정 레벨로 폴백.
// 5 ≈ 도시 단위 — 한 점 주변이 충분히 보이는 정도.
const SINGLE_PIN_ZOOM = 5;

// kakao SDK 핸들 + map / marker 인스턴스. SDK 가 동적 로드라 타입 정의가
// 없어 unknown 캐스팅으로 사용. KakaoMap.vue 와 동일 패턴.
type AnyObj = Record<string, unknown> & Record<string, (...args: unknown[]) => unknown>;
let kakao: AnyObj | null = null;
let mapInstance: AnyObj | null = null;
let markers: AnyObj[] = [];

function clearMarkers(): void {
  markers.forEach((m) => {
    const setMap = (m as unknown as { setMap: (v: unknown) => void }).setMap;
    setMap.call(m, null);
  });
  markers = [];
}

function renderMarkers(): void {
  if (!kakao || !mapInstance) return;
  clearMarkers();
  if (props.pins.length === 0) return;

  const k = kakao as unknown as {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      Marker: new (opts: unknown) => AnyObj;
      LatLngBounds: new () => AnyObj;
    };
  };

  // 모든 핀을 LatLngBounds 에 extend → setBounds 로 한 번에 fit. 단일
  // 핀이면 setBounds 가 너무 가까이 줌인되므로 고정 레벨 폴백.
  const bounds = new k.maps.LatLngBounds();
  for (const p of props.pins) {
    const pos = new k.maps.LatLng(p.latitude, p.longitude);
    const marker = new k.maps.Marker({ position: pos });
    (marker as unknown as { setMap: (v: unknown) => void }).setMap(mapInstance);
    markers.push(marker);
    (bounds as unknown as { extend: (latLng: unknown) => void }).extend(pos);
  }
  if (props.pins.length === 1) {
    const only = props.pins[0];
    const pos = new k.maps.LatLng(only.latitude, only.longitude);
    (mapInstance as unknown as { setCenter: (v: unknown) => void }).setCenter(pos);
    (mapInstance as unknown as { setLevel: (v: number) => void }).setLevel(SINGLE_PIN_ZOOM);
  } else {
    (mapInstance as unknown as { setBounds: (b: unknown) => void }).setBounds(bounds);
  }
}

async function init(): Promise<void> {
  if (props.pins.length === 0) return; // 빈 상태에선 SDK 로드 자체 생략.
  try {
    kakao = (await loadKakaoMap()) as AnyObj;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '지도를 불러올 수 없습니다';
    return;
  }
  const el = mapEl.value;
  if (!el || !kakao) return;
  const k = kakao as unknown as {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      Map: new (container: HTMLElement, opts: unknown) => AnyObj;
    };
  };
  // 첫 frame 의 center/level 은 어차피 직후 setBounds 가 덮어쓰지만, Map
  // 생성자가 필수로 요구해서 임의의 첫 핀을 시드로 둔다. 빈 배열 방어는
  // 위에서 처리.
  const seed = props.pins[0];
  mapInstance = new k.maps.Map(el, {
    center: new k.maps.LatLng(seed.latitude, seed.longitude),
    level: SINGLE_PIN_ZOOM,
    draggable: false,
    scrollwheel: false,
    disableDoubleClick: true,
    disableDoubleClickZoom: true,
  });
  // 컨트롤 UI 도 비활성화 — 미니맵에는 줌 컨트롤 / 지도타입 토글 필요 없음.
  // Kakao 의 기본 옵션은 이미 컨트롤 미노출이라 추가 setControls 호출은 생략.
  renderMarkers();
}

function onOpen(): void {
  emit('open');
}

// pins 가 나중에 도착해 처음부터 init 이 빈 배열로 early-return 한 케이스를
// 보강. mapInstance 가 아직 없는데 pins 가 비어있지 않게 됐다면 그제서야
// SDK 로드 + 지도 생성을 트리거한다. 이미 mapInstance 가 있으면 마커만 갱신.
watch(
  () => props.pins,
  (next) => {
    if (next.length > 0 && !mapInstance && !loadError.value) {
      void init();
    } else if (mapInstance) {
      renderMarkers();
    }
  },
  { deep: true },
);
onMounted(init);
onBeforeUnmount(() => {
  clearMarkers();
  mapInstance = null;
  kakao = null;
});
</script>

<style scoped>
.vm-root {
  margin: 18px 20px 0;
  height: 160px;
  border-radius: 18px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--fr-line);
  background:
    radial-gradient(circle at 20% 40%, #e6eef7 0%, transparent 50%),
    radial-gradient(circle at 70% 60%, #dde9f2 0%, transparent 60%),
    linear-gradient(180deg, #eef3f8, #e3ecf4);
}
.vm-canvas {
  position: absolute;
  inset: 0;
}
.vm-empty,
.vm-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.vm-empty-msg,
.vm-fallback-msg {
  font-size: 13px;
  font-weight: 600;
  color: var(--fr-ink-3);
}

/* "지도로 보기" CTA — 지도 위에 떠 있는 작은 chrome 행. button 으로 둬
   전체가 탭 가능. */
.vm-overlay {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 14px;
  height: 36px;
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(140%) blur(6px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink);
  cursor: pointer;
}
.vm-overlay-l,
.vm-overlay-r {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.vm-overlay-r {
  color: var(--fr-ink-3);
}
</style>
