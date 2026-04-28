<template>
  <div class="kakao-map-root">
    <div v-if="loadError" class="kakao-map-error">
      <p>{{ loadError }}</p>
    </div>
    <div v-show="!loadError" ref="mapEl" class="kakao-map" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MapMarker } from '@/stores/map';
import { loadKakaoMap } from '@/services/kakaoMap';
import { clusterMarkers } from '@/utils/clusterMarkers';

interface LatLng {
  lat: number;
  lng: number;
}

interface BoundsPayload {
  sw: LatLng;
  ne: LatLng;
}

const props = defineProps<{
  center: LatLng;
  zoom: number;
  markers: MapMarker[];
  selectedId: number | null;
  visitedIds: number[];
  routePath?: LatLng[];
  /**
   * task #27: Optional list of points the map should auto-fit to. When
   * provided and non-empty, the map calls Kakao's `setBounds()` so all
   * points are visible at once. Single point → setCenter + a moderate
   * zoom (avoids the over-zoom-in glitch when bounds collapse to one
   * coordinate). Empty/undefined → no fit; `center`/`zoom` props win.
   */
  fitTo?: LatLng[];
  /**
   * GPS-derived 사용자 현재 위치. 있으면 파란 "내 위치" 점을 그 좌표에
   * 그림. null/undefined 이면 그리지 않음. `center`(지도 viewport 중심)와
   * 분리 — 마커 클릭/검색으로 viewport 가 바뀌어도 이 점은 따라가지 않는다.
   */
  userLocation?: LatLng | null;
}>();

// task #27: 단일 마커일 때 setBounds 가 zoom level 1 까지 들어가버리는
// over-zoom 사고 회피용 폴백 zoom (도시 단위 정도). 사용자 보기 자연스러운
// 수준으로 조정.
const SINGLE_MARKER_ZOOM = 5;

const emit = defineEmits<{
  (e: 'markerClick', id: number): void;
  (e: 'clusterClick', payload: { latitude: number; longitude: number; markerIds: number[] }): void;
  (e: 'mapClick'): void;
  (e: 'centerChange', v: LatLng): void;
  (e: 'boundsChange', v: BoundsPayload): void;
  // Emitted when Kakao's internal zoom changes (pinch, wheel, double-tap).
  // The parent syncs the store so the clusterer recomputes with the new level.
  (e: 'zoomChange', level: number): void;
}>();

const mapEl = ref<HTMLDivElement | null>(null);
const loadError = ref<string | null>(null);

type AnyObj = Record<string, unknown> & Record<string, (...args: unknown[]) => unknown>;

let kakao: AnyObj | null = null;
let mapInstance: AnyObj | null = null;
let overlays: AnyObj[] = [];
let meOverlay: AnyObj | null = null;
let routePolyline: AnyObj | null = null;

// Pre-computed renderables (pins + clusters). Recomputed whenever markers,
// zoom, or selectedId change so the clusterer stays in sync with the view.
const renderables = computed(() =>
  clusterMarkers(props.markers, props.zoom, { selectedId: props.selectedId }),
);

function clearOverlays(): void {
  overlays.forEach((o) => {
    const setMap = (o as unknown as { setMap: (v: unknown) => void }).setMap;
    setMap.call(o, null);
  });
  overlays = [];
  if (meOverlay) {
    const setMap = (meOverlay as unknown as { setMap: (v: unknown) => void }).setMap;
    setMap.call(meOverlay, null);
    meOverlay = null;
  }
}

function buildPinContent(m: MapMarker, isVisited: boolean, isActive: boolean): HTMLDivElement {
  const root = document.createElement('div');
  const classes = ['pin'];
  if (isVisited) classes.push('visited');
  if (isActive) classes.push('active');
  root.className = classes.join(' ');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.textContent = isVisited ? '✓' : '●';
  bubble.appendChild(dot);
  const label = document.createTextNode(m.name);
  bubble.appendChild(label);
  root.appendChild(bubble);
  root.addEventListener('click', (ev) => {
    ev.stopPropagation();
    emit('markerClick', m.id);
  });
  return root;
}

function buildClusterContent(count: number, onClick: () => void): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'pin cluster';
  const bubble = document.createElement('div');
  bubble.className = 'cluster-bubble';
  bubble.textContent = String(count);
  root.appendChild(bubble);
  root.addEventListener('click', (ev) => {
    ev.stopPropagation();
    onClick();
  });
  return root;
}

function buildMeContent(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'kakao-me';
  return el;
}

