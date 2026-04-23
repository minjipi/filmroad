<template>
  <ion-page>
    <ion-content :fullscreen="true" class="pf-content">
      <header class="top-bar">
        <h1>{{ handleLabel }}</h1>
        <div class="r">
          <button type="button" aria-label="share" @click="onShare">
            <ion-icon :icon="shareSocialOutline" class="ic-20" />
          </button>
          <button type="button" aria-label="menu" @click="onMenu">
            <ion-icon :icon="menuOutline" class="ic-20" />
          </button>
        </div>
      </header>

      <div class="pf-scroll no-scrollbar">
        <section v-if="user" class="profile-card">
          <div class="avatar"><img :src="user.avatarUrl" :alt="user.nickname" /></div>
          <div class="me-info">
            <div class="n">
              {{ user.nickname }}
              <ion-icon :icon="checkmarkCircle" class="ic-18 verify" />
            </div>
            <div class="handle">{{ user.bio }}</div>
            <span class="level-pill">
              <ion-icon :icon="star" class="ic-16" />LV.{{ user.level }} · {{ user.levelName }}
            </span>
          </div>
        </section>

        <section v-if="stats" class="stats">
          <div class="stat"><div class="n">{{ formatCount(stats.visitedCount) }}</div><div class="l">방문 성지</div></div>
          <div class="stat"><div class="n">{{ formatCount(stats.photoCount) }}</div><div class="l">인증샷</div></div>
          <div class="stat"><div class="n">{{ formatCount(stats.followersCount) }}</div><div class="l">팔로워</div></div>
          <div class="stat"><div class="n">{{ formatCount(stats.followingCount) }}</div><div class="l">팔로잉</div></div>
        </section>

        <section class="cta">
          <button class="btn primary" type="button" @click="onEdit">
            <ion-icon :icon="createOutline" class="ic-16" />프로필 편집
          </button>
          <button class="btn" type="button" @click="onShare">
            <ion-icon :icon="shareSocialOutline" class="ic-16" />공유
          </button>
        </section>

        <section class="mini-map">
          <div
            v-for="(p, i) in miniMapPins"
            :key="i"
            :class="['mini-pin', p.variant]"
            :style="pinStyle(p)"
          />
          <div class="map-overlay">
            <span class="l">
              <ion-icon :icon="locationOutline" class="ic-16" />전국 {{ stats?.visitedCount ?? 0 }}곳 방문
            </span>
            <span class="r" @click="onOpenMap">지도로 보기<ion-icon :icon="chevronForwardOutline" class="ic-16" /></span>
          </div>
        </section>

        <nav class="local-tabs">
          <div
            v-for="t in localTabs"
            :key="t.key"
            :class="['tab-i', localTab === t.key ? 'on' : '']"
            @click="onSelectLocalTab(t.key)"
          >
            <ion-icon :icon="t.icon" class="ic-18" />{{ t.label }}
          </div>
        </nav>

        <!-- 인증샷 (기존) -->
        <div v-if="localTab === 'photos'" class="grid3" data-testid="tab-photos">
          <div
            v-for="(cell, idx) in gridCells"
            :key="cell.key"
            class="c"
            data-testid="shot-cell"
            @click="onOpenShot(idx + 1)"
          >
            <img v-if="cell.imageUrl" :src="cell.imageUrl" :alt="cell.tag ?? ''" />
            <span v-if="cell.tag" class="tag">{{ cell.tag }}</span>
          </div>
        </div>

        <!-- 수집 중인 작품 목록 -->
        <section
          v-else-if="localTab === 'stampbook'"
          class="stampbook-summary"
          data-testid="tab-stampbook"
        >
          <div class="sb-section-title">
            <h3>수집 중인 작품</h3>
          </div>

          <div class="drama-list" data-testid="stampbook-works-list">
            <div
              v-for="w in stampbookWorks"
              :key="w.workId"
              class="drama-card"
              data-testid="stampbook-work-card"
              @click="onOpenStampbook"
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
            <p v-if="stampbookWorks.length === 0" class="empty-note">
              수집 중인 작품이 없어요
            </p>
          </div>
        </section>

        <!-- 저장 탭은 task #20 에서 다시 `/saved` 페이지로 라우팅되도록 환원.
             onSelectLocalTab 이 즉시 push 하므로 이 탭의 본문은 렌더되지 않는다. -->
      </div>

    </ion-content>
    <FrTabBar :model-value="'me'" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonPage, IonContent, IonIcon, actionSheetController } from '@ionic/vue';
