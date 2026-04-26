import { defineStore } from 'pinia';
import api from '@/services/api';

// 카카오 로컬 API 가 안주는 필드(영업시간/리뷰)는 백엔드도 담지 않는다 — 대신
// kakaoPlaceUrl 로 바로 카카오맵 상세를 띄우는 CTA 로 대체한다.
export interface KakaoNearbyDto {
  name: string;
  // 카카오 카테고리 그룹 코드 — FD6=음식점, CE7=카페. 둘만 보낸다.
  categoryGroupCode: 'FD6' | 'CE7';
  categoryName: string;
  distanceMeters: number;
  kakaoPlaceUrl: string;
  lat: number;
  lng: number;
  phone: string | null;
}

export interface PlaceKakaoInfoResponse {
  roadAddress: string | null;
  jibunAddress: string | null;
  phone: string | null;
  category: string | null;
  kakaoPlaceUrl: string | null;
  lastSyncedAt: string | null;
  nearby: KakaoNearbyDto[];
  // available=false 면 PlaceDetailPage 가 섹션 자체를 숨긴다 — 미매핑 place 이거나
  // 카카오 키 미설정 dev 환경에서 백엔드가 placeholder 응답을 줄 때.
  available: boolean;
}

interface State {
  // placeId 별 메모리 캐시. fetch 가 실패해 null 로 박힌 항목은 "조회는 했지만
  // 정보 없음" 으로 간주해 다시 호출하지 않는다 — 같은 placeId 를 여러 번
  // 마운트해도 네트워크 1번이면 충분.
  infoByPlace: Record<number, PlaceKakaoInfoResponse | null>;
}

export const useKakaoInfoStore = defineStore('kakaoInfo', {
  state: (): State => ({
    infoByPlace: {},
  }),
  getters: {
    infoFor: (state) => (placeId: number): PlaceKakaoInfoResponse | null =>
      state.infoByPlace[placeId] ?? null,
  },
  actions: {
    async fetch(placeId: number): Promise<void> {
      // hasOwn 체크 — null 도 "이미 시도했음" 의미라 재호출하지 않는다.
      if (Object.prototype.hasOwnProperty.call(this.infoByPlace, placeId)) return;
      try {
        const { data } = await api.get<PlaceKakaoInfoResponse>(
          `/api/places/${placeId}/kakao-info`,
        );
        this.infoByPlace[placeId] = data;
      } catch (e) {
        // 카카오 섹션은 보조 정보라 실패해도 페이지 전체 UX 를 막지 않는다.
        // null 로 박아 섹션이 v-if 로 사라지고, console 에 한 줄 남긴다.
        console.warn(`[kakaoInfo] failed to load place ${placeId}:`, e);
        this.infoByPlace[placeId] = null;
      }
    },
  },
});