function renderOverlays(): void {
  if (!kakao || !mapInstance) return;
  clearOverlays();
  const k = kakao as unknown as {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      CustomOverlay: new (opts: unknown) => AnyObj;
    };
  };
  const visitedSet = new Set(props.visitedIds);

  renderables.value.forEach((r) => {
    if (r.kind === 'pin') {
      const m = r.marker;
      const position = new k.maps.LatLng(m.latitude, m.longitude);
      const content = buildPinContent(m, visitedSet.has(m.id), props.selectedId === m.id);
      const overlay = new k.maps.CustomOverlay({
        position,
        content,
        yAnchor: 1,
        clickable: true,
      });
      const setMap = (overlay as unknown as { setMap: (v: unknown) => void }).setMap;
      setMap.call(overlay, mapInstance);
      overlays.push(overlay);
      return;
    }

    // Cluster overlay
    const position = new k.maps.LatLng(r.latitude, r.longitude);
    const content = buildClusterContent(r.count, () => {
      emit('clusterClick', {
        latitude: r.latitude,
        longitude: r.longitude,
        markerIds: r.markerIds,
      });
    });
    const overlay = new k.maps.CustomOverlay({
      position,
      content,
      yAnchor: 0.5,
      xAnchor: 0.5,
      clickable: true,
    });
    const setMap = (overlay as unknown as { setMap: (v: unknown) => void }).setMap;
    setMap.call(overlay, mapInstance);
    overlays.push(overlay);
  });

  // "You are here" dot — GPS 좌표(props.userLocation)에만 그린다. 이전에는
  // props.center 를 따라갔는데 그러면 마커 선택/검색으로 viewport 가 옮겨질
  // 때마다 me 점도 따라가서 "내 위치"가 의미를 잃었다. userLocation 이 없으면
  // (권한 거부/미요청) 점 자체를 그리지 않는다.
  if (props.userLocation) {
    const mePos = new k.maps.LatLng(props.userLocation.lat, props.userLocation.lng);
    const me = new k.maps.CustomOverlay({
      position: mePos,
      content: buildMeContent(),
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 1,
    });
    const setMap = (me as unknown as { setMap: (v: unknown) => void }).setMap;
    setMap.call(me, mapInstance);
    meOverlay = me;
  }
}

function emitBounds(): void {
  if (!mapInstance) return;
  const b = (
    mapInstance as unknown as {
      getBounds: () => {
        getSouthWest: () => { getLat: () => number; getLng: () => number };
        getNorthEast: () => { getLat: () => number; getLng: () => number };
      };
    }
  ).getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  emit('boundsChange', {
    sw: { lat: sw.getLat(), lng: sw.getLng() },
    ne: { lat: ne.getLat(), lng: ne.getLng() },
  });
}

async function init(): Promise<void> {
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
      event: { addListener: (target: unknown, type: string, cb: (e: unknown) => void) => void };
    };
  };
  mapInstance = new k.maps.Map(el, {
    center: new k.maps.LatLng(props.center.lat, props.center.lng),
    level: props.zoom,
  });
  k.maps.event.addListener(mapInstance, 'click', () => emit('mapClick'));
  k.maps.event.addListener(mapInstance, 'dragend', () => {
    if (!mapInstance) return;
    const c = (mapInstance as unknown as { getCenter: () => { getLat: () => number; getLng: () => number } }).getCenter();
    emit('centerChange', { lat: c.getLat(), lng: c.getLng() });
    emitBounds();
  });
  // Kakao fires `bounds_changed` on any pan/zoom/drag end; the consumer is
  // responsible for debouncing before hitting the server.
  k.maps.event.addListener(mapInstance, 'bounds_changed', () => emitBounds());
  k.maps.event.addListener(mapInstance, 'zoom_changed', () => {
    if (!mapInstance) return;
    const level = (mapInstance as unknown as { getLevel: () => number }).getLevel();
    emit('zoomChange', level);
    emitBounds();
  });
  renderOverlays();
  renderRoute();
  // task #27: 초기 fit 적용 — props.fitTo 가 채워진 채로 마운트되면 즉시 fit.
  applyFit();
  // Prime the consumer with the initial bounds so it can kick off the first
  // viewport-scoped fetch without waiting for the user to pan.
  emitBounds();
}

// task #27: fitTo 의 좌표 범위에 맞춰 지도 viewport 조정. Kakao 의
// `LatLngBounds` + `extend(LatLng)` + `map.setBounds(bounds)` 패턴.
function applyFit(): void {
  if (!kakao || !mapInstance) return;
  const pts = props.fitTo ?? [];
  if (pts.length === 0) return;
  const k = kakao as unknown as {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      LatLngBounds: new () => {
        extend: (pos: unknown) => void;
      };
    };
  };
  if (pts.length === 1) {
    // 단일 점 — setBounds 가 over-zoom 되는 케이스 회피.
    const p = pts[0];
    const pos = new k.maps.LatLng(p.lat, p.lng);
    (mapInstance as unknown as { setCenter: (v: unknown) => void }).setCenter(pos);
    (mapInstance as unknown as { setLevel: (v: number) => void }).setLevel(SINGLE_MARKER_ZOOM);
    return;
  }
  const bounds = new k.maps.LatLngBounds();
  for (const p of pts) bounds.extend(new k.maps.LatLng(p.lat, p.lng));
  (mapInstance as unknown as { setBounds: (v: unknown) => void }).setBounds(bounds);
}

