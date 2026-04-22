import { describe, it, expect, beforeEach } from 'vitest';
import { hasOnboarded, markOnboarded } from '@/composables/useOnboarding';

const STORAGE_KEY = 'filmroad_onboarded';

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hasOnboarded() returns false when the key is absent', () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(hasOnboarded()).toBe(false);
  });

  it("hasOnboarded() returns true only when the value is exactly 'true'", () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    expect(hasOnboarded()).toBe(true);

    // Any other string (including 'false') is treated as not-onboarded.
    localStorage.setItem(STORAGE_KEY, 'false');
    expect(hasOnboarded()).toBe(false);

    localStorage.setItem(STORAGE_KEY, '1');
    expect(hasOnboarded()).toBe(false);
  });

  it("markOnboarded() persists 'filmroad_onboarded' = 'true' and flips hasOnboarded()", () => {
    expect(hasOnboarded()).toBe(false);
    markOnboarded();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(hasOnboarded()).toBe(true);
  });
});
