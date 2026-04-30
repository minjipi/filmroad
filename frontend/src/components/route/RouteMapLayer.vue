<template>
  <!-- KakaoMap 인프라(마커 클러스터링 / 폴리라인 dashed / fitBounds) 그대로 재사용.
       MapPage / WorkDetailPage 와 같은 props/emits 모양으로 호출하므로 추가 학습 비용
       없음. 코스 한 자리에 표기되는 마커는 출발/경유/도착이 시각적으로 구분되어야
       하지만 KakaoMap 의 기본 스타일은 단일톤(visited/active 한정)이라, 여기서는
       label 에 "S/E/N" prefix 를 박아 역할을 표현. 디자인의 컬러 분기는 다음 패스에서
       KakaoMap 에 marker variant 를 더하면서 보강하면 된다 — 이번 패스는 dashed
       routePath + 마커 클릭 emit 까지만. -->
  <KakaoMap
    :center="effectiveCenter"
    :zoom="effectiveZoom"
    :markers="markers"
    :selected-id="activeId"
    :visited-ids="[]"
    :user-location="userLocation"
    :route-path="effectiveRoutePath"
    :route-sections="routeSections"
    :fit-to="fitTo"
    @marker-click="(id) => emit('markerClick', id)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import KakaoMap from '@/components/map/KakaoMap.vue';
import type { MapMarker } from '@/stores/map';
import type { TripPlace } from '@/stores/tripRoute';

interface LatLng {
  lat: number;
  lng: number;
}

const props = withDefaults(
  defineProps<{
    /** 코스에 들어간 장소들. 0 번이 출발, 마지막이 도착. */
    places: TripPlace[];
    /** 현재 카드 활성 id — KakaoMap 의 selectedId 로 직결. null = 무선택. */
    activeId: number | null;
    /**
     * 카카오 줌 레벨(1=가장 가까움, 14=가장 멈). 부모(TripRoutePage) 가 ±버튼/locate
     * 에 따라 ref 로 들고 있고, 이 컴포넌트는 단방향으로만 받는다. fitTo 가 채워지면
     * KakaoMap 측이 setBounds 로 일시 덮어쓰므로 첫 프레임 시드 용도에 가깝다.
     */
    zoom?: number;
    /** 명시적 center — locate 후 GPS 좌표로 viewport 를 옮길 때 부모가 갱신. */
    center?: LatLng | null;
    /** "You are here" 점. null 이면 미렌더. */
    userLocation?: LatLng | null;
    /**
     * 카카오 모빌리티 도로 경로. 길이 ≥ 2 면 그대로 사용하고, 비었거나 1점만
     * 있으면 places 좌표로 직선 폴백. store(`tripRoute.routePath`) 가 단일 소스.
     */
    routePath?: LatLng[] | null;
    /**
     * leg 별 좌표 — KakaoMap 이 같은 도로 두 번 지나가는 코스를 perpendicular
     * offset 으로 분리해 그릴 때 사용. 빈 배열이면 routePath 1개로 폴백.
     */
    routeSections?: LatLng[][] | null;
  }>(),
  { zoom: 7, center: null, userLocation: null, routePath: null, routeSections: null },
);

const emit = defineEmits<{ (e: 'markerClick', id: number): void }>();

/**
 * 마커 한 칸 — KakaoMap 이 기대하는 MapMarker 형태로 변환. orderIndex(1-based)
 * 를 넘겨 KakaoMap 의 dot 안에 순번이 표시되게 한다. 이전엔 label prefix("01·")
 * 로 표시했지만 dot 으로 옮기면서 중복이 돼 라벨에서는 제거.
 */
const markers = computed<MapMarker[]>(() =>
  props.places.map((p, i) => ({
    id: p.id,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    contentId: p.contentId,
    contentTitle: p.contentTitle,
    regionLabel: p.regionLabel,
    distanceKm: null,
    orderIndex: i + 1,
  })),
);

/**
 * 폴리라인 path. 도로 경로(routePath prop)가 들어와 있으면 그것을, 아니면
 * places 좌표로 직선 폴백. KakaoMap 이 length<2 면 자동 미렌더 — 여기서 별도
 * 가드 안 둠. dashed 패턴은 KakaoMap.vue 에 'shortdash' 로 박혀 있어 별도
 * 옵션을 넘기지 않아도 된다. (team-lead 가이드: 라인은 dashed 만)
 */
const effectiveRoutePath = computed(() => {
  if (props.routePath && props.routePath.length >= 2) return props.routePath;
  return props.places.map((p) => ({ lat: p.latitude, lng: p.longitude }));
});

/** 모든 코스 점이 한 화면에 들어오게 fitBounds. 0~1 점이면 KakaoMap 측이 조용히 폴백. */
const fitTo = computed(() =>
  props.places.map((p) => ({ lat: p.latitude, lng: p.longitude })),
);

/**
 * 초기 center/zoom — KakaoMap 은 fitTo 가 채워지면 자동 setBounds 로 덮어쓴다.
 * 부모가 명시적 center 를 넘기면(예: locate 후 GPS 좌표) 그것을 우선 사용하고,
 * 아니면 첫 장소 좌표 → 한국 중심 순으로 폴백.
 */
const effectiveCenter = computed(() => {
  if (props.center) return props.center;
  const first = props.places[0];
  if (first) return { lat: first.latitude, lng: first.longitude };
  return { lat: 37.5665, lng: 126.978 };
});
const effectiveZoom = computed(() => props.zoom);
</script>

<style scoped>
/* 부모(TripRoutePage) 가 absolute layer 로 쌓아 올리니 별도 위치 지정은 부모 책임.
   KakaoMap 은 자체적으로 inset:0 을 차지하므로 빈 wrapper 만 두면 그대로 채워진다. */
</style>
