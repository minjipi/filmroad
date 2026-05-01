import { defineStore } from 'pinia';
import api from '@/services/api';

// 한국관광공사 TatsCnctrRateService 기반 혼잡도 예측. PlaceDetailPage 의 보조
// 섹션 — 백엔드가 areaCd/signguCd 로 외부 API 를 호출하고 캐시한 결과를 그대로
// 받아 카드 3개 (오늘 / 내일 / 이번 주말) 를 렌더한다.

export type CongestionState = 'OK' | 'BUSY' | 'PACK';
export type CongestionKey = 'TODAY' | 'TOMORROW' | 'WEEKEND';

export interface CongestionForecast {
  key: CongestionKey;
  /** 칩 상단 라벨 (예: "오늘", "내일", "이번 주말"). */
  label: string;
  /** 라벨 옆 보조 정보 (예: "5/1 금", "토·일 평균"). */
  dateLabel: string;
  /** 0-100 정수. */
  percent: number;
  state: CongestionState;
}

export interface CongestionResponse {
  /** 매핑 실패 / API 실패 / 데이터 없음 시 false. 그땐 forecasts 도 비어있다. */
  available: boolean;
  source: string | null;
  forecasts: CongestionForecast[];
}

interface State {
  // placeId 별 메모리 캐시. KakaoInfo 와 같은 패턴 — null 도 "이미 시도, 결과
  // 없음" 의미라 재요청하지 않는다.
  infoByPlace: Record<number, CongestionResponse | null>;
}

export const useCongestionStore = defineStore('congestion', {
  state: (): State => ({
    infoByPlace: {},
  }),
  getters: {
    infoFor: (state) => (placeId: number): CongestionResponse | null =>
      state.infoByPlace[placeId] ?? null,
  },
  actions: {
    async fetch(placeId: number): Promise<void> {
      if (Object.prototype.hasOwnProperty.call(this.infoByPlace, placeId)) return;
      try {
        const { data } = await api.get<CongestionResponse>(
          `/api/places/${placeId}/congestion`,
        );
        this.infoByPlace[placeId] = data;
      } catch (e) {
        // 보조 정보라 실패해도 페이지 전체 UX 를 막지 않음 — null 로 박아 섹션이
        // v-if 로 사라지고 console 경고만.
        console.warn(`[congestion] failed to load place ${placeId}:`, e);
        this.infoByPlace[placeId] = null;
      }
    },
  },
});
