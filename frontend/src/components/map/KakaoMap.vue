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
   * leg(origin→via1, via1→via2, ...) 별 좌표. 같은 도로를 두 번 지나가는 코스에서
   * 각 leg 를 별도 polyline + perpendicular offset 으로 그려 두 라인이 모두 보이게
   * 한다. 비었거나 없으면 routePath 1개로 폴백. backend 가 빈 leg 는 skip 하므로
   * 길이가 항상 waypoints+1 은 아님 — 받은 그대로 iterate.
   */
  routeSections?: LatLng[][] | null;
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
  /**
   * 선택된 마커의 "오늘" 혼잡도 state (OK / BUSY / PACK). 마커 클릭 시 부모가
   * 한국관광공사 혼잡도 API 응답을 받아 이 prop 으로 흘려보내면 active 마커
   * 의 bubble 색이 해당 색(녹/황/적) 으로 바뀐다. null/undefined 이면 기존
   * 다크 네이비 active 톤 유지 — fetch 전 / 매핑 실패 / 외부 API 실패 폴백.
   */
  selectedCrowdState?: 'OK' | 'BUSY' | 'PACK' | null;
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
let routePolylines: AnyObj[] = [];
let routeArrows: AnyObj[] = [];

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
  if (m.orderIndex != null) classes.push('numbered');
  // active 마커일 때 혼잡도 state 가 들어와 있으면 색상 클래스 부여 — CSS 가
  // bubble 배경을 OK 녹/BUSY 황/PACK 적 으로 덮어쓴다. fetch 전이면 prop 가
  // null 이라 클래스 없음 → 기존 active 다크 네이비 그대로.
  if (isActive && props.selectedCrowdState) {
    classes.push(`crowd-${props.selectedCrowdState.toLowerCase()}`);
  }
  root.className = classes.join(' ');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const dot = document.createElement('span');
  dot.className = 'dot';
  // task #21 — orderIndex 와 visited 가 동시에 있으면 둘 다 노출. 메인 dot
  // 텍스트는 순번, 우하단에 작은 ✓ tick 배지를 얹음(.tick absolute).
  // orderIndex 없는 일반 마커는 기존 visited(✓) / 기본(●) 분기 그대로.
  if (m.orderIndex != null) {
    dot.textContent = String(m.orderIndex);
    if (isVisited) {
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.textContent = '✓';
      dot.appendChild(tick);
    }
  } else if (isVisited) {
    dot.textContent = '✓';
  } else {
    dot.textContent = '●';
  }
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
      const isActive = props.selectedId === m.id;
      const isVisited = visitedSet.has(m.id);
      const content = buildPinContent(m, isVisited, isActive);
      // CustomOverlay 끼리 stacking — 카카오 기본은 생성 순서라 늦게 그려진 마커가
      // 활성 마커를 가린다. 명시적 zIndex 로 활성(100) > 클러스터(2) > 방문(5) > 일반(1)
      // 순서로 고정. CSS `.pin.active { z-index: 5 }` 는 같은 overlay 내부 .bubble/.dot
      // 간 stacking 보강용으로 그대로 둔다(overlay 끼리에는 영향 없음).
      const overlay = new k.maps.CustomOverlay({
        position,
        content,
        yAnchor: 1,
        clickable: true,
        zIndex: isActive ? 100 : isVisited ? 5 : 1,
      });
      const setMap = (overlay as unknown as { setMap: (v: unknown) => void }).setMap;
      setMap.call(overlay, mapInstance);
      overlays.push(overlay);
      return;
    }

    // Cluster overlay — 활성 마커(100) 보다 뒤로.
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
      zIndex: 2,
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
    // chevron 간격이 화면 픽셀 기준이라 zoom 이 바뀌면 재배치 필요.
    renderRoute();
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

/**
 * 두 점 사이의 진북 기준 bearing(deg, 0=북, 시계방향). chevron SVG 가 기본 북향
 * (▲) 이라 이 값을 그대로 `transform: rotate(${bearing}deg)` 에 꽂으면 진행
 * 방향을 가리킨다.
 */
