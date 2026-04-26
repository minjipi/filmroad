import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { useToast } from '@/composables/useToast';

export interface SavedCollection {
  id: number;
  name: string;
  // 빈 컬렉션 (직후 생성/이름변경 등) 은 서버가 null 을 보낸다 — 사용처에서 `?? []` 로 안전 처리.
  coverImageUrls: string[] | null;
  count: number;
  gradient: string | null;
  // Optional iconKey for future server-driven cover icons (MAP_PIN / FILM /
  // MOON etc.). Renderers fall back to a generic pin when absent.
  iconKey?: string | null;
}

export interface SavedItem {
  placeId: number;
  name: string;
  regionLabel: string;
  coverImageUrls: string[];
  workId: number;
  workTitle: string;
  distanceKm: number | null;
  likeCount: number;
  visited: boolean;
  collectionId: number | null;
}

export interface NearbyRouteSuggestion {
  title: string;
  subtitle: string;
  placeCount: number;
}

export interface SavedResponse {
  collections: SavedCollection[];
  totalCount: number;
  items: SavedItem[];
  nearbyRouteSuggestion: NearbyRouteSuggestion | null;
}

interface FetchOptions {
  lat?: number;
  lng?: number;
}

interface State {
  collections: SavedCollection[];
  items: SavedItem[];
  // Canonical "is this place saved?" index, kept in sync with the server via
  // fetch / toggleSave. Separate from `items` because bookmark buttons across
  // the app (PlaceDetail, Feed, Gallery, Map) need to know saved state for
  // places that aren't necessarily rendered on SavedPage.
  savedPlaceIds: number[];
  totalCount: number;
  suggestion: NearbyRouteSuggestion | null;
  loading: boolean;
  error: string | null;
}

