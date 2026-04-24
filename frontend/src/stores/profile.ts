import { defineStore } from 'pinia';
import api from '@/services/api';

export interface ProfileUser {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  level: number;
  levelName: string;
  points: number;
  streakDays: number;
  followersCount: number;
  followingCount: number;
}

export interface ProfileStats {
  visitedCount: number;
  photoCount: number;
  followersCount: number;
  followingCount: number;
}

export type MiniMapVariant = 'PRIMARY' | 'VIOLET' | 'MINT';

export interface MiniMapPin {
  latitude: number;
  longitude: number;
  variant: MiniMapVariant;
}

export interface ProfileResponse {
  user: ProfileUser;
  stats: ProfileStats;
  miniMapPins: MiniMapPin[];
}

export type PhotoVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

// One row in the profile photos grid. Matches the backend
// `GET /api/users/me/photos` response (task #35).
export interface MyPhoto {
  id: number;
  imageUrl: string;
  caption: string | null;
  placeId: number;
  placeName: string;
  regionLabel: string;
  workId: number;
  workTitle: string;
  visibility: PhotoVisibility;
  createdAt: string;
}

export interface MyPhotosResponse {
  photos: MyPhoto[];
  nextCursor: number | null;
}

interface State {
  user: ProfileUser | null;
  stats: ProfileStats | null;
  miniMapPins: MiniMapPin[];
  loading: boolean;
  error: string | null;
  // My-photos grid (task #35). Kept alongside the profile payload so the
  // profile page can fan out from a single store. Loading/error tracked
  // separately so a failed photos fetch doesn't blank the whole page.
  // Backend returns `{photos, nextCursor}`; nextCursor=null means end-of-list.
  myPhotos: MyPhoto[];
  myPhotosLoading: boolean;
  myPhotosError: string | null;
  myPhotosNextCursor: number | null;
  myPhotosLoaded: boolean;
}

const PHOTOS_DEFAULT_LIMIT = 30;

export const useProfileStore = defineStore('profile', {
  state: (): State => ({
    user: null,
    stats: null,
    miniMapPins: [],
    loading: false,
    error: null,
    myPhotos: [],
    myPhotosLoading: false,
    myPhotosError: null,
    myPhotosNextCursor: null,
    myPhotosLoaded: false,
  }),
  actions: {
    async fetch(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<ProfileResponse>('/api/users/me');
        this.user = data.user;
        this.stats = data.stats;
        this.miniMapPins = data.miniMapPins;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load profile';
      } finally {
        this.loading = false;
      }
    },
    async fetchMyPhotos(
      cursor: number | null = null,
      limit: number = PHOTOS_DEFAULT_LIMIT,
    ): Promise<void> {
      // `cursor == null` → fresh first page (replace list). Otherwise append.
      // Server clamp: default 30, max 60.
      const isFirstPage = cursor == null;
      this.myPhotosLoading = true;
      this.myPhotosError = null;
      try {
        const params: Record<string, string | number> = { limit };
        if (typeof cursor === 'number') params.cursor = cursor;
        const { data } = await api.get<MyPhotosResponse>(
          '/api/users/me/photos',
          { params },
        );
        // Defensive null-guard: jsdom default mock resolves to `{data: null}`
        // so an un-configured spec doesn't crash the grid.
        const photos = data?.photos ?? [];
        this.myPhotos = isFirstPage ? photos : [...this.myPhotos, ...photos];
        this.myPhotosNextCursor = data?.nextCursor ?? null;
        this.myPhotosLoaded = true;
      } catch (e) {
        this.myPhotosError =
          e instanceof Error ? e.message : 'Failed to load photos';
      } finally {
        this.myPhotosLoading = false;
      }
    },
  },
});
