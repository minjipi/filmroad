import { defineStore } from 'pinia';
import api from '@/services/api';

export interface StampbookHero {
  contentsCollectingCount: number;
  placesCollectedCount: number;
  badgesCount: number;
  completedContentsCount: number;
}

export interface StampbookContent {
  contentId: number;
  title: string;
  posterUrl: string;
  year: number | null;
  collectedCount: number;
  totalCount: number;
  percent: number;
  completed: boolean;
  gradient: string;
}

export interface StampbookBadge {
  badgeId: number;
  code: string;
  name: string;
  description: string | null;
  iconKey: string;
  gradient: string | null;
  acquired: boolean;
  progressText: string | null;
  acquiredAt: string | null;
}

export interface StampbookResponse {
  hero: StampbookHero;
  contents: StampbookContent[];
  recentBadges: StampbookBadge[];
}

export type StampbookFilter = 'WORKS' | 'BADGES' | 'COMPLETED' | 'IN_PROGRESS';

interface State {
  hero: StampbookHero | null;
  contents: StampbookContent[];
  recentBadges: StampbookBadge[];
  filter: StampbookFilter;
  loading: boolean;
  error: string | null;
}

export const useStampbookStore = defineStore('stampbook', {
  state: (): State => ({
    hero: null,
    contents: [],
    recentBadges: [],
    filter: 'WORKS',
    loading: false,
    error: null,
  }),
  getters: {
    visibleContents(state): StampbookContent[] {
      if (state.filter === 'COMPLETED') return state.contents.filter((w) => w.completed);
      if (state.filter === 'IN_PROGRESS') return state.contents.filter((w) => !w.completed);
      return state.contents;
    },
  },
  actions: {
    async fetch(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await api.get<StampbookResponse>('/api/stampbook');
        this.hero = data.hero;
        this.contents = data.contents;
        this.recentBadges = data.recentBadges;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load stampbook';
      } finally {
        this.loading = false;
      }
    },
    setFilter(f: StampbookFilter): void {
      this.filter = f;
    },
  },
});
