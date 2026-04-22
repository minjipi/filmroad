<template>
  <ion-page>
    <ion-content :fullscreen="true" class="rw-content">
      <div class="bg">
        <div
          v-for="c in confettiDots"
          :key="c.key"
          class="confetti"
          :style="c.style"
        />
      </div>

      <div v-if="result" class="page-content no-scrollbar">
        <div class="check-wrap">
          <div class="check-ring">
            <ion-icon :icon="checkmark" class="check-ic" />
          </div>
        </div>

        <h1 class="title">인증 완료!</h1>
        <p class="sub">
          <span class="bold-k">'{{ placeName }}'</span> 성지를<br />성공적으로 수집하셨어요
        </p>

        <section v-if="stamp" class="stamp-card">
          <div class="stamp-top">
            <div class="stamp-badge">
              <ion-icon :icon="filmOutline" class="ic-22" />
              <span class="num">{{ stamp.collectedCount }}</span>
            </div>
            <div class="stamp-info">
              <div class="t">{{ stamp.workTitle }} 스탬프북</div>
              <div class="s">{{ stamp.collectedCount }} / {{ stamp.totalCount }} 성지 수집</div>
            </div>
          </div>
          <div class="progress">
            <span class="p-t">컬렉션 진행률</span>
            <span class="p-v">{{ stamp.percent }}%</span>
          </div>
          <div class="bar"><div class="fill" :style="{ width: `${stamp.percent}%` }" /></div>
          <div v-if="nextMilestone" class="next-milestone">
            다음 <b>{{ nextMilestone }}곳</b> 모으면 <b>{{ stamp.workTitle }} 완주</b>!
          </div>
        </section>

        <section v-if="reward" class="rewards">
          <div class="reward">
            <div class="ico ico-amber"><ion-icon :icon="star" class="ic-20" /></div>
            <div class="n">+{{ reward.pointsEarned }}</div>
            <div class="l">성지 포인트</div>
          </div>
          <div class="reward">
            <div class="ico ico-primary"><ion-icon :icon="flameOutline" class="ic-20" /></div>
            <div class="n">{{ reward.streakDays }}일</div>
            <div class="l">연속 인증</div>
          </div>
          <div class="reward">
            <div class="ico ico-mint"><ion-icon :icon="trendingUpOutline" class="ic-20" /></div>
            <div class="n">LV.{{ reward.level }}</div>
            <div class="l">{{ reward.levelName }}</div>
          </div>
        </section>

        <section v-if="reward && reward.newBadges.length > 0" class="new-badges">
          <h3>새 뱃지!</h3>
          <div class="nb-list">
            <div v-for="b in reward.newBadges" :key="b.badgeId" class="nb-card">
              <div class="nb-circle" :style="b.gradient ? { background: b.gradient } : undefined">
                <ion-icon :icon="sparklesOutline" class="ic-24" />
              </div>
              <div class="nb-t">{{ b.name }}</div>
              <div v-if="b.description" class="nb-s">{{ b.description }}</div>
            </div>
          </div>
        </section>

        <div class="actions">
          <button class="fr-btn primary" type="button" @click="onBoast">
            <ion-icon :icon="shareSocialOutline" class="ic-20" />친구에게 자랑하기
          </button>
          <button class="link" type="button" @click="onGoHome">홈으로 돌아가기</button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  checkmark,
  filmOutline,
  star,
  flameOutline,
  trendingUpOutline,
  shareSocialOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUploadStore } from '@/stores/upload';
import { useToast } from '@/composables/useToast';

defineProps<{ placeId: string | number }>();

const router = useRouter();
const uploadStore = useUploadStore();
const { lastResult, targetPlace } = storeToRefs(uploadStore);
const { showInfo } = useToast();

const result = computed(() => lastResult.value);
const stamp = computed(() => lastResult.value?.stamp ?? null);
const reward = computed(() => lastResult.value?.reward ?? null);
const placeName = computed(() =>
  stamp.value?.placeName ?? targetPlace.value?.placeName ?? '성지',
);

const nextMilestone = computed(() => {
  const s = stamp.value;
  if (!s) return 0;
  return Math.max(0, s.totalCount - s.collectedCount);
});

interface Confetti {
  key: string;
  style: Record<string, string>;
}

const CONFETTI_COLORS = ['#14BCED', '#7c3aed', '#f5a524', '#10b981', '#14BCED', '#ff5a5f'];
const CONFETTI_POSITIONS: Array<{ left: string; top: string; rotate: number }> = [
  { left: '10%', top: '12%', rotate: 0 },
  { left: '85%', top: '18%', rotate: 20 },
  { left: '20%', top: '28%', rotate: 0 },
  { left: '78%', top: '40%', rotate: -20 },
  { left: '12%', top: '55%', rotate: 0 },
  { left: '88%', top: '60%', rotate: 0 },
];

