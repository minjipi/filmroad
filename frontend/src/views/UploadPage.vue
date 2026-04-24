<template>
  <ion-page>
    <ion-content :fullscreen="true" class="up-content">
      <header class="top">
        <span class="cancel" @click="onCancel">취소</span>
        <h1>인증샷 올리기</h1>
        <button
          class="post"
          type="button"
          :disabled="!canShare"
          @click="onShare"
        >
          {{ loading ? `공유 중 ${uploadProgress}%` : '공유하기' }}
        </button>
      </header>
      <div v-if="loading" class="upload-progress" data-testid="upload-progress">
        <div class="upload-progress-fill" :style="{ width: uploadProgress + '%' }" />
      </div>

      <!-- Offline banner — rendered whenever navigator.onLine is false.
           Pairs with the disabled "공유하기" button so the user has a clear
           explanation rather than a silently-inactive CTA. -->
      <div
        v-if="!online"
        class="upload-offline"
        role="status"
        data-testid="upload-offline-banner"
      >
        <ion-icon :icon="cloudOfflineOutline" class="ic-18" />
        <span>인터넷 연결을 확인해 주세요</span>
      </div>

      <!-- Persistent error banner with a retry button. Only rendered when
           a prior submit failed — the toast dismisses quickly, but users on
           flaky networks need a visible affordance to tap again. -->
      <div
        v-if="!loading && errorText"
        class="upload-error"
        role="alert"
        data-testid="upload-error-banner"
      >
        <div class="err-text">{{ errorText }}</div>
        <button
          type="button"
          class="err-retry"
          data-testid="upload-retry"
          @click="onRetry"
        >
          재시도
        </button>
      </div>

      <div class="up-scroll no-scrollbar">
        <div v-if="selectedPhoto" class="preview-wrap">
          <div class="preview">
            <img :src="selectedPhoto" alt="preview" />
            <div v-if="targetPlace" class="sticker-label">
              <ion-icon :icon="sparklesOutline" class="ic-16" />장면 비교 ON
            </div>
            <div v-if="targetPlace" class="frame-sticker">
              <div class="ico"><ion-icon :icon="filmOutline" class="ic-18" /></div>
              <div>
                <div class="t">
                  {{ targetPlace.workTitle }}<span v-if="targetPlace.workEpisode"> · {{ targetPlace.workEpisode }}</span>
                </div>
                <div class="s">{{ targetPlace.placeName }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="thumbs no-scrollbar">
          <div
            v-for="(p, i) in photos"
            :key="i"
            :class="['t', i === selectedIndex ? 'sel' : '']"
            @click="onSelectThumb(i)"
          >
            <img :src="p" :alt="`thumb-${i}`" />
          </div>
          <label class="plus">
            <ion-icon :icon="addOutline" class="ic-22" />
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="file-input"
              @change="onFilePick"
            />
          </label>
        </div>

        <div class="fields">
          <div class="field">
            <textarea
              class="caption"
              placeholder="이 장면에 대한 이야기를 들려주세요..."
              :value="caption"
              @input="onCaptionInput"
            />
            <div class="tags">
              <span v-for="t in tags" :key="t" class="tag">#{{ t }}</span>
              <span class="tag gray">+ 태그 추가</span>
            </div>
          </div>

          <template v-if="targetPlace">
            <div class="field row-field">
              <div class="ico"><ion-icon :icon="filmOutline" class="ic-20" /></div>
              <div>
                <div class="k">작품</div>
                <div class="v">
                  {{ targetPlace.workTitle }}<span v-if="targetPlace.workEpisode"> · {{ targetPlace.workEpisode }}</span>
                </div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
            </div>

            <div class="field row-field" data-testid="target-place-row" @click="onOpenPicker">
              <div class="ico"><ion-icon :icon="locationOutline" class="ic-20" /></div>
              <div class="grow">
                <div class="k">위치</div>
                <div class="v">{{ targetPlace.placeName }}</div>
              </div>
              <span class="change-link">변경</span>
            </div>
          </template>

          <!-- No place attached yet (bottom-nav camera CTA entry). Show a
               single CTA that opens the picker; "공유하기" stays disabled
               until the user picks something. -->
          <button
            v-else
            class="field row-field place-cta"
            type="button"
            data-testid="pick-place-cta"
            @click="onOpenPicker"
          >
            <div class="ico"><ion-icon :icon="locationOutline" class="ic-20" /></div>
            <div class="grow">
              <div class="k">장소</div>
              <div class="v missing">장소를 선택해 주세요</div>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
          </button>

          <div class="field row-field">
            <div class="ico"><ion-icon :icon="peopleOutline" class="ic-20" /></div>
            <div class="grow">
              <div class="k">함께 간 사람</div>
              <div class="v">친구 태그하기</div>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
          </div>

          <div class="field row-field">
            <div class="ico stampbook"><ion-icon :icon="ribbonOutline" class="ic-20" /></div>
            <div class="grow">
              <div class="k">스탬프북에 추가</div>
              <div class="v">{{ addToStampbook ? '수집 대상' : '추가 안 함' }}</div>
            </div>
            <button
              class="toggle"
              :class="{ off: !addToStampbook }"
              type="button"
              aria-label="stampbook"
              @click="onToggleStampbook"
            />
          </div>

          <div class="field row-field">
            <div class="ico visibility"><ion-icon :icon="globeOutline" class="ic-20" /></div>
            <div class="grow">
              <div class="k">공개 범위</div>
              <div class="v">{{ visibilityLabel }}</div>
            </div>
            <button
              class="toggle"
              :class="{ off: visibility !== 'PUBLIC' }"
              type="button"
              aria-label="visibility"
              @click="onToggleVisibility"
            />
          </div>
        </div>
      </div>

      <!-- Place picker sheet. Backdrop-only dismiss; the list is a client-
           side filter over home places (recent/popular) — no dedicated
           search API yet, see task #15 brief. -->
      <div
        v-if="pickerOpen"
        class="picker-backdrop"
        data-testid="picker-backdrop"
        @click.self="onClosePicker"
      >
        <div class="picker-sheet" role="dialog" aria-label="장소 선택">
          <header class="picker-head">
            <h2>장소 선택</h2>
            <button type="button" aria-label="닫기" class="picker-close" @click="onClosePicker">
              <ion-icon :icon="closeOutline" class="ic-20" />
            </button>
          </header>

          <div class="picker-search">
            <ion-icon :icon="searchOutline" class="ic-18 search-ic" />
            <input
              v-model="pickerQuery"
              type="search"
              enterkeyhint="search"
              placeholder="촬영지나 작품을 검색해 보세요"
            />
          </div>

          <div class="picker-list no-scrollbar">
            <button
              v-for="p in pickerResults"
              :key="p.id"
              type="button"
              class="picker-item"
              data-testid="picker-item"
              @click="onPickPlace(p)"
            >
              <div class="thumb">
                <img v-if="p.coverImageUrl" :src="p.coverImageUrl" :alt="p.name" />
              </div>
              <div class="meta">
                <div class="t">{{ p.name }}</div>
                <div class="s">{{ p.workTitle }} · {{ p.regionLabel }}</div>
              </div>
            </button>
            <div v-if="pickerResults.length === 0" class="picker-empty">
              <span v-if="pickerQuery.trim()">검색 결과가 없어요</span>
              <span v-else>홈에서 장소를 더 둘러본 뒤 다시 시도해 주세요</span>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  sparklesOutline,
  filmOutline,
  locationOutline,
  peopleOutline,
  ribbonOutline,
  globeOutline,
  chevronForwardOutline,
  addOutline,
  closeOutline,
  searchOutline,
  cloudOfflineOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUploadStore } from '@/stores/upload';
