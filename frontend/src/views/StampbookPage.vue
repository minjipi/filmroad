<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sb-content">
      <header class="top">
        <button type="button" aria-label="back" @click="onBack">
          <ion-icon :icon="chevronBack" class="ic-22" />
        </button>
        <h1>스탬프북</h1>
        <button type="button" aria-label="share" @click="onShare">
          <ion-icon :icon="shareSocialOutline" class="ic-20" />
        </button>
      </header>

      <div class="sb-scroll no-scrollbar">
        <section v-if="hero" class="hero">
          <div class="label">COLLECTION</div>
          <h2>{{ hero.contentsCollectingCount }}개 작품 · {{ hero.placesCollectedCount }} 성지<br />수집 중</h2>
          <div class="meter">
            <div class="d">
              <ion-icon :icon="ribbonOutline" class="ic-16 m-primary" />
              <b>{{ hero.placesCollectedCount }}</b><span class="muted">성지</span>
            </div>
            <div class="d">
              <ion-icon :icon="medalOutline" class="ic-16 m-amber" />
              <b>{{ hero.badgesCount }}</b><span class="muted">뱃지</span>
            </div>
            <div class="d">
              <ion-icon :icon="filmOutline" class="ic-16 m-violet" />
              <b>{{ hero.completedContentsCount }}</b><span class="muted">완주</span>
            </div>
          </div>
        </section>

        <nav class="filter-tabs no-scrollbar">
          <div
            v-for="f in filters"
            :key="f.key"
            :class="['ft', filter === f.key ? 'on' : '']"
            @click="onSetFilter(f.key)"
          >{{ f.label }}</div>
        </nav>

        <div v-if="showWorksSection" class="section-title">
          <h3>{{ filter === 'COMPLETED' ? '완주한 작품' : '수집 중인 작품' }}</h3>
          <span class="see">정렬</span>
        </div>

        <div v-if="showWorksSection" class="drama-list">
          <div
            v-for="w in visibleWorks"
            :key="w.contentId"
            class="drama-card"
            @click="onOpenWork(w.contentId)"
          >
            <div v-if="w.completed" class="completed-badge">
              <ion-icon :icon="trophyOutline" class="ic-16" />완주
            </div>
            <div class="drama-poster">
              <img :src="w.posterUrl" :alt="w.title" />
            </div>
            <div class="drama-mid">
              <div class="t">{{ w.title }}</div>
              <div class="s"><template v-if="w.year">{{ w.year }}</template></div>
              <div class="bar">
                <div class="f" :style="{ width: `${w.percent}%`, background: w.gradient }" />
              </div>
              <div class="meta">
                <span>{{ w.collectedCount }} / {{ w.totalCount }} 성지</span>
                <span>{{ w.percent }}%</span>
              </div>
            </div>
          </div>
          <p v-if="visibleWorks.length === 0" class="empty-note">표시할 작품이 없습니다</p>
        </div>

        <div v-if="showBadgesSection" class="section-title" :class="{ 'gap-top': showWorksSection }">
          <h3>최근 획득 뱃지</h3>
          <span class="see">전체 보기</span>
        </div>

        <div v-if="showBadgesSection" class="badges">
          <div
            v-for="b in recentBadges"
            :key="b.badgeId"
            :class="['badge', b.acquired ? '' : 'locked']"
          >
            <div class="circle" :style="b.acquired && b.gradient ? { background: b.gradient } : undefined">
              <ion-icon :icon="b.acquired ? badgeIcon(b.iconKey) : lockClosedOutline" :class="b.acquired ? 'ic-28' : 'ic-24'" />
            </div>
            <div class="t">{{ b.name }}</div>
            <div class="s">{{ b.acquired ? (b.description ?? '') : (b.progressText ?? '') }}</div>
          </div>
        </div>
      </div>

    </ion-content>
    <FrTabBar :model-value="'me'" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBack,
  shareSocialOutline,
  ribbonOutline,
  medalOutline,
  filmOutline,
  trophyOutline,
  lockClosedOutline,
  flameOutline,
  sunnyOutline,
  waterOutline,
  trailSignOutline,
  earthOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useStampbookStore, type StampbookFilter } from '@/stores/stampbook';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const stampbookStore = useStampbookStore();
const { hero, recentBadges, filter, error } = storeToRefs(stampbookStore);
const { showError, showInfo } = useToast();

const visibleWorks = computed(() => stampbookStore.visibleWorks);

