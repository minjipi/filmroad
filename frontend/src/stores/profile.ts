import { defineStore } from 'pinia';
import api from '@/services/api';

export interface ProfileUser {
  id: number;
  nickname: string;
  handle: string;
  avatarUrl: string;
  // bio 미설정 사용자는 서버가 null 을 내려보낸다. 사용처에서 `?? ''` 로 폴백.
  bio: string | null;
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

/**
 * 작품 컴플리트 트로피 단계. percent (collected/total) 가 컷오프 이상일 때 진입.
 * 25 → QUARTER, 50 → HALF, 75 → THREE_Q, 100 → MASTER. 한번 획득하면 영구.
 */
export type ContentTrophyTier = 'QUARTER' | 'HALF' | 'THREE_Q' | 'MASTER';

export interface ContentTrophy {
  contentId: number;
  contentTitle: string;
  contentPosterUrl: string | null;
  tier: ContentTrophyTier;
  awardedAt: string;
  collectedCount: number;
  totalCount: number;
  percent: number;
}

export interface ProfileResponse {
  user: ProfileUser;
  stats: ProfileStats;
  miniMapPins: MiniMapPin[];
  trophies: ContentTrophy[];
}

export type PhotoVisibility = 'PUBLIC' | 'PRIVATE';

// One row in the profile photos grid. Matches the backend
// `GET /api/users/me/photos` response (task #35).
export interface MyPhoto {
  id: number;
  imageUrl: string;
  caption: string | null;
  placeId: number;
  placeName: string;
  regionLabel: string;
  contentId: number;
  contentTitle: string;
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
  trophies: ContentTrophy[];
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
    trophies: [],
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
        this.trophies = data.trophies ?? [];
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
