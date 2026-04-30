import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// `/api/route/init` mock — TripRoutePage 가 onMounted 에서 호출하는
// tripRouteStore.seedFromContent 를 통해 도달한다. 5개 places 를 강원도 좌표대로
// 돌려주면 store 가 그대로 코스에 채운다. vi.mock 의 factory 가 hoist 되므로
// 픽스처는 vi.hoisted 안에서 정의해야 참조가 가능하다.
const { routeInitFixture } = vi.hoisted(() => ({
  routeInitFixture: {
    content: { id: 1, title: '겨울연가', posterUrl: null },
    suggestedName: '겨울연가 코스',
    suggestedStartTime: '09:00',
    places: [
      { placeId: 90001, name: '남이섬', regionLabel: '강원 춘천 남산면', address: null, latitude: 37.7903, longitude: 127.5253, coverImageUrl: null, sceneImageUrl: null, durationMin: 120, rating: 4.6, visited: false, visitedAt: null },
      { placeId: 90002, name: '강촌 레일파크', regionLabel: '강원 춘천 신동면', address: null, latitude: 37.8237, longitude: 127.6151, coverImageUrl: null, sceneImageUrl: null, durationMin: 90, rating: 4.5, visited: false, visitedAt: null },
      { placeId: 90003, name: '명동 닭갈비', regionLabel: '강원 춘천 명동', address: null, latitude: 37.8813, longitude: 127.7299, coverImageUrl: null, sceneImageUrl: null, durationMin: 75, rating: 4.7, visited: false, visitedAt: null },
      { placeId: 90004, name: '소양강 스카이워크', regionLabel: '강원 춘천 근화동', address: null, latitude: 37.8961, longitude: 127.7129, coverImageUrl: null, sceneImageUrl: null, durationMin: 45, rating: 4.3, visited: false, visitedAt: null },
      { placeId: 90005, name: '구봉산 전망대', regionLabel: '강원 춘천 동면', address: null, latitude: 37.9023, longitude: 127.7826, coverImageUrl: null, sceneImageUrl: null, durationMin: 60, rating: 4.8, visited: false, visitedAt: null },
    ],
  },
}));

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/services/route', () => ({
  fetchDirections: vi.fn().mockResolvedValue({
    available: false,
    path: [],
    sections: [],
    distanceMeters: null,
    durationSec: null,
  }),
  fetchRouteInit: vi.fn().mockResolvedValue(routeInitFixture),
  saveRoute: vi.fn(),
  updateRoute: vi.fn(),
  loadRoute: vi.fn(),
  listMyRoutes: vi.fn(),
  deleteRoute: vi.fn(),
}));

const { pushSpy, backSpy, queryRef } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
  queryRef: { value: {} as Record<string, string> },
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, back: backSpy }),
  useRoute: () => ({ query: queryRef.value, params: {} }),
}));

