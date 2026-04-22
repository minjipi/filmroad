const STORAGE_KEY = 'filmroad_onboarded';

export function hasOnboarded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage unavailable (private mode etc.) — silently skip
  }
}

export function useOnboarding() {
  return { hasOnboarded, markOnboarded };
}
