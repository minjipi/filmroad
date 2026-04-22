<template>
  <ion-page>
    <div class="cam-root">
      <div class="cam">
        <div class="cam-view">
          <video
            v-show="liveActive"
            ref="videoEl"
            class="cam-video"
            autoplay
            playsinline
            muted
          />
          <img
            v-if="!liveActive"
            :src="fallbackImage"
            :alt="targetPlace?.placeName ?? 'camera'"
            class="cam-fallback"
          />
        </div>
        <div v-if="overlaySrc && mode !== 'plain'" class="scene-overlay" :style="{ opacity: overlayOpacity / 100 }">
          <img :src="overlaySrc" alt="scene overlay" />
        </div>
        <div class="grid-lines" />
        <div class="grid-v" />

        <div v-if="mode === 'compare'" class="compare-hint">
          <div class="ring"><ion-icon :icon="radioButtonOnOutline" class="ic-28" /></div>
          <span class="hint-label">장면 위치 맞추기</span>
        </div>
      </div>

      <div class="top">
        <button class="r-btn" type="button" aria-label="close" @click="onClose">
          <ion-icon :icon="closeOutline" class="ic-22" />
        </button>
        <div v-if="targetPlace" class="spot-badge">
          <span class="dot"><ion-icon :icon="locationOutline" class="ic-16" /></span>
          <div>
            <div class="t">{{ targetPlace.placeName }}</div>
            <div class="s">{{ targetPlace.workTitle }}<span v-if="targetPlace.workEpisode"> · {{ targetPlace.workEpisode }}</span></div>
          </div>
        </div>
        <button class="r-btn" type="button" aria-label="flash" @click="onToggleFlash">
          <ion-icon :icon="flashOn ? flash : flashOutline" class="ic-22" />
        </button>
      </div>

      <div v-if="overlaySrc && mode !== 'plain'" class="guide-card">
        <div class="ico"><ion-icon :icon="sparklesOutline" class="ic-18" /></div>
        <div class="txt">
          <b>드라마 장면이 겹쳐있어요</b><br />
          <span class="muted">반투명 가이드에 맞춰서 찍어보세요</span>
        </div>
      </div>

      <div v-if="overlaySrc && mode !== 'plain'" class="opacity-slider">
        <span class="lbl">100</span>
        <div ref="trackEl" class="track" @pointerdown="onSliderPointerDown">
          <div class="thumb-dot" :style="{ top: `${100 - overlayOpacity}%` }" />
        </div>
        <span class="lbl">0</span>
      </div>

      <div class="modes">
        <span
          v-for="m in modeList"
          :key="m.key"
          :class="['mode', mode === m.key ? 'on' : '']"
          @click="onSetMode(m.key)"
        >{{ m.label }}</span>
      </div>

      <div class="controls">
        <div class="thumb">
          <img v-if="photos.length > 0" :src="photos[photos.length - 1]" alt="last capture" />
        </div>
        <button class="shutter" type="button" aria-label="shutter" @click="onShutter">
          <div class="inner" />
        </button>
        <button class="flip" type="button" aria-label="flip" @click="onFlip">
          <ion-icon :icon="syncOutline" class="ic-22" />
        </button>
      </div>

      <canvas ref="canvasEl" class="capture-canvas" />
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { IonPage, IonIcon } from '@ionic/vue';
import {
  closeOutline,
  flashOutline,
  flash,
  sparklesOutline,
  radioButtonOnOutline,
  syncOutline,
  locationOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUploadStore } from '@/stores/upload';
import { useToast } from '@/composables/useToast';

type Mode = 'compare' | 'overlay' | 'plain';

const router = useRouter();
const uploadStore = useUploadStore();
const { targetPlace, photos } = storeToRefs(uploadStore);
const { showError } = useToast();

const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const trackEl = ref<HTMLDivElement | null>(null);

const mode = ref<Mode>('overlay');
const overlayOpacity = ref(42);
const facingMode = ref<'user' | 'environment'>('environment');
const flashOn = ref(false);
const liveActive = ref(false);
let stream: MediaStream | null = null;

const modeList: Array<{ key: Mode; label: string }> = [
  { key: 'compare', label: '비교' },
  { key: 'overlay', label: '오버레이' },
  { key: 'plain', label: '일반' },
];

const overlaySrc = computed<string | null>(() => targetPlace.value?.sceneImageUrl ?? null);

const fallbackImage = computed<string>(() => {
  const t = targetPlace.value;
  if (!t) return '';
  return t.sceneImageUrl ?? '';
});

function stopStream(): void {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  liveActive.value = false;
}

async function startStream(): Promise<void> {
  stopStream();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    liveActive.value = false;
    await showError('실시간 카메라를 사용할 수 없어요');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode.value },
      audio: false,
    });
    const v = videoEl.value;
    if (v) {
      v.srcObject = stream;
      await v.play().catch(() => undefined);
    }
    liveActive.value = true;
  } catch {
    liveActive.value = false;
    await showError('실시간 카메라를 사용할 수 없어요');
  }
}

function onSetMode(m: Mode): void {
  mode.value = m;
  if (m === 'compare') overlayOpacity.value = 100;
  else if (m === 'overlay') overlayOpacity.value = 42;
  else overlayOpacity.value = 0;
}