import {
  shareSocialOutline,
  menuOutline,
  checkmarkCircle,
  star,
  createOutline,
  locationOutline,
  chevronForwardOutline,
  gridOutline,
  ribbonOutline,
  bookmarkOutline,
  logOutOutline,
  trophyOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useProfileStore, type MiniMapPin } from '@/stores/profile';
import { useStampbookStore } from '@/stores/stampbook';
import { useAuthStore } from '@/stores/auth';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';

type LocalTab = 'photos' | 'stampbook' | 'saved';

const router = useRouter();
const profileStore = useProfileStore();
const stampbookStore = useStampbookStore();
const authStore = useAuthStore();
const { user, stats, miniMapPins, error } = storeToRefs(profileStore);
const { works: stampbookWorks } = storeToRefs(stampbookStore);
const { showError, showInfo } = useToast();

// photos / stampbook 는 in-place 렌더, '저장' 탭은 task #20 에서 다시
// `/saved` 페이지로 라우팅하도록 환원.
const localTab = ref<LocalTab>('photos');

const localTabs: Array<{ key: LocalTab; label: string; icon: string }> = [
  { key: 'photos', label: '인증샷', icon: gridOutline },
  { key: 'stampbook', label: '스탬프북', icon: ribbonOutline },
  { key: 'saved', label: '저장', icon: bookmarkOutline },
];

const handleLabel = computed(() => {
  const h = user.value?.handle ?? '';
  return h.startsWith('@') ? h : `@${h}`;
});

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const MAP_PAD_DEG = 0.5;
const bounds = computed(() => {
  const ms = miniMapPins.value;
  if (ms.length === 0) {
    return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  }
  const lats = ms.map((m) => m.latitude);
  const lngs = ms.map((m) => m.longitude);
  return {
    minLat: Math.min(...lats) - MAP_PAD_DEG,
    maxLat: Math.max(...lats) + MAP_PAD_DEG,
    minLng: Math.min(...lngs) - MAP_PAD_DEG,
    maxLng: Math.max(...lngs) + MAP_PAD_DEG,
  };
});

function pinStyle(p: MiniMapPin): Record<string, string> {
  const b = bounds.value;
  const x = (p.longitude - b.minLng) / Math.max(b.maxLng - b.minLng, 0.0001);
  const y = 1 - (p.latitude - b.minLat) / Math.max(b.maxLat - b.minLat, 0.0001);
  return {
    left: `${(x * 100).toFixed(2)}%`,
    top: `${(y * 100).toFixed(2)}%`,
  };
}

interface GridCell {
  key: string;
  imageUrl: string | null;
  tag: string | null;
}

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1520626337972-005d3cdb8978?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1546874177-9e664107314e?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1617152664536-11f42e3f5383?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1555042827-6d274530c333?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1582200236025-a134371fa7db?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=300&q=80',
];

const gridCells = computed<GridCell[]>(() => {
  const cellCount = Math.max(miniMapPins.value.length, 9);
  const cells: GridCell[] = [];
  for (let i = 0; i < cellCount; i += 1) {
    cells.push({
      key: `c-${i}`,
      imageUrl: PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length],
      tag: null,
    });
  }
  return cells;
});

async function onSelectLocalTab(t: LocalTab): Promise<void> {
  if (t === 'saved') {
    // 저장 탭은 전용 페이지(/saved)에서 컬렉션 · AI 루트 배너까지 함께
    // 보여주는 구조라 in-place 렌더 대신 라우팅한다 (task #20).
    await router.push('/saved');
    return;
  }
  localTab.value = t;
  if (t === 'stampbook' && stampbookWorks.value.length === 0) {
    await stampbookStore.fetch();
  }
}

async function onOpenStampbook(): Promise<void> {
  await router.push('/stampbook');
}

async function onOpenMap(): Promise<void> {
  await router.push('/map');
}

async function onOpenShot(id: number): Promise<void> {
  await router.push(`/shot/${id}`);
}

async function onEdit(): Promise<void> {
  await showInfo('프로필 편집은 곧 공개됩니다');
}

async function onShare(): Promise<void> {
  await showInfo('공유 기능은 곧 공개됩니다');
}

async function onMenu(): Promise<void> {
  const sheet = await actionSheetController.create({
    header: '계정',
    buttons: [
      {
        text: '로그아웃',
        role: 'destructive',
        icon: logOutOutline,
        handler: () => {
          void handleLogout();
        },
      },
      { text: '취소', role: 'cancel' },
    ],
  });
  await sheet.present();
}

async function handleLogout(): Promise<void> {
  await authStore.logout();
  await showInfo('로그아웃되었습니다');
  await router.replace('/onboarding');
}

