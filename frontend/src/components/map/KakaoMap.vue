<template>
  <div class="kakao-map-root">
    <div v-if="loadError" class="kakao-map-error">
      <p>{{ loadError }}</p>
    </div>
    <div v-show="!loadError" ref="mapEl" class="kakao-map" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MapMarker } from '@/stores/map';
import { loadKakaoMap } from '@/services/kakaoMap';

interface LatLng {
  lat: number;
  lng: number;
}

const props = defineProps<{
  center: LatLng;
  zoom: number;
  markers: MapMarker[];
  selectedId: number | null;
  visitedIds: number[];
}>();

const emit = defineEmits<{
  (e: 'markerClick', id: number): void;
  (e: 'mapClick'): void;
  (e: 'centerChange', v: LatLng): void;
}>();

const mapEl = ref<HTMLDivElement | null>(null);
const loadError = ref<string | null>(null);

type AnyObj = Record<string, unknown> & Record<string, (...args: unknown[]) => unknown>;

let kakao: AnyObj | null = null;
let mapInstance: AnyObj | null = null;
let overlays: AnyObj[] = [];
let meOverlay: AnyObj | null = null;

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
  props.markers.forEach((m) => {
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
  });
  const mePos = new k.maps.LatLng(props.center.lat, props.center.lng);
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
  });
  renderOverlays();
}

watch(
  () => props.markers,
  () => renderOverlays(),
  { deep: true },
);
watch(() => props.selectedId, () => renderOverlays());
watch(() => props.visitedIds, () => renderOverlays(), { deep: true });
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
.kakao-map .kakao-me {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--fr-primary);
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 8px rgba(20, 188, 237, 0.25);
}
</style>
