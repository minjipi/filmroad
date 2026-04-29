import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export interface ContentSummary {
  id: number;
  title: string;
}

export interface PopularContent {
  id: number;
  title: string;
  // Optional cover/poster (3:4 card art). Falls back to an initial chip when
  // absent — backend may omit for contents without licensed artwork.
  posterUrl?: string | null;
  // Number of 성지 registered under this work; rendered as "N곳" under title.
  placeCount: number;
}

export interface PlaceSummary {
  id: number;
  name: string;
  regionLabel: string;
  coverImageUrls: string[];
  sceneImageUrl: string | null;
  contentId: number;
  contentTitle: string;
  liked: boolean;
  likeCount: number;
}

export interface Hero {
  monthLabel: string;
  tag: string;
  title: string;
  subtitle: string;
  contentId: number;
  primaryPlaceId: number;
}

export interface HomeResponse {
  hero: Hero;
  contents: ContentSummary[];
  places: PlaceSummary[];
  // Added in task #24 alongside backend #23. Optional so older servers
  // keep working — the frontend just renders an empty carousel.
  popularContents?: PopularContent[];
}

// 'POPULAR_CONTENTS' swaps the grid from places → contents (task #24 refactor).
// No network round-trip is needed — popularContents ships on every /api/home
// response, so the store just flips the view mode.
export type HomeScope = 'NEAR' | 'TRENDING' | 'POPULAR_CONTENTS';

interface FetchOptions {
  lat?: number;
  lng?: number;
  // 단위 km. NEAR scope 에서만 의미가 있고, 서버는 기본 30km 로 가정한다.
  // 프런트가 반경 토글을 제공할 땐 여기에 명시적으로 실어 보낸다.
  radiusKm?: number;
}

interface State {
  hero: Hero | null;
  contents: ContentSummary[];
  places: PlaceSummary[];
  popularContents: PopularContent[];
  loading: boolean;
  error: string | null;
  selectedContentId: number | null;
  scope: HomeScope;
}

export const useHomeStore = defineStore('home', {
  state: (): State => ({
    hero: null,
    contents: [],
    places: [],
    popularContents: [],
    loading: false,
    error: null,
    selectedContentId: null,
    // 첫 진입에선 위치 권한 팝업을 띄우지 않기 위해 TRENDING 으로 시작한다.
    // 사용자가 '내 위치 근처' 탭을 실제로 탭할 때 비로소 NEAR 로 전환된다.
    scope: 'TRENDING',
  }),
  actions: {
    async fetchHome(opts: FetchOptions = {}): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        // 작품 탭(selectedContentId !== null) 에서는 segmented 가 UI 상 숨겨지고
        // "그 작품의 trending places" 만 보여주는 단일 모드. state.scope 는
        // 모두 탭으로 복귀했을 때 사용자의 직전 선택을 복원하기 위해 그대로
        // 보존하되, 서버 호출에는 항상 TRENDING 을 보낸다 — POPULAR_CONTENTS 로
        // 작품 탭 들어왔을 때 백엔드가 잘못된 scope 를 보고 엉뚱한 정렬을
        // 반환하던 버그(작품 탭에서 모든 작품 카드가 보이던 케이스) 를 차단.
        const effectiveScope = this.selectedContentId !== null ? 'TRENDING' : this.scope;
        const params: Record<string, string | number> = { scope: effectiveScope };
        if (this.selectedContentId !== null) params.contentId = this.selectedContentId;
        if (typeof opts.lat === 'number') params.lat = opts.lat;
        if (typeof opts.lng === 'number') params.lng = opts.lng;
        if (typeof opts.radiusKm === 'number') params.radiusKm = opts.radiusKm;
        const { data } = await api.get<HomeResponse>('/api/home', { params });
        this.hero = data.hero;
        this.contents = data.contents;
        this.places = data.places;
        this.popularContents = data.popularContents ?? [];
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load home';
      } finally {
        this.loading = false;
      }
    },
    async setContent(id: number | null): Promise<void> {
      if (this.selectedContentId === id) return;
      this.selectedContentId = id;
      await this.fetchHome();
    },
    async setScope(s: HomeScope, opts?: FetchOptions): Promise<void> {
      // 같은 scope 여도 opts (radius 토글 등) 가 들어오면 재요청해야 하므로
      // opts 없을 때만 short-circuit.
      if (this.scope === s && !opts) return;
      this.scope = s;
      // POPULAR_CONTENTS is a view-only toggle — contents grid renders from the
      // already-hydrated popularContents array, no network round-trip needed.
      // NEAR / TRENDING affect the server-side place sort, so those still
      // refetch.
      if (s === 'POPULAR_CONTENTS') return;
      await this.fetchHome(opts ?? {});
    },
    async toggleLike(placeId: number): Promise<void> {
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('좋아요는 로그인 후 이용할 수 있어요.');
        return;
      }
      const place = this.places.find((p) => p.id === placeId);
      if (!place) return;
      // Optimistic flip — 사용자가 하트를 누르는 즉시 색이 바뀌어야 한다.
      // 이전 버전은 API 응답을 기다린 뒤에야 상태를 바꿔서 느린 네트워크에선
      // "눌렀는데 반응이 없네?" 하고 두 번 누르는 문제가 있었음.
      const prevLiked = place.liked;
      const prevLikeCount = place.likeCount;
      place.liked = !prevLiked;
      place.likeCount = prevLikeCount + (place.liked ? 1 : -1);
      try {
        const { data } = await api.post<{ liked: boolean; likeCount: number }>(
          `/api/places/${placeId}/like`,
        );
        // 서버 진실로 덮어쓰기 — 동시 토글 등으로 optimistic 값과 다를 수 있다.
        place.liked = data.liked;
        place.likeCount = data.likeCount;
      } catch (e) {
        // 롤백 + 한국어 에러. 호출부 (HomePage onToggleLike) 가 store.error 를
        // 토스트로 띄우므로 이 메시지가 사용자에게 그대로 보인다.
        place.liked = prevLiked;
        place.likeCount = prevLikeCount;
        this.error = e instanceof Error ? e.message : '좋아요를 저장하지 못했어요';
      }
    },
  },
});