function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number): number => (v * Math.PI) / 180;
  const toDeg = (v: number): number => (v * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function buildArrowContent(bearing: number): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'route-arrow';
  wrap.style.transform = `rotate(${bearing}deg)`;
  // viewBox 8x8 안에 base=6 / height=5.2 정삼각형(북향). strokeWeight=8 라인의
  // 외접원 지름 8 안에 어떤 회전 각도에서도 안전(외접원 ~6.93). 흰 반투명 78%,
  // stroke 없음.
  wrap.innerHTML =
    '<svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">' +
    '<path d="M4 1.4 L7 6.6 L1 6.6 Z" fill="rgba(255,255,255,0.78)"/>' +
    '</svg>';
  return wrap;
}

/**
 * 한 leg 의 좌표 path 를 픽셀 공간에서 perpendicular 으로 offsetPx 만큼 밀어
 * 다시 lat/lng 로 복원. 각 vertex 에서 prev→next 방향(끝점은 현재 segment)
 * 의 90도 회전 단위벡터 × offsetPx 만큼 이동. proj 없으면 원본 그대로 반환.
 */
function shiftPathPerpendicular(
  coords: LatLng[],
  offsetPx: number,
  proj: {
    containerPointFromCoords: (ll: unknown) => { x: number; y: number };
    coordsFromContainerPoint: (pt: unknown) => { getLat: () => number; getLng: () => number };
  } | null,
  k: {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      Point: new (x: number, y: number) => unknown;
    };
  },
): LatLng[] {
  if (!proj || offsetPx === 0 || coords.length < 2) return coords;
  const pxs = coords.map((c) =>
    proj.containerPointFromCoords(new k.maps.LatLng(c.lat, c.lng)),
  );
  return coords.map((_, i) => {
    // 각 vertex 의 진행 방향 — 양 끝은 인접 segment, 중간은 prev→next 평균.
    const prev = pxs[Math.max(0, i - 1)];
    const next = pxs[Math.min(pxs.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    // 90도 회전 단위벡터 (시계방향 +offset → 우측으로 밀림).
    const nx = -dy / len;
    const ny = dx / len;
    // Kakao SDK 의 coordsFromContainerPoint 는 plain {x,y} 가 아닌 kakao.maps.Point
    // 인스턴스를 요구한다(plain object 면 내부 getter 호출 시 "b.e is not a function").
    const shiftedPt = new k.maps.Point(
      pxs[i].x + nx * offsetPx,
      pxs[i].y + ny * offsetPx,
    );
    const ll = proj.coordsFromContainerPoint(shiftedPt);
    return { lat: ll.getLat(), lng: ll.getLng() };
  });
}

function renderRoute(): void {
  // polyline + chevron 모두 교체 — 둘 다 path 에 종속이라 함께 lifetime 관리.
  routePolylines.forEach((p) => {
    (p as unknown as { setMap: (m: unknown) => void }).setMap(null);
  });
  routePolylines = [];
  routeArrows.forEach((a) => {
    (a as unknown as { setMap: (m: unknown) => void }).setMap(null);
  });
  routeArrows = [];

  if (!kakao || !mapInstance) return;
  const path = props.routePath ?? [];
  if (path.length < 2) return;
  const k = kakao as unknown as {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      Point: new (x: number, y: number) => unknown;
      Polyline: new (opts: unknown) => AnyObj;
      CustomOverlay: new (opts: unknown) => AnyObj;
    };
  };

  const proj = (mapInstance as unknown as {
    getProjection?: () => {
      containerPointFromCoords: (ll: unknown) => { x: number; y: number };
      coordsFromContainerPoint: (pt: unknown) => { getLat: () => number; getLng: () => number };
    };
  }).getProjection?.() ?? null;

  // sections 가 비었거나 1개면 path 단일 list 폴백 (offset 0). 여러 leg 이면
  // 각 leg 를 별도 polyline 으로 그리되 가운데 0 기준 ±양쪽 4px 씩 분배해
  // 같은 도로 위 두 leg 가 겹치지 않게.
  const rawSections = props.routeSections && props.routeSections.length >= 1
    ? props.routeSections.filter((s) => s.length >= 2)
    : [path];
  const sections = rawSections.length >= 1 ? rawSections : [path];
  const n = sections.length;
  const OFFSET_STEP_PX = 4;
  // chevron 픽셀 간격 — 8px chevron 1.5개 크기. 이전(arrow×3=18px) 보다 촘촘하게.
  const INTERVAL_PX = 12;

  for (let i = 0; i < n; i++) {
    const section = sections[i];
    const offsetPx = (i - (n - 1) / 2) * OFFSET_STEP_PX;
    const shifted = shiftPathPerpendicular(section, offsetPx, proj, k);
    const polyline = new k.maps.Polyline({
      path: shifted.map((pt) => new k.maps.LatLng(pt.lat, pt.lng)),
      strokeWeight: 8,
      strokeColor: '#14BCED',
      strokeOpacity: 0.9,
      strokeStyle: 'solid',
    });
    (polyline as unknown as { setMap: (m: unknown) => void }).setMap(mapInstance);
    routePolylines.push(polyline);

    // chevron 을 EACH section 의 shifted path 위에 직접 배치.
    // 가운데 flat path 에 한 번만 그리면 perpendicular offset 적용된 polyline
    // 들 사이 중간에 떠서 어느 line 에도 안 붙은 것처럼 보였다(특히 두 leg 가
    // 겹칠 때 한쪽으로 치우쳐 보이는 증상). 각 leg 마다 자기 폴리라인 위에
    // 진행 방향 chevron 이 있어야 자연스럽다.
    if (proj) drawChevronsOnPath(shifted, proj, k, INTERVAL_PX);
  }
}

/**
 * 한 path 위에 화면 픽셀 기준 일정 간격으로 chevron CustomOverlay 들을 배치.
 * segment 단위로 walk 하면서 누적 픽셀 거리(acc) 를 INTERVAL 마다 끊어 좌표
 * 보간(t) 으로 segment 중간에도 정확한 간격에 떨어지게 한다.
 *
 * coords 는 이미 perpendicular offset 이 적용된 좌표 — bearing 도 그 좌표
 * 에서 계산해 회전된 라인의 진행 방향과 일치시킨다.
 */
function drawChevronsOnPath(
  coords: LatLng[],
  proj: {
    containerPointFromCoords: (ll: unknown) => { x: number; y: number };
    coordsFromContainerPoint: (pt: unknown) => { getLat: () => number; getLng: () => number };
  },
  k: {
    maps: {
      LatLng: new (lat: number, lng: number) => unknown;
      Point: new (x: number, y: number) => unknown;
      CustomOverlay: new (opts: unknown) => AnyObj;
    };
  },
  intervalPx: number,
): void {
  if (coords.length < 2) return;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const aPx = proj.containerPointFromCoords(new k.maps.LatLng(a.lat, a.lng));
    const bPx = proj.containerPointFromCoords(new k.maps.LatLng(b.lat, b.lng));
    const dx = bPx.x - aPx.x;
    const dy = bPx.y - aPx.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const bearing = computeBearing(a.lat, a.lng, b.lat, b.lng);

    let cursor = intervalPx - acc;
    while (cursor < segLen) {
      const t = cursor / segLen;
      const lat = a.lat + (b.lat - a.lat) * t;
      const lng = a.lng + (b.lng - a.lng) * t;
      const overlay = new k.maps.CustomOverlay({
        position: new k.maps.LatLng(lat, lng),
        content: buildArrowContent(bearing),
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 3,
        clickable: false,
      });
      (overlay as unknown as { setMap: (m: unknown) => void }).setMap(mapInstance);
      routeArrows.push(overlay);
      cursor += intervalPx;
    }
    acc = (acc + segLen) % intervalPx;
  }
}

