<template>
  <Transition name="lvup-fade" appear>
    <div
      v-if="open"
      class="lvup-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lvup-title"
      data-testid="levelup-overlay"
      @click.self="dismiss"
    >
      <div class="lvup-card" :class="{ 'is-bounced': bounced }">
        <div class="lvup-ring">
          <ion-icon :icon="trendingUpOutline" class="lvup-ic" />
        </div>
        <div class="lvup-pill">LV.{{ previousLevel }} → LV.{{ level }}</div>
        <h2 id="lvup-title" class="lvup-title">레벨 업!</h2>
        <p class="lvup-sub">
          이제 <span class="bold-k">'{{ levelName }}'</span> 입니다 ✨
        </p>
        <button type="button" class="lvup-cta" @click="dismiss">
          확인
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { trendingUpOutline } from 'ionicons/icons';

interface Props {
  open: boolean;
  level: number;
  previousLevel: number;
  levelName: string;
  /** 자동 닫힘 지연(ms). 0 이면 수동 닫기만. */
  autoDismissMs?: number;
}

const props = withDefaults(defineProps<Props>(), {
  autoDismissMs: 3800,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const bounced = ref(false);
let bounceTimer: ReturnType<typeof setTimeout> | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers(): void {
  if (bounceTimer !== null) {
    clearTimeout(bounceTimer);
    bounceTimer = null;
  }
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function dismiss(): void {
  clearTimers();
  emit('close');
}

watch(
  () => props.open,
  (isOpen) => {
    clearTimers();
    bounced.value = false;
    if (!isOpen) return;
    bounceTimer = setTimeout(() => {
      bounced.value = true;
    }, 60);
    if (props.autoDismissMs > 0) {
      dismissTimer = setTimeout(() => {
        dismiss();
      }, props.autoDismissMs);
    }
  },
  { immediate: true },
);

onBeforeUnmount(clearTimers);
</script>

<style scoped>
.lvup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.lvup-card {
  position: relative;
  width: 100%;
  max-width: 320px;
  background: #ffffff;
  border-radius: 24px;
  padding: 28px 22px 22px;
  text-align: center;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.25);
  transform: scale(0.6);
  opacity: 0;
  transition:
    transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 220ms ease-out;
}
.lvup-card.is-bounced {
  transform: scale(1);
  opacity: 1;
}

.lvup-ring {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  margin: 0 auto 14px;
  background: linear-gradient(135deg, #7c3aed 0%, #14bced 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 18px 40px rgba(124, 58, 237, 0.45);
  position: relative;
  animation: lvup-pulse 1400ms ease-in-out infinite;
}
.lvup-ring::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(124, 58, 237, 0.3);
}
.lvup-ic {
  width: 46px;
  height: 46px;
  font-size: 46px;
}

.lvup-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  background: #f3eefe;
  color: #7c3aed;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 8px;
}

.lvup-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin: 4px 0 6px;
  color: var(--fr-ink);
}

.lvup-sub {
  font-size: 14px;
  color: var(--fr-ink-3);
  line-height: 1.5;
  margin: 0 0 18px;
}
.bold-k {
  color: #7c3aed;
  font-weight: 800;
}

.lvup-cta {
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: var(--fr-ink);
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

@keyframes lvup-pulse {
  0%,
  100% {
    box-shadow: 0 18px 40px rgba(124, 58, 237, 0.45);
  }
  50% {
    box-shadow: 0 18px 56px rgba(124, 58, 237, 0.7);
  }
}

.lvup-fade-enter-active,
.lvup-fade-leave-active {
  transition: opacity 220ms ease-out;
}
.lvup-fade-enter-from,
.lvup-fade-leave-to {
  opacity: 0;
}
</style>
