import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

const { pushSpy, replaceSpy, backSpy, routeRef } = vi.hoisted(() => ({
  pushSpy: vi.fn().mockResolvedValue(undefined),
  replaceSpy: vi.fn().mockResolvedValue(undefined),
  backSpy: vi.fn(),
  routeRef: { current: { query: {} as Record<string, string | string[] | undefined> } },
}));
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy, back: backSpy }),
  useRoute: () => routeRef.current,
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

import OnboardingPage from '@/views/OnboardingPage.vue';
import { mountWithStubs } from './__helpers__/mount';

const STORAGE_KEY = 'filmroad_onboarded';

describe('OnboardingPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
    routeRef.current = { query: {} };
    localStorage.clear();
  });

  it('renders the brand name', () => {
    const { wrapper } = mountWithStubs(OnboardingPage);
    expect(wrapper.find('.brand-name').text()).toBe('필름로드');
  });

  it('hero h1 contains "내가 직접"', () => {
    const { wrapper } = mountWithStubs(OnboardingPage);
    const h1 = wrapper.find('.tag-line h1');
    expect(h1.exists()).toBe(true);
    expect(h1.text()).toContain('내가 직접');
  });

  it('renders three auth buttons in google/kakao/email order', () => {
    const { wrapper } = mountWithStubs(OnboardingPage);
    const btns = wrapper.findAll('.auth-btn');
    expect(btns.length).toBe(3);
    expect(btns[0].classes()).toContain('google');
    expect(btns[1].classes()).toContain('kakao');
    expect(btns[2].classes()).toContain('email');
  });

  it('Google button: redirects window.location to the backend oauth start URL', async () => {
    const { wrapper } = mountWithStubs(OnboardingPage);

    const original = window.location;
    const locationMock = { ...original, href: '' } as unknown as Location;
    Object.defineProperty(window, 'location', { configurable: true, value: locationMock });

    await wrapper.find('.auth-btn.google').trigger('click');
    await flushPromises();

    expect(window.location.href).toMatch(/\/oauth2\/authorization\/google$/);
    // Google path deliberately does not mark onboarded — that happens on session return.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('Kakao button: redirects window.location to the backend oauth start URL', async () => {
    const { wrapper } = mountWithStubs(OnboardingPage);

    const original = window.location;
    const locationMock = { ...original, href: '' } as unknown as Location;
    Object.defineProperty(window, 'location', { configurable: true, value: locationMock });

    await wrapper.find('.auth-btn.kakao').trigger('click');
    await flushPromises();

    expect(window.location.href).toMatch(/\/oauth2\/authorization\/kakao$/);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('Email button: pushes /email-auth without marking onboarded or showing a toast', async () => {
    const { wrapper } = mountWithStubs(OnboardingPage);

    await wrapper.find('.auth-btn.email').trigger('click');
    await flushPromises();

    expect(toastCreateSpy).not.toHaveBeenCalled();
    // Onboarded flag must flip only after successful signup/login in EmailAuthPage,
    // never as a side-effect of navigating into the form.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(pushSpy).toHaveBeenCalledWith({ path: '/email-auth', query: undefined });
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('Email button: forwards ?redirect query through to /email-auth', async () => {
    routeRef.current = { query: { redirect: '/upload' } };
    const { wrapper } = mountWithStubs(OnboardingPage);

    await wrapper.find('.auth-btn.email').trigger('click');
    await flushPromises();

    expect(pushSpy).toHaveBeenCalledWith({
      path: '/email-auth',
      query: { redirect: '/upload' },
    });
  });
});
