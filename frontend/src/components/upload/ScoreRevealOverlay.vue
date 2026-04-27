<template>
  <div
    class="score-reveal"
    :class="{ 'is-bounced': bounced }"
    :aria-busy="loading ? 'true' : 'false'"
    aria-label="인증샷 채점 결과"
  >
    <!-- Loading state — shuffling 0–99 placeholder while the upload is in flight. -->
    <div v-if="loading" class="score-loading" data-testid="score-loading">
      <ion-spinner name="crescent" class="ring-spinner" />
      <div class="placeholder">{{ placeholderDigits }}</div>
      <div class="lbl">채점 중...</div>
    </div>

    <!-- Result state — RAF count-up + breakdown. -->
    <div v-else class="score-result">
      <div class="caption">획득 점수</div>
      <div
        class="total"
        data-testid="score-total"
        :aria-label="totalLabel"
      >{{ displayTotal }}</div>
      <div class="breakdown">
        <div class="bd-item">
          <span class="bd-k">유사도</span>
          <span class="bd-v" data-testid="score-similarity">{{ formatPart(similarityScore) }}</span>
        </div>
        <span class="bd-sep" aria-hidden="true">·</span>
        <div class="bd-item">
          <span class="bd-k">위치</span>
          <span class="bd-v" data-testid="score-gps">{{ formatPart(gpsScore) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Inline score reveal (task #8 reshape).
//
// Originally a fullscreen dialog overlay; per task #8 this now embeds
// directly into /upload's check-wrap region, so the dialog/backdrop/
// close-button shell is gone. The count-up math, shuffle placeholder,
// and bounce keyframe survive — they're the only behavior the parent
// cares about. The component emits `count-up-complete` once the
// animation lands so the parent can schedule the stage transition.

import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { IonSpinner } from '@ionic/vue';

interface Props {
  loading: boolean;
  totalScore?: number | null;
  similarityScore?: number | null;
  gpsScore?: number | null;
  /** Test escape hatch — skip RAF/interval, snap to final values. */
  disableAnimation?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  totalScore: null,
  similarityScore: null,
  gpsScore: null,
  disableAnimation: false,
});

const emit = defineEmits<{
  (e: 'count-up-complete'): void;
}>();

// ---------- Loading-state shuffle (0–99 every ~80ms) ----------
const placeholderDigits = ref('00');
let shuffleHandle: ReturnType<typeof setInterval> | null = null;

function startShuffle(): void {
  if (props.disableAnimation) {
    placeholderDigits.value = '00';
    return;
  }
  stopShuffle();
  shuffleHandle = setInterval(() => {
    const n = Math.floor(Math.random() * 100);
    placeholderDigits.value = n.toString().padStart(2, '0');
  }, 80);
}
function stopShuffle(): void {
  if (shuffleHandle !== null) {
    clearInterval(shuffleHandle);
    shuffleHandle = null;
  }
}

// ---------- Result-state count-up (0 → totalScore, ~1.3s ease-out) ----------
const COUNT_UP_MS = 1300;
const animatedTotal = ref<number | null>(null);
const bounced = ref(false);
let rafHandle: number | null = null;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function emitComplete(): void {
  bounced.value = true;
  emit('count-up-complete');
}

function startCountUp(target: number): void {
  cancelCountUp();
  if (props.disableAnimation) {
    animatedTotal.value = target;
    emitComplete();
    return;
  }
  animatedTotal.value = 0;
  bounced.value = false;
  const startedAt = performance.now();
  const tick = (now: number): void => {
    const elapsed = now - startedAt;
    const t = Math.min(1, elapsed / COUNT_UP_MS);
    const v = Math.round(target * easeOutCubic(t));
    animatedTotal.value = v;
    if (t < 1) {
      rafHandle = requestAnimationFrame(tick);
    } else {
      animatedTotal.value = target;
      rafHandle = null;
      emitComplete();
    }
  };
  rafHandle = requestAnimationFrame(tick);
}

function cancelCountUp(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
  }
}

// Drive both animations off the loading flag and totalScore prop. Runs
// immediately so the component does the right thing on first mount.
watch(
  () => props.loading,
  (isLoading) => {
    if (isLoading) {
      cancelCountUp();
      animatedTotal.value = null;
      bounced.value = false;
      startShuffle();
    } else {
      stopShuffle();
      if (typeof props.totalScore === 'number') {
        startCountUp(props.totalScore);
      } else {
        animatedTotal.value = null;
        bounced.value = false;
      }
    }
  },
  { immediate: true },
);

// If the score arrives a tick after loading flips (rare, but possible),
// pick it up too.
watch(
  () => props.totalScore,
  (v) => {
    if (props.loading) return;
    if (typeof v === 'number') {
      startCountUp(v);
    }
  },
);

onBeforeUnmount(() => {
  stopShuffle();
  cancelCountUp();
});

const displayTotal = computed<string>(() => {
  const v = animatedTotal.value;
  if (typeof v !== 'number') return '—';
  return String(v);
});

const totalLabel = computed<string>(() => {
  if (typeof props.totalScore === 'number') return `총점 ${props.totalScore}`;
  return '총점 미산정';
});

function formatPart(v: number | null | undefined): string {
  if (typeof v !== 'number') return '—';
  return String(v);
}
</script>

<style scoped>
.score-reveal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  transition: transform 220ms ease-out;
}
.score-reveal.is-bounced {
  animation: score-bounce 540ms ease-out;
}

@keyframes score-bounce {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.06); }
  60%  { transform: scale(0.985); }
  100% { transform: scale(1); }
}

/* ---------- Loading ---------- */
.score-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}
.ring-spinner {
  --color: var(--fr-primary);
  width: 36px;
  height: 36px;
}
.score-loading .placeholder {
  font-size: 56px;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--fr-ink);
  font-variant-numeric: tabular-nums;
  min-width: 96px;
  line-height: 1;
}
.score-loading .lbl {
  font-size: 13px;
  font-weight: 700;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
}

/* ---------- Result ---------- */
.score-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.score-result .caption {
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.score-result .total {
  font-size: 64px;
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 1;
  color: var(--fr-primary);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 0 transparent;
  transition: text-shadow 320ms ease-out;
}
.score-reveal.is-bounced .total {
  text-shadow: 0 8px 28px rgba(20, 188, 237, 0.45);
}

.breakdown {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.bd-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.bd-k {
  color: var(--fr-ink-3);
  font-weight: 600;
}
.bd-v {
  color: var(--fr-ink);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.bd-sep {
  color: var(--fr-ink-4);
}
</style>