watch(renderables, () => renderOverlays(), { deep: true });
watch(() => props.visitedIds, () => renderOverlays(), { deep: true });
// 혼잡도 응답이 비동기로 도착하면 active marker 색만 바뀌어야 하므로 watch
// 후 redraw. selectedId / markers 변화는 renderables 가 이미 잡아주므로 여기
// 서는 selectedCrowdState 만 추적.
watch(() => props.selectedCrowdState, () => renderOverlays());
// userLocation 이 비동기로 채워질 수 있으므로 (권한 프롬프트 후 응답) 변화
// 시 overlays 를 다시 그려 me 점을 갱신/제거한다. deep 으로 좌표 값 추적.
watch(() => props.userLocation, () => renderOverlays(), { deep: true });
watch(() => props.routePath, () => renderRoute(), { deep: true });
watch(() => props.routeSections, () => renderRoute(), { deep: true });
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
  routePolylines.forEach((p) => {
    (p as unknown as { setMap: (m: unknown) => void }).setMap(null);
  });
  routePolylines = [];
  routeArrows.forEach((a) => {
    (a as unknown as { setMap: (m: unknown) => void }).setMap(null);
  });
  routeArrows = [];
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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* min-width 로 1자리 숫자/`●` 는 18px 원, 2자리는 가로로 살짝 늘어나는 pill. */
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--fr-primary);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}
/* task #21 — orderIndex 와 visited 동시 노출 시 우하단에 작은 mint ✓ 배지.
   tick 은 dot 의 absolute 자식. 작은 흰 외곽으로 dot 색과 분리. */
