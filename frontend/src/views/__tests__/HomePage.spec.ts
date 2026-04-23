import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// Must mock api before HomePage -> home store is evaluated.
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: null }),
    post: vi.fn(),
  },
}));

const { pushSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, back: backSpy }),
}));

const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

import HomePage from '@/views/HomePage.vue';
import { useHomeStore, type HomeResponse } from '@/stores/home';
import { mountWithStubs } from './__helpers__/mount';

const fixture: HomeResponse = {
  hero: {
    monthLabel: 'APR',
    tag: '주말 추천',
    title: "오늘은 '도깨비'의 주문진을 걸어볼까요?",
    subtitle: '내 위치에서 차로 12분 · 2곳의 성지',
    workId: 1,
    primaryPlaceId: 10,
  },
  works: [
    { id: 1, title: '도깨비' },
    { id: 2, title: '이태원 클라쓰' },
  ],
  places: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrl: 'https://img/1.jpg',
      workId: 1,
      workTitle: '도깨비',
      liked: false,
      likeCount: 3200,
    },
    {
      id: 11,
      name: '단밤 포차',
      regionLabel: '서울 용산구 이태원동',
      coverImageUrl: 'https://img/2.jpg',
      workId: 2,
      workTitle: '이태원 클라쓰',
      liked: false,
      likeCount: 1800,
    },
    {
      id: 12,
      name: '덕수궁 돌담길',
      regionLabel: '서울 중구 정동',
      coverImageUrl: 'https://img/3.jpg',
      workId: 1,
      workTitle: '도깨비',
      liked: false,
      likeCount: 420,
    },
  ],
};

function mountHomePage() {
  const { wrapper } = mountWithStubs(HomePage, {
    initialState: {
      home: {
        hero: fixture.hero,
        works: fixture.works,
        places: [...fixture.places],
        loading: false,
        error: null,
        selectedWorkId: null,
        scope: 'NEAR',
      },
    },
  });

  return { wrapper, store: useHomeStore() };
}

describe('HomePage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastCreateSpy.mockClear();
    pushSpy.mockClear();
    backSpy.mockClear();
  });

  it('renders the hero title from the store', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    const h1 = wrapper.find('.home-hero h1');
    expect(h1.exists()).toBe(true);
    expect(h1.text()).toContain("오늘은 '도깨비'의");
  });

  it('renders one .photo-card per place', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    const cards = wrapper.findAll('.photo-card');
    expect(cards.length).toBe(fixture.places.length);
  });

  it("dispatches setWork when a work tab is clicked", async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();

    const setWorkSpy = vi.spyOn(store, 'setWork');

    // The first .tab is "모두" (null); subsequent tabs map to works by index.
    const tabs = wrapper.findAll('.tab');
    expect(tabs.length).toBe(fixture.works.length + 1);
    await tabs[1].trigger('click'); // works[0] => id 1
    expect(setWorkSpy).toHaveBeenCalledWith(1);
  });

  it('shows an error toast when setWork fails', async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();
    toastCreateSpy.mockClear();

    vi.spyOn(store, 'setWork').mockImplementation(async (id: number | null) => {
      store.selectedWorkId = id;
      store.error = '네트워크 오류';
    });

    const tabs = wrapper.findAll('.tab');
    await tabs[1].trigger('click');
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledTimes(1);
    expect(toastCreateSpy).toHaveBeenCalledWith(expect.objectContaining({
      message: '네트워크 오류',
      color: 'danger',
    }));
  });

  it('clicking a .photo-card pushes /place/:id', async () => {
    const { wrapper } = mountHomePage();
    await flushPromises();
    pushSpy.mockClear();

    const cards = wrapper.findAll('.photo-card');
    await cards[0].trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith(`/place/${fixture.places[0].id}`);
  });

  it('clicking a .like dispatches toggleLike and reflects the server response', async () => {
    const { wrapper, store } = mountHomePage();
    await flushPromises();

    const likes = wrapper.findAll('.photo-card .like');
    expect(likes.length).toBe(fixture.places.length);
    expect(likes.every((l) => !l.classes('on'))).toBe(true);

    const toggleSpy = vi
      .spyOn(store, 'toggleLike')
      .mockImplementation(async (id: number) => {
        const p = store.places.find((x) => x.id === id);
        if (p) {
          p.liked = true;
          p.likeCount += 1;
        }
      });

    await likes[0].trigger('click');
    await flushPromises();

    expect(toggleSpy).toHaveBeenCalledWith(fixture.places[0].id);
    const likesAfter = wrapper.findAll('.photo-card .like');
    expect(likesAfter[0].classes()).toContain('on');
    expect(likesAfter[1].classes()).not.toContain('on');
    expect(likesAfter[2].classes()).not.toContain('on');
  });
});
