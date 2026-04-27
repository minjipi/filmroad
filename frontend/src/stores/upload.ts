import { defineStore } from 'pinia';
import exifr from 'exifr';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { compressDataUrl, dataUrlByteSize } from '@/utils/imageCompress';
import { requestLocation } from '@/composables/useGeolocation';

// Server-side multipart cap is 10MB/file; we enforce a stricter 5MB cap per
// file after compression so even a failed compression round-trip stays well
// under the server limit with headroom for meta + boundaries.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Per-batch cap so a 5-file upload can't exceed the backend's 30MB request
// ceiling. Leaves 5MB for meta + multipart boundaries.
const MAX_BATCH_UPLOAD_BYTES = 25 * 1024 * 1024;
// Mirror of the backend's per-batch file count limit (task #44).
export const MAX_PHOTOS_PER_POST = 5;

// 제품 사양: 인증샷 공개 범위는 "전체공개 / 비공개" 두 가지. FOLLOWERS 는
// 초기 디자인에서 잠깐 검토됐다가 제외 — 토글 UI 도 PUBLIC ↔ PRIVATE.
export type Visibility = 'PUBLIC' | 'PRIVATE';

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
  // 업로드 직전 레벨 — level !== previousLevel 일 때만 레벨업 연출을 띄운다.
  previousLevel: number;
  levelName: string;
  newBadges: RewardBadge[];
}

// A single image inside a multi-image post (task #45a/b 1:N model). The lead
// frame's fields still live at the top level of PhotoResponse for backward
// compatibility; `images` carries the whole batch (length >= 1) in
// imageOrderIndex order. `id` here is the PlacePhotoImage row id, separate
// from the post's `id`.
export interface PhotoImageSummary {
  id: number;
  imageUrl: string;
  imageOrderIndex: number;
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
  /** All photos uploaded in this batch — length 1 for a single-image post. */
  images: PhotoImageSummary[];
  stamp?: StampProgress;
  reward?: RewardDelta;
  // Scoring fields (task #2 backend) — present once the scoring service ships.
  // Backend currently emits these on every PhotoUploadResponse / PhotoDetailResponse:
  //   totalScore = round(similarityScore * 0.6 + gpsScore * 0.4), clamped [0,100]
  //   similarityScore = pHash distance → linear 0..100
  //   gpsScore = haversine distance → linear 0..100 (50m → 80, 200m → 50, 1km+ → 0)
  // Pre-feature rows (and rows with neither coords nor scene image) come back with
  // all three at 0; we don't get a separate `scored: boolean` flag from the API.
  totalScore?: number | null;
  similarityScore?: number | null;
  gpsScore?: number | null;
  // Server-normalized capture coordinates. Out-of-range or one-sided submissions
  // get coerced to null on the backend (no 400). Useful for "where you stood"
  // pins on later screens — not surfaced in the score overlay itself.
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
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

/**
 * 업로드 좌표 결정 — 백엔드 채점/뱃지 게이트의 입력값.
 *
 * 1. 첫 번째 사진의 EXIF GPS 가 있으면 그걸 사용 (사용자가 현장에서 찍고
 *    집/이동 중에 업로드하는 흔한 케이스를 살림. 카메라 앱이 GPS 를 EXIF
 *    에 박아둠).
 * 2. EXIF 가 없거나 (0, 0) 같이 무효한 fix 면 디바이스 geolocation
 *    fallback (인앱 카메라/스크린샷 등 EXIF 가 없는 케이스).
 * 3. 둘 다 실패하면 null — 백엔드는 gpsScore=0 으로 처리, 보상 미지급.
 *
 * 모든 단계가 catch-all 로 감싸져 좌표를 못 얻어도 업로드 자체는 진행.
 */
async function resolveUploadGps(firstPhotoDataUrl: string | undefined): Promise<{
  latitude: number | undefined;
  longitude: number | undefined;
}> {
  if (firstPhotoDataUrl) {
    try {
      const blob = dataUrlToBlob(firstPhotoDataUrl);
      // exifr 는 GPS 가 없으면 undefined 반환 (throw X).
      const gps = await exifr.gps(blob);
      const lat = gps?.latitude;
      const lng = gps?.longitude;
      // (0, 0) 은 카메라가 fix 못 잡았을 때 자주 박는 dummy. 안전하게 무시.
      if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
        return { latitude: lat, longitude: lng };
      }
    } catch {
      // EXIF 파싱 실패 → fallback 진행.
    }
  }
  try {
    const res = await requestLocation({ timeoutMs: 5000 });
    if (res.ok) {
      return { latitude: res.coords.lat, longitude: res.coords.lng };
    }
  } catch {
    // jsdom 등 navigator.geolocation 부재 환경 안전.
  }
  return { latitude: undefined, longitude: undefined };
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
    addPhoto(dataUrl: string): boolean {
      if (this.photos.length >= MAX_PHOTOS_PER_POST) {
        this.error = `최대 ${MAX_PHOTOS_PER_POST}장까지 올릴 수 있어요`;
        return false;
      }
      this.photos.push(dataUrl);
      this.selectedIndex = this.photos.length - 1;
      return true;
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
      if (this.photos.length > MAX_PHOTOS_PER_POST) {
        this.error = `한 번에 최대 ${MAX_PHOTOS_PER_POST}장까지 올릴 수 있어요`;
        return null;
      }
      this.loading = true;
      this.uploadProgress = 0;
      this.error = null;
      try {
        // Compress each photo in order (matches backend imageOrderIndex asc).
        // Mobile capture can be 5–12 MB; cap longest side at 1600px / JPEG 0.85
        // so typical uploads land under ~500 KB without visible quality loss.
        // EXIF rotation is applied inside compressDataUrl via createImageBitmap.
        const form = new FormData();
        let totalBytes = 0;
        for (let i = 0; i < this.photos.length; i += 1) {
          const dataUrl = await compressDataUrl(this.photos[i], { maxPx: 1600, quality: 0.85 });
          const bytes = dataUrlByteSize(dataUrl);
          if (bytes > MAX_UPLOAD_BYTES) {
            const mb = (bytes / (1024 * 1024)).toFixed(1);
            this.error = `${i + 1}번째 사진이 너무 커요 (${mb}MB). 각 사진은 5MB 이하여야 해요.`;
            return null;
          }
          totalBytes += bytes;
          if (totalBytes > MAX_BATCH_UPLOAD_BYTES) {
            const mb = (totalBytes / (1024 * 1024)).toFixed(1);
            this.error = `사진 총 크기가 너무 커요 (${mb}MB). 합계 25MB 이하만 업로드할 수 있어요.`;
            return null;
          }
          const blob = dataUrlToBlob(dataUrl);
          const ext = extForMime(blob.type);
          form.append('files', blob, `capture-${i}.${ext}`);
        }
        // GPS 결정 — 첫 사진의 EXIF 우선, 없으면 디바이스 geolocation fallback.
        // 둘 다 실패하면 좌표 없이 업로드 (백엔드 gpsScore=0 → 보상 미지급).
        const { latitude, longitude } = await resolveUploadGps(this.photos[0]);

        const meta = {
          placeId: this.targetPlace.placeId,
          caption: this.caption.trim() || undefined,
          tags: this.tags.length > 0 ? this.tags.join(',') : undefined,
          visibility: this.visibility,
          addToStampbook: this.addToStampbook,
          latitude,
          longitude,
        };
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
