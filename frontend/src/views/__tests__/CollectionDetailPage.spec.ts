import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// api.get is called in onMounted to (re)fetch the collection detail. Return
// the fixture so the fetch lands on the same shape the initialState seeded.
vi.mock('@/services/api', () => ({
  default: { get: vi.fn() },
}));
import api from '@/services/api';

const { pushSpy, replaceSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  replaceSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy, back: backSpy }),
}));

const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi
    .fn()
    .mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

import CollectionDetailPage from '@/views/CollectionDetailPage.vue';
import type { CollectionDetail } from '@/stores/collection';
import { mountWithStubs } from './__helpers__/mount';

const fixture: CollectionDetail = {
  id: 42,
  name: '도깨비 컴플리트',
  subtitle: '쓸쓸하고 찬란하神 도깨비의 모든 촬영지',
  coverImageUrl: 'https://img/c42.jpg',
  kind: 'CONTENT',
  contentTitle: '도깨비',
  createdAt: '2025-09-02T10:00:00Z',
  totalPlaces: 24,
  visitedPlaces: 14,
  certifiedPlaces: 9,
  totalDistanceKm: 486,
  likeCount: 3400,
  owner: { id: 1, nickname: '김소연', avatarUrl: 'https://img/avatar.jpg' },
  privacy: 'PRIVATE',
  upcomingPlaces: [
    {
      placeId: 101,
      orderIndex: 15,
      name: '퀘벡 거리 (남이섬)',
      regionLabel: '강원 춘천시 남이섬',
      coverImageUrl: 'https://img/p101.jpg',
      contentId: 1,
      contentTitle: '도깨비',
      contentEpisode: '8회',
      sceneTimestamp: '00:32:11',
      distanceKm: 62,
      likeCount: 2800,
      photoCount: 412,
      visited: false,
      visitedAt: null,
      certified: false,
      latitude: 37.79,
      longitude: 127.52,
    },
    {
      placeId: 102,
      orderIndex: 16,
      name: '주문진 영진해변 방파제',
      regionLabel: '강원 강릉시 주문진읍',
      coverImageUrl: 'https://img/p102.jpg',
      contentId: 1,
      contentTitle: '도깨비',
      contentEpisode: '1회',
      sceneTimestamp: '00:15:24',
      distanceKm: 1.2,
      likeCount: 3200,
      photoCount: 1100,
      visited: false,
      visitedAt: null,
      certified: false,
      latitude: 37.89,
      longitude: 128.83,
    },
  ],
  visitedPlacesList: [
    {
      placeId: 1,
      orderIndex: 1,
      name: '덕수궁 돌담길',
      regionLabel: '서울 중구 세종대로',
      coverImageUrl: 'https://img/p1.jpg',
      contentId: 1,
      contentTitle: '도깨비',
      contentEpisode: '3회',
      sceneTimestamp: '00:21:05',
      distanceKm: null,
      likeCount: 900,
      photoCount: 180,
      visited: true,
      visitedAt: '2025-10-14T10:00:00Z',
      certified: true,
      latitude: 37.56,
      longitude: 126.99,
    },
    {
      placeId: 2,
      orderIndex: 2,
      name: '인천 재능대학교',
      regionLabel: '인천 동구 재능로',
      coverImageUrl: 'https://img/p2.jpg',
      contentId: 1,
      contentTitle: '도깨비',
      contentEpisode: '5회',
      sceneTimestamp: '00:44:18',
      distanceKm: null,
      likeCount: 400,
      photoCount: 50,
      visited: true,
      visitedAt: '2025-09-28T10:00:00Z',
      certified: false,
      latitude: 37.47,
      longitude: 126.64,
    },
  ],
};

function mountPage(id: string | number = '42') {
  return mountWithStubs(CollectionDetailPage, {
    props: { id },
    initialState: {
      collection: {
        detail: fixture,
        loading: false,
        error: null,
      },
    },
  });
}

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

