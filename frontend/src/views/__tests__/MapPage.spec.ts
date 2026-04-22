import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: null }) },
}));

const { pushSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: pushSpy, back: backSpy }),
}));

import MapPage from '@/views/MapPage.vue';
import { useMapStore, type MapResponse } from '@/stores/map';
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

function mountMapPage() {
  const { wrapper } = mountWithStubs(MapPage, {
    initialState: {
      map: {
        markers: [...fixture.markers],
        selected: { ...fixture.selected! },
        loading: false,
        error: null,
        filter: 'SPOTS',
        workId: null,
        q: '',
        center: { lat: 37.8928, lng: 128.8347 },
        visitedIds: [10],
        savedIds: [],
      },
    },
  });

  return { wrapper, store: useMapStore() };
}

describe('MapPage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushSpy.mockClear();
    backSpy.mockClear();
  });

  it('renders one .pin per visible marker', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    expect(wrapper.findAll('.pin').length).toBe(fixture.markers.length);
  });

  it('marks the visited marker with .visited and the selected marker with .active', async () => {
    const { wrapper } = mountMapPage();
    await flushPromises();
    const pins = wrapper.findAll('.pin');
    // id=10 is both visited (seeded) and selected.
    expect(pins[0].classes()).toContain('visited');
    expect(pins[0].classes()).toContain('active');
    // id=13 has neither.
    expect(pins[1].classes()).not.toContain('visited');
    expect(pins[1].classes()).not.toContain('active');
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

  it('dispatches selectMarker when a pin is tapped', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    const selectSpy = vi.spyOn(store, 'selectMarker');

    await wrapper.findAll('.pin')[1].trigger('click');
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

  it('filter chip VISITED switches the store filter', async () => {
    const { wrapper, store } = mountMapPage();
    await flushPromises();
    const chips = wrapper.findAll('.filter-chip');
    // [성지, 방문완료, 저장한 곳, 도깨비]
    await chips[1].trigger('click');
    expect(store.filter).toBe('VISITED');
  });
});
