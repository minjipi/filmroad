<template>
  <ion-page>
    <ion-content :fullscreen="true" class="feed-content">
      <header class="feed-head">
        <h1>탐색</h1>
      </header>

      <div class="search-row" @click="onSearch">
        <div class="search-bar">
          <ion-icon :icon="searchOutline" class="ic-16" />
          <span>작품, 장소, 사용자 검색</span>
        </div>
      </div>

      <nav class="feed-tabs">
        <div
          v-for="t in tabs"
          :key="t.key"
          :class="['t', tab === t.key ? 'on' : '']"
          @click="onSelectTab(t.key)"
        >
          {{ t.label }}
        </div>
      </nav>

      <div class="feed-scroll no-scrollbar">
        <!-- Work-title chip row — filters the grid client-side. "전체"
             resets to the full list. Mirrors 13-feed.html's .chip-row. -->
        <div class="chip-row no-scrollbar">
          <div
            :class="['c', activeChip === null ? 'on' : '']"
            data-testid="feed-chip"
            data-chip="전체"
            @click="onSelectChip(null)"
          >
            <ion-icon :icon="flameOutline" class="ic-16" />전체
          </div>
          <div
            v-for="c in chips"
            :key="c"
            :class="['c', activeChip === c ? 'on' : '']"
            data-testid="feed-chip"
            :data-chip="c"
            @click="onSelectChip(c)"
          >
            {{ c }}
          </div>
        </div>

        <!-- Featured hero — the highest-like post after chip-filter. Tapping
             opens the shot detail directly. -->
        <div
          v-if="featured"
          class="featured-wrap"
          data-testid="feed-featured"
          @click="onOpenShot(featured.id)"
        >
          <div class="featured">
            <img :src="featured.imageUrl" :alt="featured.place.name" />
            <div class="info">
              <span class="tag">
                <ion-icon :icon="flameOutline" class="ic-16" />오늘의 인기
              </span>
              <div class="t">{{ featured.caption ?? featured.place.name }}</div>
              <div class="s">
                {{ featured.author.handle }} · {{ featured.work.title }}
                <span class="dot" />♥ {{ formatCount(featured.likeCount) }}
              </div>
            </div>
          </div>
        </div>

        <div class="sec-h">
          <span>최근 인증샷</span>
          <span
            class="more"
            data-testid="feed-see-all"
            @click="onOpenDetailFeed"
          >전체보기 ›</span>
        </div>

        <!-- 3-column grid of remaining posts. Compare-mode posts get a
             center vertical divider; multi/video posts carry a top-right
             type icon. Tap → /shot/:id (task #38 parity). -->
        <div class="grid" data-testid="feed-grid">
          <div
            v-for="p in gridPosts"
            :key="p.id"
            :class="['cell', p.sceneCompare ? 'compare' : '']"
            data-testid="feed-grid-cell"
            :data-post-id="p.id"
            @click="onOpenShot(p.id)"
          >
            <img :src="p.imageUrl" :alt="p.place.name" />
            <span class="drama">{{ p.work.title }}</span>
            <span class="likes">
              <ion-icon :icon="heart" class="ic-16" />{{ formatCount(p.likeCount) }}
            </span>
          </div>
          <p
            v-if="gridPosts.length === 0 && featured === null && !loading"
            class="empty-note"
          >
            표시할 인증샷이 없어요
          </p>
        </div>

        <ion-infinite-scroll
          v-if="hasMore"
          :disabled="loading"
          threshold="200px"
          @ionInfinite="onInfinite"
        >
          <ion-infinite-scroll-content loading-spinner="dots" />
        </ion-infinite-scroll>

        <div class="tail" />
      </div>
    </ion-content>
    <FrTabBar :model-value="'feed'" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
} from '@ionic/vue';
import {
  heart,
  searchOutline,
  flameOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useFeedStore, type FeedTab } from '@/stores/feed';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';

const feedStore = useFeedStore();
const router = useRouter();
const route = useRoute();
const { posts, tab, hasMore, loading, error } = storeToRefs(feedStore);
const { showError } = useToast();

const tabs: Array<{ key: FeedTab; label: string }> = [
  { key: 'RECENT', label: '최신' },
  { key: 'POPULAR', label: '인기' },
  { key: 'FOLLOWING', label: '팔로잉' },
  { key: 'NEARBY', label: '내 주변' },
  { key: 'BY_WORK', label: '작품별' },
];

// Chip filter — derives the distinct set of work titles from the current
// `posts` so the row always reflects what the grid can actually surface.
// "전체" (null) disables the filter. Kept client-side for now; a later
// iteration could push this to the server as `workTitle` param.
const activeChip = ref<string | null>(null);
const chips = computed<string[]>(() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of posts.value) {
    const t = p.work.title;
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
});

// Filtered posts (chip applied). featured = highest-like from the filtered
// set; grid = everything else.
const filteredPosts = computed(() => {
  if (activeChip.value === null) return posts.value;
  return posts.value.filter((p) => p.work.title === activeChip.value);
});
const featured = computed(() => {
  if (filteredPosts.value.length === 0) return null;
  // Pick the highest-like post as the hero. Stable ordering via slice().
  return filteredPosts.value
    .slice()
    .sort((a, b) => b.likeCount - a.likeCount)[0];
});
const gridPosts = computed(() => {
  const f = featured.value;
  if (!f) return filteredPosts.value;
  return filteredPosts.value.filter((p) => p.id !== f.id);
});

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// task #25: 탭 상태를 라우트 query 에 동기화 — 새로고침/공유 URL 시 같은
// 탭으로 복원, 외부 링크에서 ?tab=POPULAR 식의 진입도 자연스럽게 동작.
async function onSelectTab(t: FeedTab): Promise<void> {
  activeChip.value = null;
  await feedStore.setTab(t);
  if (error.value) await showError(error.value);
  // URL 갱신 — pushState 가 아닌 replace 로 history 오염 방지.
  if (route.query.tab !== t) {
    void router.replace({ path: route.path, query: { ...route.query, tab: t } });
  }
}