import { useHomeStore, type PlaceSummary } from '@/stores/home';
import { useToast } from '@/composables/useToast';
import { useOnline } from '@/composables/useOnline';

const router = useRouter();
const uploadStore = useUploadStore();
const homeStore = useHomeStore();
const { targetPlace, photos, selectedIndex, caption, tags, visibility, addToStampbook, loading, uploadProgress, error: errorText } = storeToRefs(uploadStore);
const selectedPhoto = computed(() => uploadStore.selectedPhoto);
const { showError, showInfo } = useToast();
const online = useOnline();

const fileInput = ref<HTMLInputElement | null>(null);

const visibilityLabel = computed(() => {
  if (visibility.value === 'PUBLIC') return '전체 공개';
  if (visibility.value === 'FOLLOWERS') return '팔로워 공개';
  return '나만 보기';
});

// "공유하기" needs both a place and at least one photo. The button text/state
// reflects what's missing so the user isn't left guessing. Offline browsers
// get the same disabled treatment — submit would bail with a clearer error
// anyway, but showing "공유하기" as tappable when there's no network feels
// dishonest.
const canShare = computed(
  () =>
    !loading.value &&
    targetPlace.value !== null &&
    photos.value.length > 0 &&
    online.value,
);

// ---------- Place picker ----------
const pickerOpen = ref(false);
const pickerQuery = ref('');

