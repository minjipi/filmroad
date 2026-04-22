import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

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

import OnboardingPage from '@/views/OnboardingPage.vue';
import { mountWithStubs } from './__helpers__/mount';

const STORAGE_KEY = 'filmroad_onboarded';

describe('OnboardingPage.vue', () => {
  beforeEach(() => {
    pushSpy.mockClear();
    replaceSpy.mockClear();
    backSpy.mockClear();
    toastCreateSpy.mockClear();
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

  it('renders three auth buttons in apple/kakao/email order', () => {
    const { wrapper } = mountWithStubs(OnboardingPage);
    const btns = wrapper.findAll('.auth-btn');
    expect(btns.length).toBe(3);
    expect(btns[0].classes()).toContain('apple');
    expect(btns[1].classes()).toContain('kakao');
    expect(btns[2].classes()).toContain('email');
  });

  it('Apple button: shows toast, marks onboarded and replaces /home', async () => {
    const { wrapper } = mountWithStubs(OnboardingPage);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await wrapper.find('.auth-btn.apple').trigger('click');
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledTimes(1);
    expect(toastCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: '소셜 로그인 기능은 곧 공개됩니다' }),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(replaceSpy).toHaveBeenCalledWith('/home');
  });

  it('Kakao button: shows toast, marks onboarded and replaces /home', async () => {
    const { wrapper } = mountWithStubs(OnboardingPage);

    await wrapper.find('.auth-btn.kakao').trigger('click');
    await flushPromises();

    expect(toastCreateSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(replaceSpy).toHaveBeenCalledWith('/home');
  });

  it('Email button: marks onboarded and replaces /home without showing a toast', async () => {
    const { wrapper } = mountWithStubs(OnboardingPage);

    await wrapper.find('.auth-btn.email').trigger('click');
    await flushPromises();

    expect(toastCreateSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(replaceSpy).toHaveBeenCalledWith('/home');
  });
});
