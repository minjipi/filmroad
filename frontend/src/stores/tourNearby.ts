import { defineStore } from 'pinia';
import api from '@/services/api';

// task #29: 한국관광공사 TourAPI 기반 주변 맛집 데이터. 백엔드 task #28 가
// `GET /api/places/{placeId}/nearby-restaurants` 로 노출, task #30 에서
// 응답 shape 를 이 frontend contract 와 정렬. 카카오 nearby 와는 데이터
// 출처 + 필드 이름이 달라 별도 store 로 분리.
//
// 응답 envelope `{ success, code, results: { items } }` 는 axios 인터셉터가
// 자동으로 unwrap 하므로 여기선 inner shape 만 신경 쓰면 된다.
export interface TourNearbyRestaurant {
  /** TourAPI contentId — 외부 링크 / 추후 한국관광공사 페이지 라우팅에 사용. */
  contentId: string;
  title: string;
  /** 도로명 주소 (없으면 jibun 으로 fallback 가능 — 백엔드가 정규화). */
  addr1: string | null;
  /** 한국관광공사 썸네일 URL — null 일 수 있음 (사진 미등록 가게). */
  imageUrl: string | null;
  /** 등록 좌표 — UI 가 필요하면 활용 (현 시점은 안 씀). */
  latitude: number | null;
  longitude: number | null;
  /** 기준 place 로부터 직선 거리 (m). 백엔드가 계산해 내려보냄. */
  distanceM: number | null;
  /** 카테고리 라벨 (예: "한식", "카페·디저트"). null 일 수 있음. */
  categoryName: string | null;
}

export interface TourNearbyResponse {
  items: TourNearbyRestaurant[];
}

interface State {
  // placeId 별 메모리 캐시. null 도 "이미 시도, 데이터 없음" 의미로 보존.
  // 이 의미 보존 패턴은 kakaoInfo store 와 동일 — 같은 place 를 재진입해도
  // 네트워크 1번이면 충분.
  itemsByPlace: Record<number, TourNearbyRestaurant[] | null>;
}

export const useTourNearbyStore = defineStore('tourNearby', {
  state: (): State => ({
    itemsByPlace: {},
  }),
  getters: {
    itemsFor: (state) => (placeId: number): TourNearbyRestaurant[] => {
      const v = state.itemsByPlace[placeId];
      return v ?? [];
    },
  },
  actions: {
    async fetch(placeId: number): Promise<void> {
      // 이미 시도했으면 (배열이든 null 이든) 재호출 안 함. kakaoInfo 와 동일.
      if (Object.prototype.hasOwnProperty.call(this.itemsByPlace, placeId)) return;
      try {
        const { data } = await api.get<TourNearbyResponse>(
          `/api/places/${placeId}/nearby-restaurants`,
        );
        // 백엔드 task #28 미완성 시점에 응답이 비어있거나 shape 가 다를 수 있음.
        // items 가 array 면 그대로, 아니면 null 로 — 섹션은 v-if 로 자동 hide.
        if (data && Array.isArray(data.items)) {
          this.itemsByPlace[placeId] = data.items;
        } else {
          this.itemsByPlace[placeId] = null;
        }
      } catch (e) {
        // 보조 정보 (페이지 전체 UX 막지 않음) — null 로 박고 console 에 한 줄.
        // eslint-disable-next-line no-console
        console.warn(`[tourNearby] failed to load place ${placeId}:`, e);
        this.itemsByPlace[placeId] = null;
      }
    },
  },
});