const pickerResults = computed<PlaceSummary[]>(() => {
  const q = pickerQuery.value.trim().toLowerCase();
  const source = homeStore.places;
  if (!q) return source;
  return source.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.workTitle.toLowerCase().includes(q) ||
      p.regionLabel.toLowerCase().includes(q)
    );
  });
});

async function onOpenPicker(): Promise<void> {
  pickerQuery.value = '';
  pickerOpen.value = true;
  // Lazy fetch — if the home tab hasn't been visited yet this session, fetch
  // once so the picker has something to show.
  if (homeStore.places.length === 0 && !homeStore.loading) {
    await homeStore.fetchHome();
  }
}

function onClosePicker(): void {
  pickerOpen.value = false;
}

function onPickPlace(p: PlaceSummary): void {
  uploadStore.setTargetPlace({
    placeId: p.id,
    workId: p.workId,
    workTitle: p.workTitle,
    workEpisode: null,
    placeName: p.name,
    // Home summary doesn't carry a scene reference — leave null so the
    // upload preview hides the "장면 비교 ON" sticker until the user
    // re-enters via PlaceDetail for that spot.
    sceneImageUrl: null,
  });
  pickerOpen.value = false;
}

function onCaptionInput(e: Event): void {
  const target = e.target as HTMLTextAreaElement;
  uploadStore.setCaption(target.value);
}

function onSelectThumb(idx: number): void {
  uploadStore.selectPhoto(idx);
}

function onToggleStampbook(): void {
  uploadStore.toggleStampbook();
}

function onToggleVisibility(): void {
  uploadStore.setVisibility(visibility.value === 'PUBLIC' ? 'FOLLOWERS' : 'PUBLIC');
}

async function onFilePick(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    await showError('jpg, png, webp 형식만 올릴 수 있어요');
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  uploadStore.addPhoto(dataUrl);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function onCancel(): Promise<void> {
  uploadStore.reset();
  await router.replace('/home');
}

async function onShare(): Promise<void> {
  const placeId = targetPlace.value?.placeId;
  const res = await uploadStore.submit();
  if (!res) {
    if (uploadStore.error) await showError(uploadStore.error);
    return;
  }
  await showInfo('인증샷이 공유되었습니다');
  await router.replace(`/reward/${placeId ?? res.placeId}`);
}

// Re-attempt a failed upload. Uses the same state as onShare — photos,
// caption, tags, visibility are all still populated. On success, behaves
// identically to the first attempt (info toast + redirect to reward).
async function onRetry(): Promise<void> {
  const placeId = targetPlace.value?.placeId;
  const res = await uploadStore.retry();
  if (!res) {
    if (uploadStore.error) await showError(uploadStore.error);
    return;
  }
  await showInfo('인증샷이 공유되었습니다');
  await router.replace(`/reward/${placeId ?? res.placeId}`);
}

onMounted(async () => {
  // Only bounce when there's literally nothing to upload. A no-target entry
  // (bottom-nav camera CTA) lands here with photos already shot — the user
  // picks a place via the sheet below and shares from there.
  if (photos.value.length === 0) {
    await router.replace('/home');
  }
});
</script>

<style scoped>
ion-content.up-content {
  --background: #ffffff;
}

.top {
  padding: calc(8px + env(safe-area-inset-top)) 16px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--fr-line);
  background: #ffffff;
}
.top h1 {
  margin: 0;
  font-size: 17px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.cancel {
  color: var(--fr-ink-3);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
.post {
  background: var(--fr-primary);
  color: #ffffff;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
}
.post[disabled] { opacity: 0.6; cursor: default; }

.upload-progress {
  height: 3px;
  background: var(--fr-line-soft);
  overflow: hidden;
}
.upload-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--fr-primary), #7c3aed);
  transition: width 0.15s ease-out;
}

/* Offline banner — stays visible until the connection returns (reactive
   via useOnline composable on window online/offline events). */
.upload-offline {
  margin: 10px 16px 0;
  padding: 10px 12px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: #92400e;
}

/* Inline error banner with retry button — stays visible until the user
   acts, so flaky-network retries aren't gated on catching the toast. */
.upload-error {
  margin: 10px 16px 0;
  padding: 10px 12px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #be123c;
}
.upload-error .err-text {
  flex: 1;
  line-height: 1.35;
}
.upload-error .err-retry {
  background: #be123c;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.up-scroll {
  overflow-y: auto;
}

