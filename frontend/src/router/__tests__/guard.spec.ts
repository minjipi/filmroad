import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouter, createMemoryHistory } from 'vue-router';
import { setActivePinia, createPinia } from 'pinia';

// Mock the axios client before the auth store imports it.
vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api');
  return {
    ...actual,
    default: { get: vi.fn(), post: vi.fn() },
  };
});

import api, { ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { ProfileUser } from '@/stores/profile';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixtureUser: ProfileUser = {
  id: 1,
  nickname: '테스터',
  handle: 'tester',
  avatarUrl: '',
  bio: '',
  level: 1,
  levelName: '입문 순례자',
  points: 0,
  streakDays: 0,
  followersCount: 0,
  followingCount: 0,
};

// Minimal routes that exercise the guard — same requiresAuth / /onboarding
// wiring as the real router, but without the Ionic/Vue Router adapter so
// the test boots quickly and uses memory history.
function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/home' },
      { path: '/home', name: 'Home', component: { template: '<div />' } },
      { path: '/onboarding', name: 'Onboarding', component: { template: '<div />' } },
      {
        path: '/profile',
        name: 'Profile',
        component: { template: '<div />' },
        meta: { requiresAuth: true },
      },
    ],
  });

  router.beforeEach(async (to) => {
    if (!to.meta?.requiresAuth) return true;
    const auth = useAuthStore();
    await auth.ensureSessionReady();
    if (auth.isAuthenticated) return true;
    return { path: '/onboarding', query: { redirect: to.fullPath } };
  });

  return router;
}

describe('router beforeEach requiresAuth guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('hard refresh on requiresAuth route: guard awaits session rehydration and passes when authenticated', async () => {
    // /api/users/me resolves slowly so the guard has to actually wait.
    // Defaulted no-op so TS control-flow can't narrow it to `null` on the
    // later call site — Promise executors run synchronously and overwrite it
    // well before the guard awaits the pending promise.
    let resolveMe: (value: unknown) => void = () => {};
    mockApi.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );

    const router = makeRouter();
    const pushPromise = router.push('/profile');

    // Resolve the pending probe with an authenticated user — guard should then
    // settle the navigation on /profile (no redirect).
    resolveMe({ data: { user: fixtureUser } });
    await pushPromise;

    expect(router.currentRoute.value.fullPath).toBe('/profile');
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('hard refresh on requiresAuth route: 401 session redirects to /onboarding?redirect=<original>', async () => {
    mockApi.get.mockRejectedValueOnce(new ApiError('unauthorized', 401, null));

    const router = makeRouter();
    await router.push('/profile');

    expect(router.currentRoute.value.path).toBe('/onboarding');
    expect(router.currentRoute.value.query.redirect).toBe('/profile');
  });

  it('concurrent requiresAuth navigations share one ensureSessionReady fetch', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { user: fixtureUser } });

    const router = makeRouter();
    // Three near-simultaneous pushes should trigger fetchMe only once.
    await Promise.all([
      router.push('/profile'),
      router.push('/profile'),
      router.push('/profile'),
    ]);

    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.path).toBe('/profile');
  });

  it('public routes skip the session probe entirely', async () => {
    const router = makeRouter();
    await router.push('/home');

    expect(router.currentRoute.value.path).toBe('/home');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});
