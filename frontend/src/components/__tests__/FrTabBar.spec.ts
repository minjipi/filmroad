import { describe, it, expect, beforeEach, vi } from 'vitest';

const { pushSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

import FrTabBar, { type TabKey } from '@/components/layout/FrTabBar.vue';
import { mountWithStubs } from '@/views/__tests__/__helpers__/mount';

const ROUTE_MAP: Array<{ key: TabKey; selectorIndex: number; path: string }> = [
  { key: 'home', selectorIndex: 0, path: '/home' },
  { key: 'map', selectorIndex: 1, path: '/map' },
  { key: 'camera', selectorIndex: 2, path: '/camera' },
  { key: 'feed', selectorIndex: 3, path: '/feed' },
  { key: 'me', selectorIndex: 4, path: '/profile' },
];

describe('FrTabBar.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
  });

  it('tapping each tab pushes the corresponding route', async () => {
    // Use a non-matching model-value so every tap triggers a push.
    // For the home key, switch model-value to 'map' so that home tap pushes;
    // and similarly for map, switch to 'home'.
    for (const { key, path } of ROUTE_MAP) {
      pushSpy.mockClear();
      const startKey: TabKey = key === 'home' ? 'map' : 'home';
      const { wrapper } = mountWithStubs(FrTabBar, { props: { modelValue: startKey } });
      const items = wrapper.findAll('.fr-nav-row > div');
      expect(items.length).toBe(ROUTE_MAP.length);
      const idx = ROUTE_MAP.find((r) => r.key === key)!.selectorIndex;
      await items[idx].trigger('click');
      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledWith(path);
      wrapper.unmount();
    }
  });

  it('tapping the currently active tab does not push', async () => {
    const { wrapper } = mountWithStubs(FrTabBar, { props: { modelValue: 'home' } });
    const items = wrapper.findAll('.fr-nav-row > div');
    // Index 0 is 'home', which matches modelValue.
    await items[0].trigger('click');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("model-value='map' marks only the map item with is-active", () => {
    const { wrapper } = mountWithStubs(FrTabBar, { props: { modelValue: 'map' } });
    const items = wrapper.findAll('.fr-nav-row > div');
    // home(0)=no, map(1)=yes, camera(2)=no(CTA, never active), feed(3)=no, me(4)=no.
    expect(items[0].classes()).not.toContain('is-active');
    expect(items[1].classes()).toContain('is-active');
    expect(items[1].classes()).toContain('fr-nav-item');
    expect(items[2].classes()).not.toContain('is-active');
    expect(items[3].classes()).not.toContain('is-active');
    expect(items[4].classes()).not.toContain('is-active');
  });

  it('camera item always uses .fr-nav-cta and never gets is-active', () => {
    // Even when model-value='camera', the CTA must not get the is-active class
    // so the elevated circular design is preserved.
    const { wrapper } = mountWithStubs(FrTabBar, { props: { modelValue: 'camera' } });
    const items = wrapper.findAll('.fr-nav-row > div');
    expect(items[2].classes()).toContain('fr-nav-cta');
    expect(items[2].classes()).not.toContain('fr-nav-item');
    expect(items[2].classes()).not.toContain('is-active');
  });
});