.preview-wrap {
  padding: 16px 16px 0;
  position: relative;
}
.preview {
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: 18px;
  overflow: hidden;
  background: #000;
  position: relative;
}
.preview img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.sticker-label {
  position: absolute;
  top: 14px; right: 14px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  display: flex; align-items: center; gap: 5px;
  backdrop-filter: blur(8px);
}
.frame-sticker {
  position: absolute;
  left: 14px; bottom: 14px;
  background: linear-gradient(135deg, rgba(20, 188, 237, 0.95), rgba(14, 165, 212, 0.95));
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 12px;
  display: flex; align-items: center; gap: 8px;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.4);
}
.frame-sticker .ico {
  width: 24px; height: 24px;
  border-radius: 7px;
  background: #ffffff;
  color: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
}
.frame-sticker .t { font-size: 11.5px; font-weight: 800; line-height: 1.1; }
.frame-sticker .s { font-size: 9px; opacity: 0.9; line-height: 1.1; margin-top: 2px; }

.thumbs {
  display: flex; gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
}
.thumbs .t {
  width: 60px; height: 60px;
  border-radius: 12px;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  border: 2px solid transparent;
  cursor: pointer;
}
.thumbs .t.sel { border-color: var(--fr-primary); }
.thumbs .t img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumbs .plus {
  width: 60px; height: 60px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  display: flex; align-items: center; justify-content: center;
  color: var(--fr-ink-3);
  border: 1.5px dashed var(--fr-line);
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
}
.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.fields {
  padding: 4px 16px calc(100px + env(safe-area-inset-bottom));
}
.field {
  padding: 16px 0;
  border-bottom: 1px solid var(--fr-line);
}
.caption {
  width: 100%;
  border: none;
  font-size: 14.5px;
  resize: none;
  outline: none;
  min-height: 76px;
  font-family: inherit;
  letter-spacing: -0.01em;
  color: var(--fr-ink);
  background: transparent;
}
.caption::placeholder { color: var(--fr-ink-4); }

.row-field {
  display: flex;
  align-items: center;
  gap: 12px;
}
.row-field .ico {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.row-field .ico.stampbook { background: #fff1f2; color: var(--fr-coral); }
.row-field .ico.visibility { background: #eff6ff; color: #2563eb; }
.row-field .k { font-size: 12px; color: var(--fr-ink-3); }
.row-field .v {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 1px;
}
.row-field .grow { flex: 1; }
.row-field .chev { color: var(--fr-ink-4); margin-left: auto; }

.tags {
  display: flex; gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.tag {
  font-size: 12px;
  color: var(--fr-primary);
  background: var(--fr-primary-soft);
  padding: 5px 11px;
  border-radius: 999px;
  font-weight: 700;
}
.tag.gray {
  color: var(--fr-ink-2);
  background: var(--fr-bg-muted);
  cursor: pointer;
}

.toggle {
  width: 42px; height: 24px;
  background: var(--fr-primary);
  border-radius: 999px;
  position: relative;
  border: none;
  cursor: pointer;
}
.toggle::after {
  content: '';
  position: absolute;
  right: 3px; top: 3px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #ffffff;
}
.toggle.off { background: #cbd5e1; }
.toggle.off::after { left: 3px; right: auto; }

/* "장소 선택" CTA — shown when no targetPlace yet (camera-first flow). */
.place-cta {
  background: transparent;
  width: 100%;
  border: none;
  padding: 16px 0;
  border-bottom: 1px solid var(--fr-line);
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.place-cta .missing {
  color: var(--fr-primary);
}
.change-link {
  font-size: 12px;
  color: var(--fr-primary);
  font-weight: 700;
  padding: 4px 10px;
  background: var(--fr-primary-soft);
  border-radius: 999px;
  margin-left: auto;
}

/* Place picker sheet. Backdrop + bottom sheet — minimal Ionic-free modal
   so the unit tests can drive it without stubbing ion-modal internals. */
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.picker-sheet {
  width: 100%;
  max-width: 480px;
  max-height: 82vh;
  background: #ffffff;
  border-radius: 22px 22px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.24);
}
.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 8px;
}
.picker-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.picker-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.picker-search {
  position: relative;
  margin: 4px 20px 10px;
  padding: 0 14px 0 42px;
  height: 44px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
}
.picker-search .search-ic {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fr-ink-4);
}
.picker-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 14px;
  color: var(--fr-ink);
}
.picker-search input::placeholder {
  color: var(--fr-ink-4);
}
.picker-list {
  overflow-y: auto;
  padding: 4px 8px 16px;
  flex: 1;
}
.picker-item {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.picker-item:hover {
  background: var(--fr-bg-muted);
}
.picker-item .thumb {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: #eef2f6;
  overflow: hidden;
  flex-shrink: 0;
}
.picker-item .thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.picker-item .meta {
  flex: 1;
  min-width: 0;
}
.picker-item .meta .t {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-item .meta .s {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-empty {
  padding: 32px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--fr-ink-3);
}
</style>
