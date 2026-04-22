import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { ProfileUser } from '@/stores/profile';

const mockApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const fixtureUser: ProfileUser = {
  id: 1,
  nickname: '김미루',
  handle: 'miru',
  avatarUrl: 'https://img/avatar.jpg',
  bio: '성지 순례 중',
  level: 5,
  levelName: '성지 순례자',
  points: 350,
  streakDays: 7,
  followersCount: 1200,
  followingCount: 234,
};

// Mimics an axios error so axios.isAxiosError() returns true (it checks the flag).
function makeAxiosError(status: number, message = 'http error') {
  return {
    isAxiosError: true,
    message,
    response: { status, data: null, statusText: '', headers: {}, config: {} },
  };
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockApi.get.mockReset();
    mockApi.post.mockReset();
  });

  it('initial state has null user, isAuthenticated=false, no error', () => {
    const store = useAuthStore();
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetchMe happy path populates user and flips isAuthenticated', async () => {
    mockApi.get.mockResolvedValueOnce({ data: { user: fixtureUser } });

    const store = useAuthStore();
    await store.fetchMe();

    expect(store.user).toEqual(fixtureUser);
    expect(store.isAuthenticated).toBe(true);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(mockApi.get).toHaveBeenCalledWith('/api/users/me');
  });

  it('fetchMe 401 silently clears user without surfacing an error', async () => {
    mockApi.get.mockRejectedValueOnce(makeAxiosError(401, 'unauthorized'));

    const store = useAuthStore();
    // Seed a stale user to verify the action wipes it.
    store.user = { ...fixtureUser };
    await store.fetchMe();

    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('fetchMe non-401 error surfaces the message and still clears user', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('network down'));

    const store = useAuthStore();
    store.user = { ...fixtureUser };
    await store.fetchMe();

    expect(store.user).toBeNull();
    expect(store.error).toBe('network down');
    expect(store.loading).toBe(false);
  });

  it('logout POSTs /api/auth/logout and resets user even on success', async () => {
    mockApi.post.mockResolvedValueOnce({ data: null });

    const store = useAuthStore();
    store.user = { ...fixtureUser };
    await store.logout();

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/logout');
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.error).toBeNull();
  });

  it('logout still clears user when the server call fails (and surfaces the error)', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('500 server'));

    const store = useAuthStore();
    store.user = { ...fixtureUser };
    await store.logout();

    expect(store.user).toBeNull();
    expect(store.error).toBe('500 server');
  });
});