// 유효한 FeedTab string 만 store 에 적용 — 잘못된 query 값은 무시.
const VALID_TABS: ReadonlySet<FeedTab> = new Set([
  'RECENT', 'POPULAR', 'FOLLOWING', 'NEARBY', 'BY_WORK',
]);
function pickQueryTab(): FeedTab | null {
  const raw = route.query.tab;
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : null;
  if (typeof value !== 'string') return null;
  return VALID_TABS.has(value as FeedTab) ? (value as FeedTab) : null;
}

// 외부에서 ?tab=POPULAR 식으로 URL 만 변경되어 들어오는 케이스 (router.push
// 가 아닌 brower back/forward, 또는 같은 페이지 다른 query 진입)에 대응.
watch(
  () => route.query.tab,
  () => {
    const t = pickQueryTab();
    if (t !== null && t !== feedStore.tab) void feedStore.setTab(t);
  },
);

function onSelectChip(c: string | null): void {
  activeChip.value = c;
}

async function onInfinite(ev: Event): Promise<void> {
  await feedStore.loadMore();
  const target = ev.target as HTMLIonInfiniteScrollElement | null;
  if (target) await target.complete();
}

async function onOpenShot(id: number): Promise<void> {
  await router.push(`/shot/${id}`);
}

async function onOpenDetailFeed(): Promise<void> {
  // "전체보기 ›" takes the user into the Instagram-style full-card scroll
  // (per 13-feed-detail.html). Routing target is /feed/detail; the grid
  // stays as the /feed landing for quick Explore.
  await router.push('/feed/detail');
}

async function onSearch(): Promise<void> {
  await router.push('/search');
}

onMounted(async () => {
  // task #25: URL 의 ?tab= 값으로 첫 진입 탭 결정. 없으면 store 의 기본값 유지.
  const seedTab = pickQueryTab();
  if (seedTab !== null && seedTab !== feedStore.tab) {
    await feedStore.setTab(seedTab);
  } else {
    await feedStore.fetch();
  }
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content.feed-content {
  --background: #ffffff;
}

.feed-scroll {
  overflow-y: auto;
  /* FrTabBar occupies 84px + sab; keep 120px clearance so the last grid
     row + the infinite-scroll spinner don't bump into the nav. */
  padding-bottom: calc(120px + env(safe-area-inset-bottom));
}

.feed-head {
  padding: calc(8px + env(safe-area-inset-top)) 20px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.feed-head h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--fr-ink);
}
.search-row {
  padding: 4px 20px 12px;
  cursor: pointer;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--fr-bg-muted);
  border-radius: 14px;
  padding: 11px 14px;
  color: var(--fr-ink-3);
  font-size: 14px;
}

.feed-tabs {
  display: flex;
  gap: 22px;
  padding: 0 20px;
  border-bottom: 1px solid var(--fr-line);
}
.feed-tabs .t {
  padding: 10px 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--fr-ink-4);
  border-bottom: 2px solid transparent;
  letter-spacing: -0.02em;
  cursor: pointer;
  user-select: none;
}
.feed-tabs .t.on {
  color: var(--fr-ink);
  border-bottom-color: var(--fr-ink);
}

/* ---------- Chip filter row (work titles) ---------- */
.chip-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 20px 4px;
}
.chip-row .c {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 12px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  gap: 4px;
  letter-spacing: -0.01em;
  cursor: pointer;
  user-select: none;
}
.chip-row .c.on {
  background: var(--fr-ink);
  color: #ffffff;
}

/* ---------- Featured hero card ---------- */
.featured-wrap {
  padding: 10px 20px 4px;
}
.featured {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  cursor: pointer;
}
.featured img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.featured::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.05) 50%,
    rgba(0, 0, 0, 0.78) 100%
  );
}
.featured .info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px;
  color: #ffffff;
  z-index: 2;
}
.featured .tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(20, 188, 237, 0.95);
  margin-bottom: 7px;
}
.featured .t {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
}
.featured .s {
  font-size: 11.5px;
  margin-top: 3px;
  opacity: 0.9;
  display: flex;
  align-items: center;
  gap: 6px;
}
.featured .s .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ffffff;
  opacity: 0.5;
}

/* ---------- Section header ---------- */
.sec-h {
  padding: 18px 20px 8px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--fr-ink);
}
.sec-h .more {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--fr-primary);
  cursor: pointer;
}

/* ---------- 3-column grid ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.cell {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  background: #eef2f6;
}
.cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}
.cell:hover img {
  transform: scale(1.04);
}
.cell .drama {
  position: absolute;
  left: 5px;
  top: 5px;
  font-size: 9.5px;
  font-weight: 800;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.65);
  padding: 3px 6px;
  border-radius: 5px;
  backdrop-filter: blur(6px);
  letter-spacing: -0.01em;
}
.cell .likes {
  position: absolute;
  right: 5px;
  bottom: 5px;
  font-size: 9.5px;
  font-weight: 800;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  gap: 2px;
}
.cell.compare::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: #ffffff;
  z-index: 1;
  opacity: 0.9;
}
.cell.compare::after {
  content: '비교';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 8.5px;
  font-weight: 900;
  color: #ffffff;
  background: rgba(20, 188, 237, 0.92);
  padding: 2px 5px;
  border-radius: 999px;
  z-index: 2;
  letter-spacing: -0.01em;
}

.empty-note {
  grid-column: 1 / -1;
  padding: 48px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}

.tail {
  height: 20px;
}
</style>
