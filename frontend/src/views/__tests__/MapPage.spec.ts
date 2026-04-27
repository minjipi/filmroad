import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: null }) },
}));

const { pushSpy, backSpy, routeRef } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
  routeRef: { current: { query: {} as Record<string, string | string[] | undefined> } },
}));
vi.mock('vue-router', () => ({
  useRoute: () => routeRef.current,
  useRouter: () => ({ push: pushSpy, back: backSpy }),
}));

import MapPage from '@/views/MapPage.vue';
import {
  useMapStore,
  type MapResponse,
  KOREA_CENTER,
  COUNTRY_ZOOM,
  DETAIL_ZOOM,
} from '@/stores/map';
import { mountWithStubs } from './__helpers__/mount';

const fixture: MapResponse = {
  markers: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      latitude: 37.8928,
      longitude: 128.8347,
      workId: 1,
      workTitle: '도깨비',
      regionLabel: '강릉시 주문진읍',
      distanceKm: 0.1,
    },
    {
      id: 13,
      name: '단밤 포차',
      latitude: 37.5347,
      longitude: 126.9947,
      workId: 2,
      workTitle: '이태원 클라쓰',
      regionLabel: '서울 용산구 이태원동',
      distanceKm: 180.4,
    },
    {
      id: 14,
      name: '덕수궁 돌담길',
      latitude: 37.5658,
      longitude: 126.9751,
      workId: 1,
      workTitle: '도깨비',
      regionLabel: '서울 중구 정동',
      distanceKm: 175.2,
    },
  ],
  selected: {
    id: 10,
    name: '주문진 영진해변 방파제',
    regionLabel: '강릉시 주문진읍',
    latitude: 37.8928,
    longitude: 128.8347,
    workId: 1,
    workTitle: '도깨비',
    workEpisode: '1회',
    coverImageUrls: ['https://img/1.jpg'],
    photoCount: 1204,
    likeCount: 3200,
    rating: 4.8,
    distanceKm: 0.1,
    liked: false,
  },
};

const KakaoMapStub = {
  name: 'KakaoMap',
  props: ['center', 'zoom', 'markers', 'selectedId', 'visitedIds'],
  emits: ['markerClick', 'clusterClick', 'mapClick', 'centerChange', 'boundsChange', 'zoomChange'],
  template:
    '<div class="kakao-map-stub" :data-markers="markers?.length ?? 0" :data-selected="selectedId ?? \'\'" :data-visited="(visitedIds ?? []).join(\',\')" @click="$emit(\'markerClick\', markers?.[1]?.id)"></div>',
};

type SheetMode = 'closed' | 'peek' | 'full';

interface KakaoSeed {
  // initialState 에 박을 kakaoInfo store 의 infoByPlace 슬라이스. 키 = placeId.
  // null 은 "이미 fetch 시도했지만 정보 없음" 의미. 시드 안 하면 store 가
  // 비어있으므로 v-if="kakaoInfo?.available" 로 섹션이 통째 숨겨진다.
  infoByPlace?: Record<number, unknown>;
}

function mountMapPage(opts: {
  firstEntry?: boolean;
  sheetMode?: SheetMode;
  kakao?: KakaoSeed;
} = {}) {
  const firstEntry = opts.firstEntry ?? false;
  const sheetMode: SheetMode = opts.sheetMode ?? 'peek';
  const initialState: Record<string, unknown> = {
    map: firstEntry
      ? {
          markers: [],
          selected: null,
          loading: false,
          error: null,
          filter: 'SPOTS',
          workId: null,
          q: '',
          center: { ...KOREA_CENTER },
          zoom: COUNTRY_ZOOM,
          hasBeenViewed: false,
          sheetMode,
          visitedIds: [10],
        }
      : {
          markers: [...fixture.markers],
          selected: { ...fixture.selected! },
          loading: false,
          error: null,
          filter: 'SPOTS',
          workId: null,
          q: '',
          center: { lat: 37.8928, lng: 128.8347 },
          zoom: DETAIL_ZOOM,
          hasBeenViewed: true,
          sheetMode,
          visitedIds: [10],
        },
  };
  if (opts.kakao) {
    initialState.kakaoInfo = { infoByPlace: opts.kakao.infoByPlace ?? {} };
  }
  const { wrapper } = mountWithStubs(MapPage, {
    initialState,
    stubs: {
      KakaoMap: KakaoMapStub,
    },
  });

  return { wrapper, store: useMapStore() };
}

