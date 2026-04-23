import { useAuthStore } from '@/stores/auth';
import type { ProfileUser } from '@/stores/profile';

const FAKE_USER: ProfileUser = {
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

// Force the auth store to report an authenticated user in unit tests so that
// store guards on login-required actions (toggleLike, toggleSave, ...) don't
// short-circuit into the login prompt.
export function signInForTest(): void {
  useAuthStore().user = { ...FAKE_USER };
}

export function signOutForTest(): void {
  useAuthStore().user = null;
}