.kakao-map .pin .dot .tick {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--fr-mint, #10b981);
  color: #ffffff;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px #ffffff;
}
.kakao-map .pin.visited .dot { background: var(--fr-mint); }
.kakao-map .pin.active { z-index: 5; }
.kakao-map .pin.active .dot { background: #0f172a; transform: scale(1.1); }
.kakao-map .pin.active .bubble { background: #0f172a; color: #ffffff; }
.kakao-map .pin.active .bubble::after { background: #0f172a; box-shadow: none; }

/* 선택된 마커 + 한국관광공사 오늘 혼잡도 state — bubble 배경 색을 덮어써
   사용자가 한 눈에 "이 곳 오늘 한가/혼잡" 파악 가능. dot 은 화이트 (오버레이
   가독) , bubble bg 는 OK 녹 / BUSY 황 / PACK 적 그라데이션. tail (.bubble::after)
   도 같은 톤으로 매칭해 fade 안 보이게. */
.kakao-map .pin.active.crowd-ok .bubble,
.kakao-map .pin.active.crowd-ok .bubble::after {
  background: linear-gradient(135deg, #4ade80, #16a34a);
}
.kakao-map .pin.active.crowd-busy .bubble,
.kakao-map .pin.active.crowd-busy .bubble::after {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}
.kakao-map .pin.active.crowd-pack .bubble,
.kakao-map .pin.active.crowd-pack .bubble::after {
  background: linear-gradient(135deg, #f87171, #ef4444);
}
.kakao-map .pin.active.crowd-ok .dot,
.kakao-map .pin.active.crowd-busy .dot,
.kakao-map .pin.active.crowd-pack .dot {
  background: #ffffff;
  color: #0f172a;
}

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

/* 코스 polyline(strokeWeight=8) 위에 12px 픽셀 간격으로 흩뿌리는 진행 방향
   chevron. SVG ▲ 가 기본 북향이라 인라인 transform: rotate(bearing) 으로
   진행 방향 가리킴. wrapper 8×8 + 내부 삼각형 6×5.2(외접원 ~6.93) → 어떤
   bearing 으로 회전해도 8px 라인 안에 들어감. 흰 반투명이라 별도 drop-shadow
   불필요(노이즈만 더함). pointer-events:none — 마커 클릭과 간섭 X. */
.kakao-map .route-arrow {
  width: 8px;
  height: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
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