const { toastCreateSpy, ionViewEnterCb } = vi.hoisted(() => ({
  toastCreateSpy: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
  // jsdom 에선 Ionic 라우터 lifecycle 이 자동 발동 안 함. 등록된 callback 을 잡아
  // 테스트에서 수동으로 부른다.
  ionViewEnterCb: { current: null as (() => void) | null },
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return {
    ...actual,
    toastController: { create: toastCreateSpy },
    onIonViewDidEnter: (cb: () => void) => {
      ionViewEnterCb.current = cb;
    },
  };
});

// KakaoMap 은 jsdom 에서 SDK 를 못 띄우므로 가벼운 stub 으로 대체. 실제 props
// 의 흐름(markers/routePath/fitTo/selectedId)만 attribute 로 노출해 검증 가능하게.
vi.mock('@/components/map/KakaoMap.vue', () => ({
  default: {
    name: 'KakaoMap',
    props: ['center', 'zoom', 'markers', 'selectedId', 'visitedIds', 'userLocation', 'routePath', 'fitTo'],
    emits: ['markerClick'],
    template:
      '<div class="kakao-map-stub" :data-marker-count="markers?.length ?? 0" :data-route-len="routePath?.length ?? 0" :data-selected-id="selectedId ?? \'\'" :data-zoom="zoom"></div>',
  },
}));

import TripRoutePage from '@/views/TripRoutePage.vue';
import { useTripRouteStore } from '@/stores/tripRoute';
import { mountWithStubs } from './__helpers__/mount';

function mountPage(query: Record<string, string> = {}) {
  queryRef.value = query;
  return mountWithStubs(TripRoutePage, {
    props: {},
  });
}

describe('TripRoutePage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
    queryRef.value = {};
  });

  it('seeds the store from query (contentId, contentTitle) on mount and renders 5 mock cards', async () => {
    const { wrapper } = mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();

    const store = useTripRouteStore();
    expect(store.seedContentId).toBe(1);
    expect(store.seedContentTitle).toBe('겨울연가');
    expect(store.placeIds.length).toBe(5);

    // 카드 5장 + "추가" dashed 카드 1장 = 6.
    const cards = wrapper.findAll('.rt-card');
    expect(cards.length).toBe(5);
    expect(wrapper.find('[data-testid="rt-add-card"]').exists()).toBe(true);

    // 카카오맵 stub 은 markers 5개 + routePath 5점 + selected 첫 id 로 props 받았는지.
    const map = wrapper.find('.kakao-map-stub');
    expect(map.attributes('data-marker-count')).toBe('5');
    expect(map.attributes('data-route-len')).toBe('5');
    expect(map.attributes('data-selected-id')).toBe(String(store.placeIds[0]));
  });

  it('opens the search modal when the topbar search button is tapped', async () => {
    const { wrapper } = mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();

    expect(wrapper.find('[data-testid="rt-search-overlay"]').exists()).toBe(false);
    await wrapper.find('[data-testid="tr-search-trigger"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="rt-search-overlay"]').exists()).toBe(true);
  });

  it('marker click on the map updates store.activeId (drives the timeline highlight)', async () => {
    const { wrapper } = mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();

    const store = useTripRouteStore();
    const targetId = store.placeIds[2];
    // KakaoMap stub emits 'markerClick' — TripRoutePage 가 store 의 setActive 로 위임.
    wrapper.findComponent({ name: 'KakaoMap' }).vm.$emit('markerClick', targetId);
    await flushPromises();
    expect(store.activeId).toBe(targetId);
  });

  it('opens the route editor when the timeline edit button is tapped', async () => {
    const { wrapper } = mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();

    expect(wrapper.find('[data-testid="rt-editor-overlay"]').exists()).toBe(false);
    await wrapper.find('[data-testid="rt-edit-btn"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="rt-editor-overlay"]').exists()).toBe(true);
  });

  it('opens the share sheet when the timeline share button is tapped', async () => {
    const { wrapper } = mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();

    expect(wrapper.find('[data-testid="rt-share-overlay"]').exists()).toBe(false);
    await wrapper.find('[data-testid="rt-share-btn"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="rt-share-overlay"]').exists()).toBe(true);
  });

  it('zoom-in button decrements zoom prop passed to KakaoMap (Kakao: smaller = closer)', async () => {
    const { wrapper } = mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();

    const map = wrapper.find('.kakao-map-stub');
    expect(map.attributes('data-zoom')).toBe('7');

    await wrapper.find('[data-testid="tr-zoom-in"]').trigger('click');
    expect(map.attributes('data-zoom')).toBe('6');

    await wrapper.find('[data-testid="tr-zoom-out"]').trigger('click');
    await wrapper.find('[data-testid="tr-zoom-out"]').trigger('click');
    expect(map.attributes('data-zoom')).toBe('8');
  });

  it('back button calls router.back', async () => {
    const { wrapper } = mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();
    await wrapper.find('[data-testid="tr-back"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  // ── task #22: visited refresh on Ionic re-enter ───────────────────────
  it('onIonViewDidEnter refreshes visited from backend when there is a saved route', async () => {
    mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();
    const store = useTripRouteStore();
    store.currentSavedRouteId = 42;
    const refreshSpy = vi.spyOn(store, 'refreshVisitedFromBackend').mockResolvedValue();

    expect(ionViewEnterCb.current).toBeTypeOf('function');
    ionViewEnterCb.current?.();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('onIonViewDidEnter is a noop when no saved route is loaded', async () => {
    mountPage({ contentId: '1', contentTitle: '겨울연가' });
    await flushPromises();
    const store = useTripRouteStore();
    expect(store.currentSavedRouteId).toBeNull();
    const refreshSpy = vi.spyOn(store, 'refreshVisitedFromBackend').mockResolvedValue();

    ionViewEnterCb.current?.();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