const filters: Array<{ key: StampbookFilter; label: string }> = [
  { key: 'WORKS', label: '작품' },
  { key: 'BADGES', label: '뱃지' },
  { key: 'COMPLETED', label: '완주한 것' },
  { key: 'IN_PROGRESS', label: '진행 중' },
];

const showWorksSection = computed(() => filter.value !== 'BADGES');
const showBadgesSection = computed(() => filter.value === 'WORKS' || filter.value === 'BADGES');

function onSetFilter(f: StampbookFilter): void {
  stampbookStore.setFilter(f);
}

function onBack(): void {
  router.back();
}

async function onOpenWork(id: number): Promise<void> {
  await router.push(`/content/${id}`);
}

async function onShare(): Promise<void> {
  await showInfo('스탬프북 공유는 곧 공개됩니다');
}

function badgeIcon(key: string): string {
  switch (key) {
    case 'waves': return waterOutline;
    case 'flame': return flameOutline;
    case 'sunrise': return sunnyOutline;
    case 'trail': return trailSignOutline;
    case 'globe': return earthOutline;
    default: return sparklesOutline;
  }
}

onMounted(async () => {
  await stampbookStore.fetch();
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content.sb-content {
  --background: #ffffff;
}
.sb-scroll {
  overflow-y: auto;
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

.top {
  padding: calc(8px + env(safe-area-inset-top)) 16px 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #ffffff;
}
.top h1 {
  margin: 0;
  font-size: 17px; font-weight: 800;
  letter-spacing: -0.02em;
  flex: 1;
  color: var(--fr-ink);
}
.top button {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--fr-ink-2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

.hero {
  margin: 4px 16px 0;
  padding: 20px;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
  border-radius: 22px;
  color: #ffffff;
  position: relative;
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute;
  right: -40px; top: -40px;
  width: 140px; height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(20, 188, 237, 0.4), transparent 60%);
}
.hero .label {
  font-size: 11px;
  opacity: 0.7;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}
.hero h2 {
  font-size: 24px; font-weight: 800;
  letter-spacing: -0.03em;
  margin: 4px 0 10px;
  position: relative;
}
.hero .meter {
  display: flex;
  gap: 12px;
  font-size: 12px;
  position: relative;
}
.hero .meter .d {
  display: flex;
  align-items: center;
  gap: 4px;
}
.hero .meter .d b { font-size: 14px; font-weight: 800; }
.muted { opacity: 0.8; }
.m-primary { color: #14BCED; }
.m-amber { color: #f5a524; }
.m-violet { color: #7c3aed; }

.filter-tabs {
  display: flex;
  gap: 8px;
  padding: 18px 16px 12px;
  overflow-x: auto;
}
.ft {
  white-space: nowrap;
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  cursor: pointer;
  user-select: none;
}
.ft.on { background: var(--fr-ink); color: #ffffff; }

.section-title {
  display: flex;
  justify-content: space-between;
  padding: 8px 20px 12px;
}
.section-title.gap-top { padding-top: 24px; }
.section-title h3 {
  margin: 0;
  font-size: 15px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.section-title .see {
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-primary);
  cursor: pointer;
}

.drama-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.drama-card {
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 18px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.drama-poster {
  width: 56px; height: 76px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: #eef2f6;
}
.drama-poster img { width: 100%; height: 100%; object-fit: cover; }
.drama-mid { flex: 1; }
.drama-mid .t { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; color: var(--fr-ink); }
.drama-mid .s { font-size: 11.5px; color: var(--fr-ink-3); margin: 2px 0 8px; }
.drama-mid .meta {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--fr-ink-3);
  font-weight: 700;
}
.bar {
  height: 6px;
  background: var(--fr-bg-muted);
  border-radius: 999px;
  overflow: hidden;
}
.bar .f { height: 100%; border-radius: 999px; }
.completed-badge {
  position: absolute;
  top: 8px; right: 8px;
  background: #fff7e6;
  color: #d97706;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 3px;
}
.empty-note {
  padding: 24px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}

.badges {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 4px 16px;
}
.badge {
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 16px;
  padding: 14px 8px;
  text-align: center;
  position: relative;
}
.badge .circle {
  width: 60px; height: 60px;
  border-radius: 50%;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  position: relative;
}
.badge .circle::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px dashed rgba(15, 23, 42, 0.08);
}
.badge.locked .circle { background: #e2e8f0; color: #94a3b8; }
.badge.locked::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(248, 250, 252, 0.4);
  border-radius: 16px;
  pointer-events: none;
}
.badge .t {
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.badge .s {
  font-size: 10px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
</style>
