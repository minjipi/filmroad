<template>
  <ion-page>
    <ion-content :fullscreen="true" class="up-content">
      <header class="top">
        <span class="cancel" @click="onCancel">취소</span>
        <h1>인증샷 올리기</h1>
        <button class="post" type="button" :disabled="loading" @click="onShare">
          {{ loading ? '공유 중...' : '공유하기' }}
        </button>
      </header>

      <div class="up-scroll no-scrollbar">
        <div v-if="targetPlace" class="preview-wrap">
          <div class="preview">
            <img v-if="selectedPhoto" :src="selectedPhoto" alt="preview" />
            <div class="sticker-label">
              <ion-icon :icon="sparklesOutline" class="ic-16" />장면 비교 ON
            </div>
            <div class="frame-sticker">
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

          <div v-if="targetPlace" class="field row-field">
            <div class="ico"><ion-icon :icon="filmOutline" class="ic-20" /></div>
            <div>
              <div class="k">작품</div>
              <div class="v">
                {{ targetPlace.workTitle }}<span v-if="targetPlace.workEpisode"> · {{ targetPlace.workEpisode }}</span>
              </div>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
          </div>

          <div v-if="targetPlace" class="field row-field">
            <div class="ico"><ion-icon :icon="locationOutline" class="ic-20" /></div>
            <div>
              <div class="k">위치</div>
              <div class="v">{{ targetPlace.placeName }}</div>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
          </div>

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
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUploadStore } from '@/stores/upload';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const uploadStore = useUploadStore();
const { targetPlace, photos, selectedIndex, caption, tags, visibility, addToStampbook, loading } = storeToRefs(uploadStore);
const selectedPhoto = computed(() => uploadStore.selectedPhoto);
const { showError, showInfo } = useToast();

const fileInput = ref<HTMLInputElement | null>(null);

const visibilityLabel = computed(() => {
  if (visibility.value === 'PUBLIC') return '전체 공개';
  if (visibility.value === 'FOLLOWERS') return '팔로워 공개';
  return '나만 보기';
});

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

onMounted(async () => {
  if (!targetPlace.value || photos.value.length === 0) {
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
</style>