describe('CollectionDetailPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
    // Default: the onMounted fetchDetail(42) returns the fixture shape so
    // the initialState seed stays valid after the fetch lands.
    mockApi.get.mockReset();
    mockApi.get.mockResolvedValue({ data: fixture });
  });

  it('mounted → GET /api/saved/collections/:id is called with the route param', async () => {
    mountPage('42');
    await flushPromises();

    // The store's fetchDetail action hits this URL — one observable side-effect.
    const called = mockApi.get.mock.calls.some(
      (call) => String(call[0]) === '/api/saved/collections/42',
    );
    expect(called).toBe(true);
  });

  it('hero renders name, subtitle, work tag, totals and meta', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const hero = wrapper.find('[data-testid="cd-hero-info"]');
    expect(hero.exists()).toBe(true);
    expect(hero.find('.coll-title').text()).toBe('도깨비 컴플리트');
    expect(hero.find('.coll-sub').text()).toContain('쓸쓸하고');
    // WORK kind shows the film-style tag.
    expect(hero.find('.coll-tag').text()).toContain('작품 기반');
    expect(hero.find('.coll-meta-row').text()).toContain('24곳');
    expect(hero.find('.coll-meta-row').text()).toContain('486');
  });

  it('progress card shows visited/total count, percent and badges (방문/남음/인증)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const prog = wrapper.find('[data-testid="cd-progress"]');
    expect(prog.exists()).toBe(true);
    expect(prog.find('.prog-row .pct').text()).toContain('14 / 24 · 58%');
    // 14/24 → 58% → bar fill width.
    expect(prog.find('.bar .fill').attributes('style')).toContain('width: 58%');
    const badges = prog.findAll('.prog-badges .pb');
    expect(badges.length).toBe(3);
    expect(badges[0].text()).toContain('14');
    expect(badges[0].text()).toContain('방문');
    expect(badges[1].text()).toContain('10'); // 24 - 14 remaining
    expect(badges[1].text()).toContain('남음');
    expect(badges[2].text()).toContain('9');
    expect(badges[2].text()).toContain('인증');
  });

  it('upcoming list renders one row per upcomingPlaces entry', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="cd-upcoming-item"]');
    expect(rows.length).toBe(2);
    expect(rows[0].find('.nm').text()).toBe('퀘벡 거리 (남이섬)');
    expect(rows[0].find('.place-idx').text()).toBe('15');
    expect(rows[1].find('.nm').text()).toBe('주문진 영진해변 방파제');
  });

  it('visited list renders .done rows with check overlay + section header shows count', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="cd-visited-item"]');
    expect(rows.length).toBe(2);
    expect(rows[0].classes()).toContain('done');
    // Done-overlay check is rendered inside the thumb.
    expect(rows[0].find('.place-thumb .done-ov').exists()).toBe(true);
    // Certified row → chevron CTA (done-cta class).
    expect(rows[0].find('.place-cta.done-cta').exists()).toBe(true);
    // Un-certified row → camera CTA.
    expect(rows[1].find('.place-cta.done-cta').exists()).toBe(false);
  });

  it('route map renders the KakaoMap with one marker per place (visited first)', async () => {
    const { wrapper } = mountPage();
    await flushPromises();

    const kakao = wrapper.findComponent({ name: 'KakaoMap' });
    expect(kakao.exists()).toBe(true);
    const markers = kakao.props('markers') as Array<{ id: number }>;
    // 2 visited + 2 upcoming = 4 markers.
    expect(markers.length).toBe(4);
    // visitedIds reflects the two done places.
    const visited = kakao.props('visitedIds') as number[];
    expect(visited.length).toBe(2);
    // routePath threads all four coords in order.
    const path = kakao.props('routePath') as Array<{ lat: number; lng: number }>;
    expect(path.length).toBe(4);
  });

  it('clicking "전체보기" pushes /map?collectionId=:id', async () => {
    const { wrapper } = mountPage('42');
    await flushPromises();

    await wrapper.find('[data-testid="cd-open-full-map"]').trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/map',
      query: { collectionId: '42' },
    });
  });

  it('clicking a place item pushes /place/:id', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();

    await wrapper.findAll('[data-testid="cd-upcoming-item"]')[0].trigger('click');
    await flushPromises();
    expect(pushSpy).toHaveBeenCalledWith('/place/101');
  });

  it('back button: history.length>1 → router.back; otherwise replace("/profile")', async () => {
    // With history — router.back().
    window.history.pushState({}, '', '/collection/42');
    const { wrapper } = mountPage();
    await flushPromises();
    backSpy.mockClear();
    replaceSpy.mockClear();
    await wrapper.find('[data-testid="cd-back"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();
    window.history.back();
  });

  it('"최적 루트 보기" placeholder → info toast, no router push', async () => {
    const { wrapper } = mountPage();
    await flushPromises();
    pushSpy.mockClear();
    toastCreateSpy.mockClear();

    await wrapper.find('[data-testid="cd-optimal-route"]').trigger('click');
    await flushPromises();
    expect(toastCreateSpy).toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('empty collection (no upcoming, no visited) renders the empty-note placeholder', async () => {
    const emptyDetail = {
      ...fixture,
      upcomingPlaces: [],
      visitedPlacesList: [],
    };
    // Force the onMounted fetch to also return empty so state stays empty.
    mockApi.get.mockResolvedValueOnce({ data: emptyDetail });
    const { wrapper } = mountWithStubs(CollectionDetailPage, {
      props: { id: '42' },
      initialState: {
        collection: {
          detail: emptyDetail,
          loading: false,
          error: null,
        },
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="cd-empty"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="cd-upcoming-item"]').length).toBe(0);
    expect(wrapper.findAll('[data-testid="cd-visited-item"]').length).toBe(0);
  });
});