export const useSavedStore = defineStore('saved', {
  state: (): State => ({
    collections: [],
    items: [],
    savedPlaceIds: [],
    totalCount: 0,
    suggestion: null,
    loading: false,
    error: null,
  }),
  getters: {
    isSaved: (state) => (placeId: number): boolean =>
      state.savedPlaceIds.includes(placeId),
  },
  actions: {
    async fetch(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const params: Record<string, string | number> = {};
        if (typeof opts.lat === 'number') params.lat = opts.lat;
        if (typeof opts.lng === 'number') params.lng = opts.lng;
        const { data } = await api.get<SavedResponse>('/api/saved', { params });
        this.collections = data.collections;
        this.items = data.items;
        this.savedPlaceIds = data.items.map((i) => i.placeId);
        this.totalCount = data.totalCount;
        this.suggestion = data.nearbyRouteSuggestion;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load saved';
      } finally {
        this.loading = false;
      }
    },
    async createCollection(name: string): Promise<SavedCollection | null> {
      const trimmed = name.trim();
      if (!trimmed) {
        this.error = '컬렉션 이름을 입력해 주세요';
        return null;
      }
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('컬렉션 만들기는 로그인 후 이용할 수 있어요.');
        return null;
      }
      try {
        const { data } = await api.post<SavedCollection>(
          '/api/saved/collections',
          { name: trimmed },
        );
        // Prepend so the user sees the card they just added at the start of
        // the horizontal list — re-sorting stays the server's job.
        this.collections.unshift(data);
        return data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to create collection';
        return null;
      }
    },
    async renameCollection(id: number, name: string): Promise<boolean> {
      const trimmed = name.trim();
      if (!trimmed) {
        this.error = '컬렉션 이름을 입력해 주세요';
        return false;
      }
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('컬렉션 편집은 로그인 후 이용할 수 있어요.');
        return false;
      }
      const target = this.collections.find((c) => c.id === id);
      if (!target) {
        this.error = '컬렉션을 찾을 수 없어요';
        return false;
      }
      // Optimistic — 카드 라벨이 즉시 바뀌어야 사용자 체감이 빠르다. 실패 시 원래 이름으로 롤백.
      const prevName = target.name;
      target.name = trimmed;
      try {
        await api.patch<SavedCollection>(
          `/api/saved/collections/${id}`,
          { name: trimmed },
        );
        return true;
      } catch (e) {
        target.name = prevName;
        this.error = e instanceof Error ? e.message : 'Failed to rename collection';
        return false;
      }
    },
    async deleteCollection(id: number): Promise<boolean> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('컬렉션 편집은 로그인 후 이용할 수 있어요.');
        return false;
      }
      const target = this.collections.find((c) => c.id === id);
      if (!target) {
        this.error = '컬렉션을 찾을 수 없어요';
        return false;
      }
      // Optimistic — 카드와 그 안의 SavedPlace 들을 먼저 뺀다. Phase 1 정책: 컬렉션 삭제 시
      // 안의 저장 자체도 해제 (서버에서 cascade DELETE). items / savedPlaceIds / totalCount
      // 모두 같이 갱신해야 PlaceDetail 등 다른 화면 북마크 아이콘도 즉시 회색으로 돌아옴.
      const prevCollections = [...this.collections];
      const prevItems = [...this.items];
      const prevSavedPlaceIds = [...this.savedPlaceIds];
      const prevTotalCount = this.totalCount;

      const removedItems = this.items.filter((i) => i.collectionId === id);
      const removedPlaceIds = new Set(removedItems.map((i) => i.placeId));

      this.collections = this.collections.filter((c) => c.id !== id);
      this.items = this.items.filter((i) => i.collectionId !== id);
      this.savedPlaceIds = this.savedPlaceIds.filter((pid) => !removedPlaceIds.has(pid));
      this.totalCount = Math.max(0, this.totalCount - removedItems.length);

      try {
        await api.delete(`/api/saved/collections/${id}`);
        return true;
      } catch (e) {
        this.collections = prevCollections;
        this.items = prevItems;
        this.savedPlaceIds = prevSavedPlaceIds;
        this.totalCount = prevTotalCount;
        this.error = e instanceof Error ? e.message : 'Failed to delete collection';
        return false;
      }
    },
    async toggleSave(
      placeId: number,
      collectionId?: number | null,
    ): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('저장은 로그인 후 이용할 수 있어요.');
        return;
      }
      // Optimistic toggle — update savedPlaceIds BEFORE the POST lands so
      // bookmark icons across Feed / Gallery / PlaceDetail / Map flip
      // immediately (task #32). The snapshot lets us roll back if the
      // server rejects.
      const wasSaved = this.savedPlaceIds.includes(placeId);
      const itemsSnapshot = [...this.items];
      if (wasSaved) {
        this.savedPlaceIds = this.savedPlaceIds.filter((id) => id !== placeId);
        this.items = this.items.filter((i) => i.placeId !== placeId);
      } else {
        this.savedPlaceIds.push(placeId);
      }
      try {
        // Only forward collectionId when the caller explicitly supplied one —
        // omitting it entirely keeps the server-side default ("unassigned"
        // i.e. collectionId=null) while still letting unsave paths skip the
        // field. `null` is a valid value meaning "drop into 기본".
        const body: { placeId: number; collectionId?: number | null } = {
          placeId,
        };
        if (collectionId !== undefined) body.collectionId = collectionId;
        const { data } = await api.post<{ saved: boolean; totalCount: number }>('/api/saved/toggle', body);
        this.totalCount = data.totalCount;
        // Server may disagree with our optimistic assumption (rare: race
        // between two tabs). Reconcile to whatever the server says.
        if (data.saved) {
          if (!this.savedPlaceIds.includes(placeId)) {
            this.savedPlaceIds.push(placeId);
          }
          // Re-hydrate items so SavedPage / ProfilePage saved tab renders
          // the full place card (thumbnail, region, work) right away. The
          // toggle response only carries { saved, totalCount } — without
          // this refetch, the item exists in savedPlaceIds but never shows
          // up in the list until the next manual page visit.
          await this.fetch();
          // 빈번한 액션이라 중앙 카드 토스트(showInfo) 대신 하단 다크 알약
          // (showQuick) 으로 가볍게 알린다 — 매번 화면 가리면 피로해서.
          await useToast().showQuick('저장했어요');
        } else {
          this.savedPlaceIds = this.savedPlaceIds.filter((id) => id !== placeId);
          this.items = this.items.filter((i) => i.placeId !== placeId);
          await useToast().showQuick('저장을 해제했어요');
        }
      } catch (e) {
        // Rollback the optimistic update so the UI stays consistent with
        // the actual server state.
        if (wasSaved) {
          if (!this.savedPlaceIds.includes(placeId)) {
            this.savedPlaceIds.push(placeId);
          }
          this.items = itemsSnapshot;
        } else {
          this.savedPlaceIds = this.savedPlaceIds.filter((id) => id !== placeId);
        }
        this.error = e instanceof Error ? e.message : 'Failed to toggle save';
      }
    },
  },
});
