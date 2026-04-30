import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/services/route', () => ({
  // tripRoute store import 시 모듈 전체가 로드되니 다른 함수도 stub.
  fetchDirections: vi.fn(),
  fetchRouteInit: vi.fn(),
  saveRoute: vi.fn(),
  updateRoute: vi.fn(),
  loadRoute: vi.fn(),
  listMyRoutes: vi.fn(),
  deleteRoute: vi.fn(),
}));

const { pushSpy, backSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, back: backSpy }),
  useRoute: () => ({ query: {}, params: {} }),
}));

const { toastCreateSpy } = vi.hoisted(() => ({
  toastCreateSpy: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<typeof import('@ionic/vue')>('@ionic/vue');
  return { ...actual, toastController: { create: toastCreateSpy } };
});

import { listMyRoutes, deleteRoute, type SavedRouteSummary } from '@/services/route';
import SavedRoutesPage from '@/views/SavedRoutesPage.vue';
import { mountWithStubs } from './__helpers__/mount';

const mockListMyRoutes = listMyRoutes as unknown as ReturnType<typeof vi.fn>;
const mockDeleteRoute = deleteRoute as unknown as ReturnType<typeof vi.fn>;

function makeSummary(over: Partial<SavedRouteSummary> = {}): SavedRouteSummary {
  return {
    id: 1,
    name: '강원 코스',
    contentTitle: '겨울연가',
    placeCount: 5,
    updatedAt: '2026-04-30T10:00:00Z',
    coverImageUrl: null,
    ...over,
  };
}

function mountPage() {
  return mountWithStubs(SavedRoutesPage, { props: {} });
}

describe('SavedRoutesPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
    mockListMyRoutes.mockReset();
    mockDeleteRoute.mockReset();
  });

  it('on mount calls listMyRoutes and renders one card per saved route', async () => {
    mockListMyRoutes.mockResolvedValueOnce([
      makeSummary({ id: 1, name: '강원 코스' }),
      makeSummary({ id: 2, name: '서울 코스', contentTitle: '도깨비', placeCount: 3 }),
    ]);
    const { wrapper } = mountPage();
    await flushPromises();

    expect(mockListMyRoutes).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('[data-testid^="saved-route-card-"]').length).toBe(2);
    expect(wrapper.find('[data-testid="saved-route-card-1"]').text()).toContain('강원 코스');
    expect(wrapper.find('[data-testid="saved-route-card-2"]').text()).toContain('서울 코스');
  });

  it('shows the empty state with a CTA when there are no saved routes', async () => {
    mockListMyRoutes.mockResolvedValueOnce([]);
    const { wrapper } = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="saved-routes-empty"]').exists()).toBe(true);
    await wrapper.find('[data-testid="saved-routes-empty-cta"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith('/home');
  });

  it('clicking a card pushes /route?routeId=<id>', async () => {
    mockListMyRoutes.mockResolvedValueOnce([makeSummary({ id: 42 })]);
    const { wrapper } = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="saved-route-card-42"]').trigger('click');
    expect(pushSpy).toHaveBeenCalledWith({ path: '/route', query: { routeId: '42' } });
  });

  it('delete button calls deleteRoute and removes the card after confirm', async () => {
    mockListMyRoutes.mockResolvedValueOnce([
      makeSummary({ id: 1, name: '강원 코스' }),
      makeSummary({ id: 2, name: '서울 코스' }),
    ]);
    mockDeleteRoute.mockResolvedValueOnce(undefined);
    // jsdom 의 confirm 은 기본 false — 명시적으로 true 로 stub.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { wrapper } = mountPage();
    await flushPromises();
    expect(wrapper.findAll('[data-testid^="saved-route-card-"]').length).toBe(2);

    await wrapper.find('[data-testid="saved-route-delete-1"]').trigger('click');
    await flushPromises();

    expect(mockDeleteRoute).toHaveBeenCalledWith(1);
    const remaining = wrapper.findAll('[data-testid^="saved-route-card-"]');
    expect(remaining.length).toBe(1);
    expect(remaining[0].attributes('data-testid')).toBe('saved-route-card-2');
    confirmSpy.mockRestore();
  });

  it('delete button is a noop when user cancels the confirm', async () => {
    mockListMyRoutes.mockResolvedValueOnce([makeSummary({ id: 1 })]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { wrapper } = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="saved-route-delete-1"]').trigger('click');
    await flushPromises();

    expect(mockDeleteRoute).not.toHaveBeenCalled();
    expect(wrapper.findAll('[data-testid^="saved-route-card-"]').length).toBe(1);
    confirmSpy.mockRestore();
  });

  it('back button calls router.back', async () => {
    mockListMyRoutes.mockResolvedValueOnce([]);
    const { wrapper } = mountPage();
    await flushPromises();

    await wrapper.find('[data-testid="saved-routes-back"]').trigger('click');
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