function renderRoute(): void {
  if (routePolyline) {
    (routePolyline as unknown as { setMap: (m: unknown) => void }).setMap(null);
    routePolyline = null;
  }
  if (!kakao || !mapInstance) return;
  const path = props.routePath ?? [];
  if (path.length < 2) return;
  const k = kakao as unknown as {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      Polyline: new (opts: unknown) => AnyObj;
    };
  };
  routePolyline = new k.maps.Polyline({
    path: path.map((pt) => new k.maps.LatLng(pt.lat, pt.lng)),
    strokeWeight: 4,
    strokeColor: '#14BCED',
    strokeOpacity: 0.85,
    strokeStyle: 'shortdash',
  });
  (routePolyline as unknown as { setMap: (m: unknown) => void }).setMap(mapInstance);
}

watch(renderables, () => renderOverlays(), { deep: true });
watch(() => props.visitedIds, () => renderOverlays(), { deep: true });
// userLocation 이 비동기로 채워질 수 있으므로 (권한 프롬프트 후 응답) 변화
// 시 overlays 를 다시 그려 me 점을 갱신/제거한다. deep 으로 좌표 값 추적.
watch(() => props.userLocation, () => renderOverlays(), { deep: true });
watch(() => props.routePath, () => renderRoute(), { deep: true });
// task #27: fitTo 가 비동기로 바뀌는 경우(부모에서 markers fetch 후 채움) 도
// 자동 fit. deep 으로 좌표 값까지 추적.
watch(() => props.fitTo, () => applyFit(), { deep: true });
watch(
  () => [props.center.lat, props.center.lng],
  () => {
    if (!kakao || !mapInstance) return;
    const k = kakao as unknown as { maps: { LatLng: new (lat: number, lng: number) => unknown } };
    const pos = new k.maps.LatLng(props.center.lat, props.center.lng);
    (mapInstance as unknown as { setCenter: (v: unknown) => void }).setCenter(pos);
    renderOverlays();
  },
);
watch(
  () => props.zoom,
  (z) => {
    if (!mapInstance) return;
    (mapInstance as unknown as { setLevel: (v: number) => void }).setLevel(z);
  },
);

onMounted(init);
onBeforeUnmount(() => {
  clearOverlays();
  if (routePolyline) {
    (routePolyline as unknown as { setMap: (m: unknown) => void }).setMap(null);
    routePolyline = null;
  }
  mapInstance = null;
  kakao = null;
});
</script>

<style scoped>
.kakao-map-root {
  position: absolute;
  inset: 0;
}
.kakao-map {
  position: absolute;
  inset: 0;
}
.kakao-map-error {
  position: absolute;
  inset: 0;
  background: #eef3f8;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-3);
  font-size: 13px;
  padding: 24px;
  text-align: center;
}
</style>

<style>
.kakao-map .pin {
  transform: translate(-50%, -100%);
  cursor: pointer;
  z-index: 2;
}
.kakao-map .pin .bubble {
  background: #ffffff;
  border-radius: 999px;
  padding: 5px 10px 5px 5px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.06);
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  position: relative;
  white-space: nowrap;
}
.kakao-map .pin .bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 8px;
  background: #ffffff;
  box-shadow: 1px 1px 0 rgba(15, 23, 42, 0.06);
}
.kakao-map .pin .dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--fr-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
}
.kakao-map .pin.visited .dot { background: var(--fr-mint); }
.kakao-map .pin.active { z-index: 5; }
.kakao-map .pin.active .dot { background: #0f172a; transform: scale(1.1); }
.kakao-map .pin.active .bubble { background: #0f172a; color: #ffffff; }
.kakao-map .pin.active .bubble::after { background: #0f172a; box-shadow: none; }

/* Cluster badge — shown when overlapping pins are collapsed at low zoom.
   Intentionally smaller + translucent so a dense cluster doesn't mask the
   map beneath, and so a single pin nearby still reads as "more important". */
.kakao-map .pin.cluster {
  transform: translate(-50%, -50%);
  z-index: 3;
}
.kakao-map .pin.cluster .cluster-bubble {
  min-width: 34px;
  height: 34px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(20, 188, 237, 0.78);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 0 0 3px rgba(20, 188, 237, 0.14),
    0 4px 12px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.kakao-map .kakao-me {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--fr-primary);
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 8px rgba(20, 188, 237, 0.25);
}
</style>