onMounted(async () => {
  await profileStore.fetch();
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content.pf-content {
  --background: #ffffff;
}

.pf-scroll {
  overflow-y: auto;
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
}

.top-bar {
  padding: calc(8px + env(safe-area-inset-top)) 16px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
}
.top-bar h1 {
  margin: 0;
  font-size: 18px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.top-bar .r { display: flex; gap: 4px; }
.top-bar .r button {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: transparent;
  color: var(--fr-ink-2);
  border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

.profile-card {
  padding: 8px 20px 20px;
  display: flex;
  gap: 16px;
  align-items: center;
}
.avatar {
  width: 72px; height: 72px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  box-shadow: 0 0 0 2px var(--fr-primary);
  background: #fce7f3;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.me-info { flex: 1; }
.me-info .n {
  font-size: 18px; font-weight: 800;
  letter-spacing: -0.02em;
  display: flex; align-items: center;
  gap: 5px;
  color: var(--fr-ink);
}
.me-info .verify { color: var(--fr-primary); }
.me-info .handle {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.level-pill {
  margin-top: 6px;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
  color: #ffffff;
  border-radius: 999px;
  font-size: 11px; font-weight: 800;
}

.stats {
  display: flex;
  padding: 4px 20px 0;
  gap: 10px;
}
.stat {
  flex: 1;
  text-align: center;
  padding: 10px 0;
}
.stat .n { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; color: var(--fr-ink); }
.stat .l { font-size: 11.5px; color: var(--fr-ink-3); margin-top: 2px; }
.stat + .stat { border-left: 1px solid var(--fr-line); }

.cta {
  padding: 16px 20px 4px;
  display: flex;
  gap: 8px;
}
.cta .btn {
  flex: 1;
  height: 40px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink);
  font-size: 13px; font-weight: 700;
  border: none;
  display: flex; align-items: center; justify-content: center;
  gap: 6px;
  cursor: pointer;
}
.cta .btn.primary { background: var(--fr-primary); color: #ffffff; }

.mini-map {
  margin: 18px 20px 0;
  height: 160px;
  border-radius: 18px;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at 20% 40%, #e6eef7 0%, transparent 50%),
    radial-gradient(circle at 70% 60%, #dde9f2 0%, transparent 60%),
    linear-gradient(180deg, #eef3f8, #e3ecf4);
  border: 1px solid var(--fr-line);
}
.mini-map::before {
  content: '';
  position: absolute; inset: 0;
  background-image:
    linear-gradient(to right, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 30px 30px;
}
.mini-pin {
  position: absolute;
  width: 16px; height: 16px;
  border-radius: 50% 50% 50% 0;
  transform: translate(-50%, -100%) rotate(-45deg);
}
.mini-pin.PRIMARY { background: var(--fr-primary); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); }
.mini-pin.VIOLET { background: var(--fr-violet); }
.mini-pin.MINT { background: var(--fr-mint); }

.map-overlay {
  position: absolute;
  left: 14px; right: 14px; bottom: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.map-overlay .l {
  background: rgba(15, 23, 42, 0.85);
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px; font-weight: 700;
  backdrop-filter: blur(6px);
  display: flex; align-items: center; gap: 4px;
}
.map-overlay .r {
  background: #ffffff;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px; font-weight: 700;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  display: flex; align-items: center; gap: 4px;
  cursor: pointer;
  color: var(--fr-ink);
}

.local-tabs {
  padding: 20px 20px 12px;
  display: flex;
  justify-content: space-around;
  border-bottom: 1px solid var(--fr-line);
}
.tab-i {
  color: var(--fr-ink-4);
  padding: 8px 0;
  font-weight: 700;
  font-size: 13px;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.tab-i.on { color: var(--fr-ink); }
.tab-i.on::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -13px;
  width: 32px; height: 3px;
  background: var(--fr-ink);
  border-radius: 2px;
}

.grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  padding: 2px 0 0;
}
.grid3 .c {
  aspect-ratio: 1;
  background: #eef2f6;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.grid3 .c img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.grid3 .c .tag {
  position: absolute;
  bottom: 6px; left: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 9px; font-weight: 700;
  backdrop-filter: blur(4px);
}

/* ---------- 스탬프북 요약 ---------- */
.stampbook-summary {
  padding: 16px;
}

.sb-section-title {
  display: flex;
  justify-content: space-between;
  padding: 4px 4px 12px;
}
.sb-section-title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}

.drama-list {
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
.drama-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
.drama-mid { flex: 1; min-width: 0; }
.drama-mid .t {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.drama-mid .s {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin: 2px 0 8px;
}
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

</style>
