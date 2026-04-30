import { describe, it, expect } from 'vitest';
import { createRouter, createMemoryHistory, type RouteLocationRaw } from 'vue-router';

/**
 * task #23 — backward-compat redirects.
 *
 * 정상 흐름의 모든 push 는 직접 `/feed/detail?...` 로 이동한다. 옛 북마크/외부
 * 링크가 `/shot/:id` 또는 `/gallery/:placeId` 로 들어왔을 때만 이 redirect 가
 * 작동해 새 URL 로 자동 이동시키는 안전판. 정상 흐름에서 trigger 되면 URL
 * 마이그레이션 누락이라 회귀 가드.
 */
function makeRouter() {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/gallery/:placeId',
        name: 'Gallery',
        redirect: (to) => ({
          path: '/feed/detail',
          query: { ...to.query, placeId: String(to.params.placeId) },
        }),
      },
      {
        path: '/shot/:id',
        name: 'ShotDetail',
        redirect: (to) => ({
          path: '/feed/detail',
          query: { ...to.query, shotId: String(to.params.id) },
        }),
      },
      { path: '/feed/detail', name: 'FeedDetail', component: stub },
    ],
  });
}

async function go(target: RouteLocationRaw): Promise<{ path: string; query: Record<string, string> }> {
  const router = makeRouter();
  await router.push(target);
  await router.isReady();
  const r = router.currentRoute.value;
  return {
    path: r.path,
    query: r.query as Record<string, string>,
  };
}

describe('router redirects — task #23', () => {
  it('/shot/:id redirects to /feed/detail?shotId=:id', async () => {
    const r = await go('/shot/7');
    expect(r.path).toBe('/feed/detail');
    expect(r.query.shotId).toBe('7');
  });

  it('/gallery/:placeId redirects to /feed/detail?placeId=:placeId', async () => {
    const r = await go('/gallery/71');
    expect(r.path).toBe('/feed/detail');
    expect(r.query.placeId).toBe('71');
  });

  it('preserves any pre-existing query params during shot redirect', async () => {
    const r = await go('/shot/7?from=feed');
    expect(r.path).toBe('/feed/detail');
    expect(r.query.shotId).toBe('7');
    expect(r.query.from).toBe('feed');
  });

  it('preserves any pre-existing query params during gallery redirect', async () => {
    const r = await go('/gallery/71?utm=share');
    expect(r.path).toBe('/feed/detail');
    expect(r.query.placeId).toBe('71');
    expect(r.query.utm).toBe('share');
  });
});
