import { defineStore } from 'pinia';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { compressDataUrl, dataUrlByteSize } from '@/utils/imageCompress';

// Server-side multipart cap is 10MB; we enforce a stricter 5MB cap after
// compression so even a failed compression round-trip stays well under the
// server limit with headroom for meta + boundaries.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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
  uploadProgress: number; // 0–100, updated during multipart upload
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
    uploadProgress: 0,
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
    // Attach / switch the place for an in-progress capture. Unlike
    // beginCapture, this keeps already-shot photos and form state so the user
    // can enter the flow via the bottom-nav camera CTA (no place selected
    // yet), shoot first, and pick the place during the upload step.
    setTargetPlace(target: CaptureTarget): void {
      this.targetPlace = target;
      this.error = null;
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
      // Offline guard — fail fast with a clear message instead of letting
      // axios wander into a network-layer error. navigator.onLine returns
      // `true` by default in jsdom, so the test env isn't affected.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.error = '인터넷에 연결되어 있지 않아요. 연결 후 다시 시도해 주세요.';
        return null;
      }
      this.loading = true;
      this.uploadProgress = 0;
      this.error = null;
      try {
        const rawDataUrl = this.photos[this.selectedIndex] ?? this.photos[0];
        // Mobile capture can be 5–12 MB; cap longest side at 1600px / JPEG 0.85
        // so typical uploads land under ~500 KB without visible quality loss.
        // EXIF rotation is applied inside compressDataUrl via createImageBitmap.
        const dataUrl = await compressDataUrl(rawDataUrl, { maxPx: 1600, quality: 0.85 });
        // Final size gate — even after compression, bail if we're over 5MB
        // so the user gets a specific error instead of a generic 413.
        const bytes = dataUrlByteSize(dataUrl);
        if (bytes > MAX_UPLOAD_BYTES) {
          const mb = (bytes / (1024 * 1024)).toFixed(1);
          this.error = `이미지가 너무 커요 (${mb}MB). 5MB 이하만 업로드할 수 있어요.`;
          return null;
        }
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
        const { data } = await api.post<PhotoResponse>('/api/photos', form, {
          onUploadProgress: (ev) => {
            if (ev.total && ev.total > 0) {
              this.uploadProgress = Math.min(100, Math.round((ev.loaded * 100) / ev.total));
            }
          },
          // Image upload can outlive the default 10s axios timeout on slow links.
          timeout: 60_000,
        });
        this.uploadProgress = 100;
        this.lastResult = data;
        return data;
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Upload failed';
        return null;
      } finally {
        this.loading = false;
      }
    },
    // Manual retry entry point for the UI. Semantically identical to
    // submit() — photos / caption / tags / visibility are all still in
    // state, so a second tap re-runs the whole flow. Having a named action
    // keeps spec assertions crisp ("retry was triggered") and leaves room
    // for future retry-specific policy (exponential backoff, dedupe token).
    async retry(): Promise<PhotoResponse | null> {
      return this.submit();
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
      this.uploadProgress = 0;
      this.lastResult = null;
    },
  },
});
