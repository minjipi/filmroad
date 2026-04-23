import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';

export type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

export interface CaptureTarget {
  placeId: number;
  workId: number;
  workTitle: string;
  workEpisode: string | null;
  placeName: string;
  sceneImageUrl: string | null;
}

export interface StampProgress {
  placeName: string;
  workId: number;
  workTitle: string;
  collectedCount: number;
  totalCount: number;
  percent: number;
}

export interface RewardBadge {
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

export interface RewardDelta {
  pointsEarned: number;
  currentPoints: number;
  streakDays: number;
  level: number;
  levelName: string;
  newBadges: RewardBadge[];
}

export interface PhotoResponse {
  id: number;
  imageUrl: string;
  placeId: number;
  workId: number;
  workTitle: string;
  workEpisode: string | null;
  caption: string | null;
  tags: string[];
  visibility: Visibility;
  createdAt: string;
  stamp?: StampProgress;
  reward?: RewardDelta;
}

interface State {
  targetPlace: CaptureTarget | null;
  photos: string[];
  selectedIndex: number;
  caption: string;
  tags: string[];
  visibility: Visibility;
  addToStampbook: boolean;
  loading: boolean;
  error: string | null;
  lastResult: PhotoResponse | null;
}

const DEFAULT_TAGS: string[] = [];

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mimeMatch = /data:([^;]+);/.exec(header);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const isBase64 = header.includes(';base64');
  const bytes = isBase64 ? atob(body) : decodeURIComponent(body);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export const useUploadStore = defineStore('upload', {
  state: (): State => ({
    targetPlace: null,
    photos: [],
    selectedIndex: 0,
    caption: '',
    tags: [...DEFAULT_TAGS],
    visibility: 'PUBLIC',
    addToStampbook: true,
    loading: false,
    error: null,
    lastResult: null,
  }),
  getters: {
    selectedPhoto: (state): string | null =>
      state.photos[state.selectedIndex] ?? null,
  },
  actions: {
    beginCapture(target: CaptureTarget): void {
      this.targetPlace = target;
      this.photos = [];
      this.selectedIndex = 0;
      this.caption = '';
      this.tags = [...DEFAULT_TAGS];
      this.visibility = 'PUBLIC';
      this.addToStampbook = true;
      this.error = null;
      this.lastResult = null;
    },
    addPhoto(dataUrl: string): void {
      this.photos.push(dataUrl);
      this.selectedIndex = this.photos.length - 1;
    },
    selectPhoto(idx: number): void {
      if (idx < 0 || idx >= this.photos.length) return;
      this.selectedIndex = idx;
    },
    removePhoto(idx: number): void {
      if (idx < 0 || idx >= this.photos.length) return;
      this.photos.splice(idx, 1);
      if (this.selectedIndex >= this.photos.length) {
        this.selectedIndex = Math.max(0, this.photos.length - 1);
      }
    },
    setCaption(s: string): void {
      this.caption = s;
    },
    setVisibility(v: Visibility): void {
      this.visibility = v;
    },
    toggleStampbook(): void {
      this.addToStampbook = !this.addToStampbook;
    },
    setTags(tags: string[]): void {
      this.tags = [...tags];
    },
    async submit(): Promise<PhotoResponse | null> {
      if (!this.targetPlace) {
        this.error = '촬영 대상이 설정되지 않았어요';
        return null;
      }
      if (this.photos.length === 0) {
        this.error = '사진을 먼저 선택해주세요';
        return null;
      }
      if (!useAuthStore().isAuthenticated) {
        useUiStore().showLoginPrompt('인증샷 업로드는 로그인 후 이용할 수 있어요.');
        return null;
      }
      this.loading = true;
      this.error = null;
      try {
        const dataUrl = this.photos[this.selectedIndex] ?? this.photos[0];
        const blob = dataUrlToBlob(dataUrl);
        const ext = extForMime(blob.type);
        const meta = {
          placeId: this.targetPlace.placeId,
          caption: this.caption.trim() || undefined,
          tags: this.tags.length > 0 ? this.tags.join(',') : undefined,
          visibility: this.visibility,
          addToStampbook: this.addToStampbook,
        };
        const form = new FormData();
        form.append('file', blob, `capture.${ext}`);
        form.append('meta', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
        const { data } = await api.post<PhotoResponse>('/api/photos', form);
        this.lastResult = data;
        return data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Upload failed';
        return null;
      } finally {
        this.loading = false;
      }
    },
    reset(): void {
      this.targetPlace = null;
      this.photos = [];
      this.selectedIndex = 0;
      this.caption = '';
      this.tags = [...DEFAULT_TAGS];
      this.visibility = 'PUBLIC';
      this.addToStampbook = true;
      this.error = null;
      this.loading = false;
      this.lastResult = null;
    },
  },
});
