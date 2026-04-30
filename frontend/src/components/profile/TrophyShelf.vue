<template>
  <section
    v-if="trophies.length > 0"
    class="trophy-shelf"
    data-testid="trophy-shelf"
  >
    <header class="ts-head">
      <h3>{{ headingLabel }}</h3>
      <span class="ts-count" data-testid="trophy-master-count">
        마스터 {{ masterCount }}
      </span>
    </header>
    <div class="ts-row no-scrollbar" data-testid="trophy-row">
      <div
        v-for="t in trophies"
        :key="t.contentId"
        :class="['ts-card', `tier-${t.tier.toLowerCase()}`]"
        data-testid="trophy-card"
        :data-tier="t.tier"
        @click="onOpenContent(t.contentId)"
      >
        <div class="ts-poster">
          <img v-if="t.contentPosterUrl" :src="t.contentPosterUrl" :alt="t.contentTitle" />
          <div v-else class="ts-poster-fallback">
            <ion-icon :icon="filmOutline" class="ic-22" />
          </div>
          <span :class="['ts-badge', `tier-${t.tier.toLowerCase()}`]">
            <ion-icon
              :icon="t.tier === 'MASTER' ? trophy : ribbonOutline"
              class="ic-16"
            />
            {{ tierLabel(t.tier) }}
          </span>
        </div>
        <div class="ts-info">
          <div class="ts-title">{{ t.contentTitle }}</div>
          <div class="ts-bar">
            <div class="ts-bar-fill" :style="{ width: `${t.percent}%` }" />
          </div>
          <div class="ts-progress">
            {{ t.collectedCount }} / {{ t.totalCount }} ({{ t.percent }}%)
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 빈 상태 — 본인 프로필에서만 노출(otherUser 면 surface 자체를 숨김). -->
  <section
    v-else-if="showEmpty"
    class="trophy-shelf empty"
    data-testid="trophy-shelf-empty"
  >
    <div class="ts-empty-card">
      <ion-icon :icon="trophyOutline" class="ic-28 ts-empty-ic" />
      <div class="ts-empty-text">
        <div class="t">아직 마스터한 작품이 없어요</div>
        <div class="s">한 작품의 모든 성지를 모으면 트로피를 받아요</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { filmOutline, ribbonOutline, trophy, trophyOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import type { ContentTrophy, ContentTrophyTier } from '@/stores/profile';

const props = defineProps<{
  trophies: ContentTrophy[];
  /** 본인 프로필이면 true — 빈 상태 surface 노출. 타 유저는 빈 배열일 때 surface 자체를 감춤. */
  showEmpty?: boolean;
}>();

const router = useRouter();

const masterCount = computed(
  () => props.trophies.filter((t) => t.tier === 'MASTER').length,
);

const headingLabel = computed(() => (masterCount.value > 0 ? '마스터 작품' : '진행 중인 작품'));

const showEmpty = computed(() => props.showEmpty === true);

function tierLabel(tier: ContentTrophyTier): string {
  switch (tier) {
    case 'MASTER': return '마스터';
    case 'THREE_Q': return '75%';
    case 'HALF': return '50%';
    case 'QUARTER': return '25%';
  }
}

async function onOpenContent(id: number): Promise<void> {
  await router.push(`/content/${id}`);
}
</script>

<style scoped>
.trophy-shelf {
  padding: 8px 0 4px;
}
.ts-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 20px 10px;
}
.ts-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.ts-count {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--fr-ink-3);
}

.ts-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 0 20px 4px;
}
.ts-card {
  flex: 0 0 132px;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: var(--fr-bg-muted);
  cursor: pointer;
  transition: transform 0.15s;
}
.ts-card:active { transform: scale(0.97); }

.ts-poster {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #1e293b;
}
.ts-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.ts-poster-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}

.ts-badge {
  position: absolute;
  left: 6px;
  top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 999px;
  letter-spacing: -0.01em;
  color: #ffffff;
  backdrop-filter: blur(6px);
}
.ts-badge.tier-master {
  /* MASTER 만 황금톤 그라디언트 — 시각 위계로 가장 강조. */
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}
.ts-badge.tier-three_q {
  background: linear-gradient(135deg, #14BCED, #6366f1);
}
.ts-badge.tier-half {
  background: rgba(20, 188, 237, 0.85);
}
.ts-badge.tier-quarter {
  background: rgba(15, 23, 42, 0.7);
}

.ts-info {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ts-title {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ts-bar {
  height: 4px;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  overflow: hidden;
}
.ts-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #14BCED, #f59e0b);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.ts-progress {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
}

/* 본인 프로필 빈 상태 */
.trophy-shelf.empty {
  padding: 4px 20px 8px;
}
.ts-empty-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--fr-bg-muted);
  border-radius: 14px;
}
.ts-empty-ic {
  color: var(--fr-ink-4);
  flex-shrink: 0;
}
.ts-empty-text .t {
  font-size: 13px;
  font-weight: 800;
  color: var(--fr-ink);
  letter-spacing: -0.02em;
}
.ts-empty-text .s {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.ic-28 {
  font-size: 28px;
  width: 28px;
  height: 28px;
}
</style>
