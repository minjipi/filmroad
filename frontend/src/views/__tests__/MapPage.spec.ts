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
    coverImageUrl: 'https://img/1.jpg',
    photoCount: 1204,
    likeCount: 3200,
    rating: 4.8,
    distanceKm: 0.1,
  },
};

const KakaoMapStub = {
  name: 'KakaoMap',
  props: ['center', 'zoom', 'markers', 'selectedId', 'visitedIds'],
  emits: ['markerClick', 'mapClick', 'centerChange'],
  template:
    '<div class="kakao-map-stub" :data-markers="markers?.length ?? 0" :data-selected="selectedId ?? \'\'" :data-visited="(visitedIds ?? []).join(\',\')" @click="$emit(\'markerClick\', markers?.[1]?.id)"></div>',
};

type SheetMode = 'closed' | 'peek' | 'full';

function mountMapPage(opts: { firstEntry?: boolean; sheetMode?: SheetMode } = {}) {
  const firstEntry = opts.firstEntry ?? false;
  const sheetMode: SheetMode = opts.sheetMode ?? 'peek';
  const { wrapper } = mountWithStubs(MapPage, {
    initialState: {
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
            savedIds: [],
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
            savedIds: [],
          },
    },
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

  it('first entry (no selected, hasBeenViewed=false) forces KOREA_CENTER + COUNTRY_ZOOM before fetch', async () => {
    const { store } = mountMapPage({ firstEntry: true });
    await flushPromises();

    expect(store.center).toEqual(KOREA_CENTER);
    expect(store.zoom).toBe(COUNTRY_ZOOM);
    // Selected stays null since the mocked api returns {data:null}.
    expect(store.selected).toBeNull();
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

  it('kakao section rendered inside sheet body (full-state content)', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();

    const section = wrapper.find('.kakao-section');
    expect(section.exists()).toBe(true);
    // Mock content from design doc surfaces for the demo:
    expect(section.text()).toContain('강원 강릉시 주문진읍 교항리 산51-2');
    expect(section.text()).toContain('033-662-3639');
    expect(wrapper.findAll('.k-rev-item').length).toBe(2);
    expect(wrapper.findAll('.k-nearby-card').length).toBe(3);
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

  it('filter chip VISITED switches the store filter', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    const chips = wrapper.findAll('.filter-chip');
    // [성지, 방문완료, 저장한 곳, 도깨비]
    await chips[1].trigger('click');
    expect(store.filter).toBe('VISITED');
  });
});
