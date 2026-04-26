import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { works: [], places: [] } }) },
}));

const { pushSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, back: backSpy }),
}));

import SearchPage from '@/views/SearchPage.vue';
import { useSearchStore, type SearchResponse } from '@/stores/search';
import { mountWithStubs } from './__helpers__/mount';

const fixture: SearchResponse = {
  works: [
    { id: 1, title: '도깨비', posterUrl: 'https://img/g.jpg', placeCount: 12 },
  ],
  places: [
    {
      id: 10,
      name: '주문진 영진해변 방파제',
      regionLabel: '강릉시 주문진읍',
      coverImageUrls: ['https://img/10.jpg'],
      workId: 1,
      workTitle: '도깨비',
    },
  ],
};

function mountSearch(initial?: Partial<SearchResponse>) {
  return mountWithStubs(SearchPage, {
    initialState: {
      search: {
        query: '',
        works: initial?.works ?? [],
        places: initial?.places ?? [],
        loading: false,
        error: null,
      },
    },
  });
}

describe('SearchPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    backSpy.mockClear();
    vi.clearAllMocks();
  });

  it('empty query renders the placeholder prompt', async () => {
    const { wrapper } = mountSearch();
    await flushPromises();

    expect(wrapper.find('.sr-empty').text()).toContain('찾고 싶은 작품이나 장소를 입력해 주세요');
    expect(wrapper.find('[data-testid="work-item"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="place-item"]').exists()).toBe(false);
  });

  it('renders populated state: work + place sections and result counts', async () => {
    const { wrapper } = mountSearch(fixture);
    await flushPromises();

    // Seed a non-empty rawQuery so the page shows results instead of the empty state.
    const input = wrapper.find('input.sr-input');
    await input.setValue('도깨비');
    // Flush the 300ms debounce without actually firing the network (store is pre-populated).
    await flushPromises();

    expect(wrapper.findAll('[data-testid="work-item"]').length).toBe(1);
    expect(wrapper.findAll('[data-testid="place-item"]').length).toBe(1);
    // Count badges on the tabs reflect fixtures (works=1, places=1, all=2).
    const tabs = wrapper.findAll('.sr-tab .cnt');
    expect(tabs.map((t) => t.text())).toEqual(['2', '1', '1']);
  });

  it('debounces input and fires search exactly once after 300ms of quiet', async () => {
    vi.useFakeTimers();
    const { wrapper } = mountSearch();
    const store = useSearchStore();
    const searchSpy = vi.spyOn(store, 'search');

    const input = wrapper.find('input.sr-input');
    await input.setValue('도');
    await input.setValue('도깨');
    await input.setValue('도깨비');
    // Empty-query calls (clearing) fire synchronously; typed queries wait.
    expect(searchSpy.mock.calls.filter((c) => c[0] !== '').length).toBe(0);

    vi.advanceTimersByTime(299);
    expect(searchSpy.mock.calls.filter((c) => c[0] === '도깨비').length).toBe(0);

    vi.advanceTimersByTime(10);
    expect(searchSpy.mock.calls.filter((c) => c[0] === '도깨비').length).toBe(1);
    vi.useRealTimers();
  });

  it('tapping the 작품 tab hides places and shows only the works list', async () => {
    const { wrapper } = mountSearch(fixture);
    const input = wrapper.find('input.sr-input');
    await input.setValue('도깨비');
    await flushPromises();

    const tabButtons = wrapper.findAll('.sr-tab');
    // [전체, 작품, 장소]
    await tabButtons[1].trigger('click');

    expect(wrapper.findAll('[data-testid="work-item"]').length).toBe(1);
    expect(wrapper.findAll('[data-testid="place-item"]').length).toBe(0);
  });

  it('place item click pushes /place/:id', async () => {
    const { wrapper } = mountSearch(fixture);
    const input = wrapper.find('input.sr-input');
    await input.setValue('도깨비');
    await flushPromises();

    await wrapper.find('[data-testid="place-item"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/place/10');
  });

  it('work item click pushes /work/:id', async () => {
    const { wrapper } = mountSearch(fixture);
    const input = wrapper.find('input.sr-input');
    await input.setValue('도깨비');
    await flushPromises();

    await wrapper.find('[data-testid="work-item"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/work/1');
  });

  it('clear (×) button resets the input and keeps focus', async () => {
    const { wrapper } = mountSearch();
    const input = wrapper.find('input.sr-input');
    await input.setValue('도깨비');
    await flushPromises();

    // Clear button only renders when rawQuery is non-empty.
    const clear = wrapper.find('.clear');
    expect(clear.exists()).toBe(true);
    await clear.trigger('click');

    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('back button triggers router.back()', async () => {
    const { wrapper } = mountSearch();
    await wrapper.find('button[aria-label="뒤로"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