const confettiDots = computed<Confetti[]>(() =>
  CONFETTI_POSITIONS.map((p, i) => ({
    key: `c-${i}`,
    style: {
      background: CONFETTI_COLORS[i],
      left: p.left,
      top: p.top,
      transform: `rotate(${p.rotate}deg)`,
    },
  })),
);

async function onBoast(): Promise<void> {
  await showInfo('공유는 곧 공개됩니다');
}

async function onGoHome(): Promise<void> {
  uploadStore.reset();
  await router.replace('/home');
}

onMounted(async () => {
  if (!lastResult.value) {
    await router.replace('/home');
  }
});

onBeforeUnmount(() => {
  // Reward screen unmount without explicit home nav still clears capture state.
  if (lastResult.value) uploadStore.reset();
});
</script>

<style scoped>
ion-content.rw-content {
  --background: #fafbfd;
}

.bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 10%, rgba(20, 188, 237, 0.15), transparent 40%),
    radial-gradient(circle at 85% 80%, rgba(124, 58, 237, 0.1), transparent 40%),
    #fafbfd;
}
.confetti {
  position: absolute;
  width: 8px; height: 8px;
  border-radius: 2px;
}

.page-content {
  position: relative;
  z-index: 1;
  padding: calc(60px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-height: 100%;
  overflow-y: auto;
}

.check-wrap {
  position: relative;
  width: 120px; height: 120px;
  margin: 30px 0 20px;
}
.check-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--fr-primary);
  box-shadow: 0 20px 50px rgba(20, 188, 237, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}
.check-ring::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(20, 188, 237, 0.3);
}
.check-ic {
  width: 56px;
  height: 56px;
  font-size: 56px;
}

.title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin: 8px 0;
  color: var(--fr-ink);
}
.sub {
  font-size: 14px;
  color: var(--fr-ink-3);
  line-height: 1.5;
  margin: 0;
}
.bold-k {
  color: var(--fr-primary);
  font-weight: 800;
}

.stamp-card {
  margin-top: 26px;
  width: 100%;
  background: #ffffff;
  border-radius: 22px;
  padding: 20px 18px;
  border: 1px solid var(--fr-line);
  position: relative;
}
.stamp-card::before,
.stamp-card::after {
  content: '';
  position: absolute;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fafbfd;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid var(--fr-line);
}
.stamp-card::before { left: -8px; }
.stamp-card::after { right: -8px; }

.stamp-top {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--fr-line);
}
.stamp-badge {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  position: relative;
  flex-shrink: 0;
}
.stamp-badge .num {
  position: absolute;
  right: -4px; top: -4px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--fr-coral);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
}
.stamp-info { flex: 1; }
.stamp-info .t {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.stamp-info .s {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

.progress {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}
.progress .p-t {
  font-weight: 700;
  color: var(--fr-ink);
}
.progress .p-v {
  color: var(--fr-ink-3);
}
.bar {
  height: 8px;
  background: var(--fr-bg-muted);
  border-radius: 999px;
  overflow: hidden;
}
.bar .fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #14BCED, #7c3aed);
}
.next-milestone {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 10px;
  text-align: left;
}
.next-milestone b {
  color: var(--fr-primary);
  font-weight: 700;
}

.rewards {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 20px;
}
.reward {
  flex: 1;
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 16px;
  padding: 14px 10px;
  text-align: center;
}
.reward .ico {
  width: 36px; height: 36px;
  border-radius: 10px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ico-amber { background: #fff7e6; color: #f5a524; }
.ico-primary { background: #e6f8fd; color: var(--fr-primary); }
.ico-mint { background: #ecfdf5; color: var(--fr-mint); }
.reward .n {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.reward .l {
  font-size: 10.5px;
  color: var(--fr-ink-3);
  margin-top: 1px;
}

.new-badges {
  width: 100%;
  margin-top: 18px;
  text-align: left;
}
.new-badges h3 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 800;
  color: var(--fr-ink);
}
.nb-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
}
.nb-card {
  flex-shrink: 0;
  width: 120px;
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 14px;
  padding: 10px;
  text-align: center;
}
.nb-circle {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
  color: #ffffff;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nb-t {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--fr-ink);
}
.nb-s {
  font-size: 10px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

.actions {
  margin-top: auto;
  padding-top: 28px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fr-btn {
  height: 52px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  cursor: pointer;
  width: 100%;
}
.fr-btn.primary {
  background: var(--fr-primary);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.35);
}
.link {
  color: var(--fr-ink-3);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  padding: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
}
</style>