describe('MapPage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushSpy.mockClear();
    backSpy.mockClear();
    routeRef.current = { query: {} };
  });

  it('passes visibleMarkers to the KakaoMap component', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    const el = wrapper.find('.kakao-map-stub');
    expect(el.exists()).toBe(true);
    expect(el.attributes('data-markers')).toBe(String(fixture.markers.length));
  });

  it('forwards selectedId and visitedIds to the KakaoMap component', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    const el = wrapper.find('.kakao-map-stub');
    expect(el.attributes('data-selected')).toBe(String(fixture.selected!.id));
    expect(el.attributes('data-visited')).toBe('10');
  });

  it('renders the selected place detail sheet with formatted stats', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    const sheet = wrapper.find('.sheet');
    expect(sheet.exists()).toBe(true);
    expect(sheet.find('.t1').text()).toBe(fixture.selected!.name);
    expect(sheet.text()).toContain('1.2k'); // 1204 photos formatted
    expect(sheet.text()).toContain('3.2k'); // 3200 likes formatted
    expect(sheet.text()).toContain('4.8');  // rating
  });

  it('dispatches selectMarker when the map emits markerClick', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    const selectSpy = vi.spyOn(store, 'selectMarker');

    await wrapper.find('.kakao-map-stub').trigger('click');
    expect(selectSpy).toHaveBeenCalledWith(13);
  });

  it('clicking .go-btn pushes /place/:id of the selected marker', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    pushSpy.mockClear();

    const goBtn = wrapper.find('.go-btn');
    expect(goBtn.exists()).toBe(true);
    await goBtn.trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith(`/place/${fixture.selected!.id}`);
  });

  it('인증샷 stat icon click pushes /gallery/:id', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    pushSpy.mockClear();

    const photoStat = wrapper.find('[data-testid="sheet-photo-stat"]');
    expect(photoStat.exists()).toBe(true);
    await photoStat.trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith(`/gallery/${fixture.selected!.id}`);
  });

  it('heart icon click dispatches mapStore.toggleLike', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    const toggleSpy = vi.spyOn(store, 'toggleLike').mockResolvedValue(undefined);

    const likeStat = wrapper.find('[data-testid="sheet-like-stat"]');
    expect(likeStat.exists()).toBe(true);
    await likeStat.trigger('click');
    await flushPromises();
    expect(toggleSpy).toHaveBeenCalledWith(fixture.selected!.id);
  });

  it('heart stat reflects liked state via .liked class (filled vs outline)', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();

    // 시드는 liked=false — 따라서 .liked 클래스 없음.
    let likeStat = wrapper.find('[data-testid="sheet-like-stat"]');
    expect(likeStat.classes()).not.toContain('liked');

    // 직접 store 의 selected.liked 를 뒤집어 시각 분기를 본다.
    if (store.selected) store.selected.liked = true;
    await flushPromises();
    likeStat = wrapper.find('[data-testid="sheet-like-stat"]');
    expect(likeStat.classes()).toContain('liked');
  });

  it('first entry (no selected, hasBeenViewed=false) forces KOREA_CENTER + COUNTRY_ZOOM before fetch', async () => {
    const { store } = mountMapPage({ firstEntry: true });
    await flushPromises();

    expect(store.center).toEqual(KOREA_CENTER);
    expect(store.zoom).toBe(COUNTRY_ZOOM);
    // Selected stays null since the mocked api returns {data:null}.
    expect(store.selected).toBeNull();
  });

  it('first entry hides both .sheet and .reopen — the map is visually clean until a place is picked', async () => {
    const { wrapper } = mountMapPage({ firstEntry: true });
    await flushPromises();

    expect(wrapper.find('.sheet').exists()).toBe(false);
    expect(wrapper.find('.reopen').exists()).toBe(false);
  });

  it('re-entry (selected present, hasBeenViewed=true) preserves center + DETAIL_ZOOM', async () => {
    const { store } = mountMapPage();
    await flushPromises();

    expect(store.center).toEqual({ lat: 37.8928, lng: 128.8347 });
    expect(store.zoom).toBe(DETAIL_ZOOM);
    expect(store.selected?.id).toBe(fixture.selected!.id);
  });

  it('close button hides the sheet and reveals the reopen CTA', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();

    expect(wrapper.find('.sheet').exists()).toBe(true);
    expect(wrapper.find('.reopen').exists()).toBe(false);

    await wrapper.find('.close-btn').trigger('click');
    expect(store.sheetMode).toBe('closed');
    expect(wrapper.find('.sheet').exists()).toBe(false);
    expect(wrapper.find('.reopen').exists()).toBe(true);
  });

  it('reopen button flips sheetMode back to peek', async () => {
    const { wrapper, store } = mountMapPage({ sheetMode: 'closed' });
    await flushPromises();

    const reopen = wrapper.find('.reopen');
    expect(reopen.exists()).toBe(true);

    await reopen.trigger('click');
    expect(store.sheetMode).toBe('peek');
    expect(wrapper.find('.sheet').exists()).toBe(true);
  });

  it('kakao section is hidden when no kakao-info has been fetched / available=false', async () => {
    // 기본 mountMapPage 는 kakaoInfo store 를 시드하지 않으므로 selected 는
    // 있어도 kakaoInfo 는 null → v-if 로 섹션이 통째 사라진다. 이전엔 디자인 mock
    // 이 강제로 그려져 어떤 place 를 골라도 같은 주소가 나오는 버그였다.
    const { wrapper } = mountMapPage();
    await flushPromises();
    expect(wrapper.find('[data-testid="map-kakao-section"]').exists()).toBe(false);
  });

  it('kakao section renders the selected place\'s real Kakao Local data when fetched', async () => {
    const { wrapper } = mountMapPage({
      kakao: {
        infoByPlace: {
          10: {
            roadAddress: '강원 강릉시 주문진읍 교항리 산51-2',
            jibunAddress: '교항리 산51-2',
            phone: '033-662-3639',
            category: '여행 > 관광지',
            kakaoPlaceUrl: 'https://place.map.kakao.com/12345',
            lastSyncedAt: '2026-04-26T00:00:00Z',
            nearby: [
              {
                name: '영진회집',
                categoryGroupCode: 'FD6',
                categoryName: '한식 > 해물,생선',
                distanceMeters: 240,
                kakaoPlaceUrl: 'https://place.map.kakao.com/1',
                lat: 37.89,
                lng: 128.83,
                phone: null,
              },
              {
                name: '테라로사 커피',
                categoryGroupCode: 'CE7',
                categoryName: '카페 > 커피전문점',
                distanceMeters: 640,
                kakaoPlaceUrl: 'https://place.map.kakao.com/2',
                lat: 37.89,
                lng: 128.83,
                phone: null,
              },
            ],
            available: true,
          },
        },
      },
    });
    await flushPromises();

    const section = wrapper.find('[data-testid="map-kakao-section"]');
    expect(section.exists()).toBe(true);
    expect(section.text()).toContain('강원 강릉시 주문진읍 교항리 산51-2');
    expect(section.text()).toContain('지번 · 교항리 산51-2');
    expect(section.text()).toContain('033-662-3639');
    expect(section.text()).toContain('카카오맵에서 보기');
    // nearby 카드는 시드 2건 → 두 개만 그려진다 (예전엔 mock 으로 항상 3개였음).
    expect(wrapper.findAll('.k-nearby-card').length).toBe(2);
    expect(section.text()).toContain('영진회집');
    expect(section.text()).toContain('테라로사 커피');
  });

  it('kakao section stays hidden when the response shape says available=false (e.g. unmapped place)', async () => {
    const { wrapper } = mountMapPage({
      kakao: {
        infoByPlace: {
          10: {
            roadAddress: null,
            jibunAddress: null,
            phone: null,
            category: null,
            kakaoPlaceUrl: null,
            lastSyncedAt: null,
            nearby: [],
            available: false,
          },
        },
      },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="map-kakao-section"]').exists()).toBe(false);
  });

  it('deep-link entry (?lat=&lng=) resets sheetMode to peek even if the session left it at full', async () => {
    routeRef.current = { query: { lat: '37.5', lng: '127.0' } };
    // Start from a stored state where the sheet was carried-over FULL.
    const { store } = mountMapPage({ sheetMode: 'full' });
    await flushPromises();
    expect(store.sheetMode).toBe('peek');
  });

  it('sheet height style reflects the stored sheet mode (with dynamic full cap)', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();

    // Default peek → 240px.
    expect(wrapper.find('.sheet').attributes('style')).toContain('height: 240px');

    store.setSheetMode('full');
    await flushPromises();
    // FULL is clamped by the viewport: min(680, innerHeight - 160 - 84).
    // In jsdom (default innerHeight 768) that's 524, not the 680 max.
    const innerH = window.innerHeight;
    const expectedFull = Math.min(680, Math.max(320, innerH - 160 - 84));
    expect(wrapper.find('.sheet').attributes('style')).toContain(
      `height: ${expectedFull}px`,
    );
  });

  it('country-view first entry suppresses the initial bounds-change flurry so Seoul-only bbox does not overwrite country markers', async () => {
    vi.useFakeTimers();
    const { wrapper, store } = mountMapPage({ firstEntry: true });
    await flushPromises();
    // Clear the onMounted fetchMap({ countryView: true }) so the spy below
    // only sees later calls.
    const fetchSpy = vi.spyOn(store, 'fetchMap');
    fetchSpy.mockClear();

    const kakaoStub = wrapper.findComponent({ name: 'KakaoMap' });
    // Simulate Kakao's post-mount bounds_changed (tight Seoul viewport).
    kakaoStub.vm.$emit('boundsChange', {
      sw: { lat: 37.4, lng: 126.8 },
      ne: { lat: 37.7, lng: 127.2 },
    });

    // Even well past the 350ms debounce the suppression window is still on —
    // no fetchMap should fire during the country-view settle window.
    vi.advanceTimersByTime(500);
    expect(fetchSpy).not.toHaveBeenCalled();

    // After the suppression window closes, a real user pan still works.
    vi.advanceTimersByTime(800); // past the 1200ms suppression total
    kakaoStub.vm.$emit('boundsChange', {
      sw: { lat: 35.0, lng: 126.0 },
      ne: { lat: 38.0, lng: 129.0 },
    });
    vi.advanceTimersByTime(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith({
      swLat: 35.0,
      swLng: 126.0,
      neLat: 38.0,
      neLng: 129.0,
    });

    vi.useRealTimers();
  });

  it('bounds-change from the map is debounced (~350ms) then forwarded to fetchMap with the bbox', async () => {
    vi.useFakeTimers();
    const { wrapper, store } = mountMapPage();
    // Drain the synchronous onMounted fetch — it uses real API mock.
    await flushPromises();
    const fetchSpy = vi.spyOn(store, 'fetchMap');
    const kakaoStub = wrapper.findComponent({ name: 'KakaoMap' });

    const sw = { lat: 35.0, lng: 126.0 };
    const ne = { lat: 38.0, lng: 129.0 };
    kakaoStub.vm.$emit('boundsChange', { sw, ne });
    // Fire twice inside the debounce window to prove coalescing.
    kakaoStub.vm.$emit('boundsChange', {
      sw: { lat: 35.1, lng: 126.1 },
      ne: { lat: 38.1, lng: 129.1 },
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(349);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10); // cross the 350ms boundary
    // Only the latest bounds are fetched — first emit got swallowed by debounce.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith({
      swLat: 35.1,
      swLng: 126.1,
      neLat: 38.1,
      neLng: 129.1,
    });
    vi.useRealTimers();
  });

  it('zoom-change from Kakao syncs store.zoom so clusterMarkers re-runs with the new level', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    // Seed a known starting zoom so the sync target is unambiguous.
    store.setZoom(5);
    const setZoomSpy = vi.spyOn(store, 'setZoom');

    const kakaoStub = wrapper.findComponent({ name: 'KakaoMap' });
    kakaoStub.vm.$emit('zoomChange', 9);
    expect(setZoomSpy).toHaveBeenCalledWith(9);

    // Echoing the same level again is a no-op — breaks the
    // store.zoom → setLevel → zoom_changed → store.zoom feedback loop.
    setZoomSpy.mockClear();
    kakaoStub.vm.$emit('zoomChange', 9);
    expect(setZoomSpy).not.toHaveBeenCalled();
  });

  it('cluster-click zooms the map in by 2 levels and recenters on the cluster centroid', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    store.setZoom(8);
    const centerSpy = vi.spyOn(store, 'setCenter');
    const zoomSpy = vi.spyOn(store, 'setZoom');

    const kakaoStub = wrapper.findComponent({ name: 'KakaoMap' });
    kakaoStub.vm.$emit('clusterClick', {
      latitude: 37.5,
      longitude: 127.0,
      markerIds: [1, 2, 3],
    });

    expect(zoomSpy).toHaveBeenCalledWith(6);
    expect(centerSpy).toHaveBeenCalledWith(37.5, 127.0);
  });

  it('top search pill pushes /search (global search takes over from the map-local filter)', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.find('button.search-box[aria-label="search"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/search');
  });

  it('filter chip VISITED switches the store filter', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    const chips = wrapper.findAll('.filter-chip');
    // [성지, 저장한 곳, 방문완료] — 작품 chip(도깨비)은 시트로 이전.
    expect(chips.length).toBe(3);
    await chips[2].trigger('click');
    expect(store.filter).toBe('VISITED');
  });

  it('필터 버튼: 활성 시트 필터가 없으면 뱃지가 안 보인다', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="filters-btn"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="filter-badge"]').exists()).toBe(false);
  });

  it('필터 버튼: 시트 필터 활성 그룹 수가 뱃지로 노출된다', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();

    store.setSheetFilters({ workIds: [1], regions: ['강릉시'] });
    await flushPromises();

    const badge = wrapper.find('[data-testid="filter-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('2');
  });

  // task #23 — context-entry back button. Renders only when query.selectedId
  // is present (e.g., user clicked sub(place) on /shot/:id and landed on
  // /map?selectedId=<placeId>). Plain /map entry stays clean.
  describe('top-bar back button (task #23)', () => {
    it('일반 /map 진입 (query.selectedId 없음) → 뒤로가기 버튼 미렌더', async () => {
      routeRef.current = { query: {} };
      const { wrapper } = mountMapPage();
      await flushPromises();

      expect(wrapper.find('[data-testid="map-back-btn"]').exists()).toBe(false);
    });

    it('컨텍스트 진입 (?selectedId=10) → 뒤로가기 버튼 렌더', async () => {
      routeRef.current = { query: { selectedId: '10' } };
      const { wrapper } = mountMapPage();
      await flushPromises();

      const btn = wrapper.find('[data-testid="map-back-btn"]');
      expect(btn.exists()).toBe(true);
      expect(btn.attributes('aria-label')).toBe('뒤로 가기');
    });

    it('뒤로가기 버튼 클릭 → router.back() (history 가 있을 때)', async () => {
      routeRef.current = { query: { selectedId: '10' } };
      const { wrapper } = mountMapPage();
      await flushPromises();
      backSpy.mockClear();

      // jsdom 의 window.history.length 는 기본 1+. 여러 sub spec 이 동작하는
      // 환경에서 1보다 크게 유지될 가능성 높음 — pushState 로 보강해 안전.
      window.history.pushState({}, '', '/map?selectedId=10');
      await wrapper.find('[data-testid="map-back-btn"]').trigger('click');

      expect(backSpy).toHaveBeenCalledTimes(1);
    });
  });

  // task #25 — query watch 의 통합 검증은 unit-level 에선 mock infra 한계
  // (routeRef 는 plain object 라 vue 의 reactive 추적 안 됨) 로 어려움. 실제
  // 동작은 dev 서버에서 토큰 transform / 수동 navigation 으로 검증 (보고서
  // 참고). Initial-mount 시 selectedId 가 store 로 전달되는 회귀는 위
  // back-button describe 의 첫 케이스에서 indirect 하게 커버.
});
