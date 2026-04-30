import { defineStore } from 'pinia';
import api from '@/services/api';

/**
 * `GET /api/users/me/liked-places` 응답의 단건. ProfilePage 메뉴에서 진입하는
 * "좋아요한 장소" 그리드 카드용. cursor 는 PlaceLike row id (서버 내부 키).
 */
export interface LikedPlace {
  id: number;
  name: string;
  regionLabel: string;
  coverImageUrls: string[];
  contentId: number | null;
  contentTitle: string | null;
  likeCount: number;
  /** 페이지네이션 cursor 키 — PlaceLike row id. */
  likeId: number;
}

interface LikedPlacesResponse {
  places: LikedPlace[];
  nextCursor: number | null;
}

interface State {
  items: LikedPlace[];
  loading: boolean;
  error: string | null;
  /** null = 끝 도달, 또는 아직 첫 페이지 fetch 전. `loaded` 와 함께 봐야 정확. */
  nextCursor: number | null;
  /** 서버가 hasMore 명시적으로 안 주므로 nextCursor === null 로 추적. */
  hasMore: boolean;
  /** 첫 fetch 한 번이라도 끝난 적 있는지 — 빈 상태와 미초기화 상태 구분용. */
  loaded: boolean;
}

const PAGE_SIZE = 30;

export const useLikedPlacesStore = defineStore('likedPlaces', {
  state: (): State => ({
    items: [],
    loading: false,
    error: null,
    nextCursor: null,
    hasMore: true,
    loaded: false,
  }),
  actions: {
    /**
     * 첫 페이지를 새로 가져온다. 페이지 진입 시 항상 호출 — 다른 surface(PlaceDetail
     * / Map / Home) 에서 좋아요 토글이 발생했을 가능성을 흡수.
     */
    async fetch(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<LikedPlacesResponse>('/api/users/me/liked-places', {
          params: { limit: PAGE_SIZE },
        });
        this.items = data.places ?? [];
        this.nextCursor = data.nextCursor;
        this.hasMore = data.nextCursor != null;
        this.loaded = true;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load liked places';
      } finally {
        this.loading = false;
      }
    },
    async loadMore(): Promise<void> {
      if (this.loading || !this.hasMore || this.nextCursor == null) return;
      this.loading = true;
      try {
        const { data } = await api.get<LikedPlacesResponse>('/api/users/me/liked-places', {
          params: { limit: PAGE_SIZE, cursor: this.nextCursor },
        });
        if (data.places && data.places.length > 0) {
          this.items.push(...data.places);
        }
        this.nextCursor = data.nextCursor;
        this.hasMore = data.nextCursor != null;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load more';
        // 실패는 그냥 멈춤 — 다음 트리거에서 재시도 안 되게 hasMore false 로.
        this.hasMore = false;
      } finally {
        this.loading = false;
      }
    },
    /**
     * 다른 surface(PlaceDetail toggleLike, Map toggleLike, Home toggleLike)에서
     * 좋아요를 끄면 즉시 목록에서 제거 — 사용자가 페이지 돌아왔을 때 일관된 상태.
     * 좋아요한 적 없는 placeId 는 no-op (loaded 안 됐을 때도 안전).
     */
    removeFromList(placeId: number): void {
      this.items = this.items.filter((p) => p.id !== placeId);
    },
    reset(): void {
      this.items = [];
      this.loading = false;
      this.error = null;
      this.nextCursor = null;
      this.hasMore = true;
      this.loaded = false;
    },
  },
});
