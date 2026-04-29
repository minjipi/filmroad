import { defineStore } from 'pinia';
import api from '@/services/api';
import type { PlaceScene } from '@/stores/placeDetail';

export type WorkDetailChip = 'SPOTS' | 'INFO' | 'CAST' | 'FANS';

export interface WorkDetailWork {
  id: number;
  title: string;
  subtitle: string | null;
  yearStart: number | null;
  kind: string;
  posterUrl: string;
  coverUrl: string;
  ratingAverage: number;
  episodeCount: number | null;
  network: string | null;
  synopsis: string | null;
}

export interface WorkDetailProgress {
  collectedCount: number;
  totalCount: number;
  percent: number;
  nextBadgeText: string | null;
}

export interface WorkDetailSpot {
  placeId: number;
  name: string;
  regionShort: string;
  coverImageUrls: string[];
  /**
   * 작품 씬 목록 — `orderIndex` ASC. 0번이 대표. 회차/타임스탬프/설명/이미지 URL
   * 4종 모두 이 안. 빈 배열 가능. spot card 노출 시 첫 씬을 사용한다.
   */
  scenes: PlaceScene[];
  visited: boolean;
  visitedAt: string | null;
  orderIndex: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface WorkDetailResponse {
  work: WorkDetailWork;
  progress: WorkDetailProgress;
  spots: WorkDetailSpot[];
}

interface State {
  work: WorkDetailWork | null;
  progress: WorkDetailProgress | null;
  spots: WorkDetailSpot[];
  activeChip: WorkDetailChip;
  loading: boolean;
  error: string | null;
}

export const useWorkDetailStore = defineStore('workDetail', {
  state: (): State => ({
    work: null,
    progress: null,
    spots: [],
    activeChip: 'SPOTS',
    loading: false,
    error: null,
  }),
  actions: {
    async fetch(workId: number): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<WorkDetailResponse>(`/api/works/${workId}`);
        this.work = data.work;
        this.progress = data.progress;
        this.spots = data.spots;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load work';
      } finally {
        this.loading = false;
      }
    },
    setChip(c: WorkDetailChip): void {
      this.activeChip = c;
    },
    /**
     * task #25: clear stale state on page leave so a re-entry into a
     * different `/work/:id` doesn't flash the previous work's spots.
     */
    reset(): void {
      this.work = null;
      this.progress = null;
      this.spots = [];
      this.activeChip = 'SPOTS';
      this.loading = false;
      this.error = null;
    },
  },
});