function clampPercent(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function updateSliderFromEvent(e: PointerEvent): void {
  const track = trackEl.value;
  if (!track) return;
  const rect = track.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  overlayOpacity.value = clampPercent((1 - ratio) * 100);
}

function onSliderPointerDown(e: PointerEvent): void {
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  updateSliderFromEvent(e);
  const move = (ev: PointerEvent) => updateSliderFromEvent(ev);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function onToggleFlash(): void {
  flashOn.value = !flashOn.value;
}

async function onFlip(): Promise<void> {
  facingMode.value = facingMode.value === 'user' ? 'environment' : 'user';
  await startStream();
}

async function captureDataUrl(): Promise<string | null> {
  const canvas = canvasEl.value;
  if (!canvas) return null;
  if (liveActive.value && videoEl.value && videoEl.value.videoWidth > 0) {
    const v = videoEl.value;
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  }
  const src = fallbackImage.value;
  if (!src) return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    await img.decode();
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

async function onShutter(): Promise<void> {
  const dataUrl = await captureDataUrl();
  if (!dataUrl) {
    await showError('촬영에 실패했어요');
    return;
  }
  uploadStore.addPhoto(dataUrl);
  stopStream();
  await router.replace('/upload');
}

function onClose(): void {
  stopStream();
  router.back();
}

onMounted(async () => {
  if (!targetPlace.value) {
    await router.replace('/home');
    return;
  }
  await startStream();
});

onBeforeUnmount(() => {
  stopStream();
});
</script>

<style scoped>
.cam-root {
  position: absolute;
  inset: 0;
  background: #0a0a0a;
  color: #ffffff;
  overflow: hidden;
}

.cam {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.cam-view {
  position: absolute;
  inset: 0;
  background: #111;
}
.cam-video,
.cam-fallback {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}

.scene-overlay {
  position: absolute;
  inset: 0;
  mix-blend-mode: screen;
  pointer-events: none;
}
.scene-overlay img {
  width: 100%; height: 100%;
  object-fit: cover;
}

.grid-lines {
  position: absolute;
  inset: 80px 0 160px;
  pointer-events: none;
}
.grid-lines::before,
.grid-lines::after {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.25);
}
.grid-lines::before { top: 33.3%; }
.grid-lines::after { top: 66.6%; }
.grid-v {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.grid-v::before,
.grid-v::after {
  content: '';
  position: absolute;
  top: 80px; bottom: 160px;
  width: 1px;
  background: rgba(255, 255, 255, 0.25);
}
.grid-v::before { left: 33.3%; }
.grid-v::after { left: 66.6%; }

.top {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 10;
  padding: calc(18px + env(safe-area-inset-top)) 18px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
}
.r-btn {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  border: none;
  cursor: pointer;
}
.spot-badge {
  display: flex; align-items: center; gap: 8px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  padding: 6px 12px 6px 6px;
  border-radius: 999px;
}
.spot-badge .dot {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
}
.spot-badge .t { font-size: 12px; font-weight: 700; }
.spot-badge .s { font-size: 10px; opacity: 0.7; }

.guide-card {
  position: absolute;
  left: 16px; right: 16px;
  top: calc(100px + env(safe-area-inset-top));
  z-index: 9;
  background: rgba(20, 188, 237, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(20, 188, 237, 0.3);
  border-radius: 16px;
  padding: 12px 14px;
  display: flex; gap: 10px; align-items: center;
}
.guide-card .ico {
  width: 34px; height: 34px;
  border-radius: 10px;
  background: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
  color: #ffffff;
  flex-shrink: 0;
}
.guide-card .txt {
  font-size: 12px;
  line-height: 1.4;
}
.guide-card .txt b { font-size: 13px; }
.muted { opacity: 0.8; }

.modes {
  position: absolute;
  left: 0; right: 0;
  bottom: calc(188px + env(safe-area-inset-bottom));
  z-index: 10;
  display: flex;
  justify-content: center;
  gap: 14px;
}
.mode {
  font-size: 12px; font-weight: 700;
  padding: 6px 12px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  user-select: none;
}
.mode.on { background: var(--fr-primary); color: #ffffff; }

.compare-hint {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex; flex-direction: column; align-items: center;
  gap: 6px;
  pointer-events: none;
}
.compare-hint .ring {
  width: 64px; height: 64px;
  border: 2px dashed rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.hint-label {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.55);
  padding: 4px 10px;
  border-radius: 999px;
}

.controls {
  position: absolute;
  left: 0; right: 0;
  bottom: calc(34px + env(safe-area-inset-bottom));
  z-index: 10;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.thumb {
  width: 48px; height: 48px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #ffffff;
  background: rgba(255, 255, 255, 0.12);
}
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.shutter {
  width: 76px; height: 76px;
  border-radius: 50%;
  border: 4px solid #ffffff;
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.shutter .inner {
  width: 60px; height: 60px;
  border-radius: 50%;
  background: #ffffff;
}
.flip {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  border: none;
  cursor: pointer;
}

.opacity-slider {
  position: absolute;
  right: 14px;
  top: 260px;
  z-index: 10;
  height: 180px;
  width: 40px;
  display: flex; flex-direction: column;
  align-items: center;
  gap: 8px;
}
.opacity-slider .track {
  flex: 1;
  width: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.3);
  position: relative;
  cursor: pointer;
  touch-action: none;
}
.opacity-slider .thumb-dot {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.opacity-slider .lbl {
  font-size: 9px;
  opacity: 0.7;
  font-weight: 700;
}

.capture-canvas {
  display: none;
}
</style>
