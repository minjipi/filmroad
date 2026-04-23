<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sr-content">
      <header class="sr-head">
        <button
          class="back"
          type="button"
          aria-label="뒤로"
          @click="onBack"
        >
          <ion-icon :icon="chevronBackOutline" class="ic-22" />
        </button>
        <div class="sr-box">
          <ion-icon :icon="searchOutline" class="ic-18 search-ic" />
          <input
            ref="inputEl"
            v-model="rawQuery"
            class="sr-input"
            type="search"
            enterkeyhint="search"
            placeholder="작품·장소·지역 검색"
          />
          <button
            v-if="rawQuery"
            type="button"
            class="clear"
            aria-label="지우기"
            @click="onClear"
          >
            <ion-icon :icon="closeOutline" class="ic-18" />
          </button>
        </div>
      </header>

      <nav class="sr-tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="['sr-tab', activeTab === t.key ? 'on' : '']"
          role="tab"
          :aria-selected="activeTab === t.key"
          @click="activeTab = t.key"
        >
          {{ t.label }}<span v-if="t.count !== null" class="cnt">{{ t.count }}</span>
        </button>
      </nav>

      <div class="sr-scroll no-scrollbar">
        <div v-if="!trimmedQuery" class="sr-empty">
          <p>찾고 싶은 작품이나 장소를 입력해 주세요</p>
        </div>

        <div v-else-if="loading && !hasResults" class="sr-empty">
          <p>검색 중...</p>
        </div>

        <div v-else-if="!hasResults" class="sr-empty">
          <p>검색 결과가 없어요</p>
        </div>

        <template v-else>
          <section v-if="showWorks && works.length > 0" class="sr-section">
            <h2>작품 <span class="sm">{{ works.length }}</span></h2>
            <div class="works-list">
              <button
                v-for="w in works"
                :key="w.id"
                type="button"
                class="work-card"
                data-testid="work-item"
                @click="onOpenWork(w)"
              >
                <div class="thumb">
                  <img v-if="w.posterUrl" :src="w.posterUrl" :alt="w.title" />
                  <ion-icon v-else :icon="filmOutline" class="ic-22 fallback" />
                </div>
                <div class="meta">
                  <div class="t">{{ w.title }}</div>
                  <div v-if="w.placeCount != null" class="s">성지 {{ w.placeCount }}곳</div>
                </div>
                <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
              </button>
            </div>
          </section>

          <section v-if="showPlaces && places.length > 0" class="sr-section">
            <h2>장소 <span class="sm">{{ places.length }}</span></h2>
            <div class="places-grid">
              <button
                v-for="p in places"
                :key="p.id"
                type="button"
                class="place-card"
                data-testid="place-item"
                @click="onOpenPlace(p)"
              >
                <div class="cover">
                  <img :src="p.coverImageUrl" :alt="p.name" />
                  <div class="grad" />
                  <div class="cover-caption">
                    <span class="chip">{{ p.workTitle }}</span>
                    <div class="name">{{ p.name }}</div>
                    <div class="region">
                      <ion-icon :icon="locationOutline" class="ic-14" />{{ p.regionLabel }}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  filmOutline,
  locationOutline,
  searchOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import {
  useSearchStore,
  type SearchPlaceResult,
  type SearchWorkResult,
} from '@/stores/search';

type TabKey = 'ALL' | 'WORKS' | 'PLACES';

const router = useRouter();
const searchStore = useSearchStore();
const { works, places, loading, error } = storeToRefs(searchStore);

const inputEl = ref<HTMLInputElement | null>(null);
const rawQuery = ref('');
const activeTab = ref<TabKey>('ALL');

const trimmedQuery = computed(() => rawQuery.value.trim());
const hasResults = computed(
  () => works.value.length > 0 || places.value.length > 0,
);

const tabs = computed<Array<{ key: TabKey; label: string; count: number | null }>>(() => [
  { key: 'ALL', label: '전체', count: hasResults.value ? works.value.length + places.value.length : null },
  { key: 'WORKS', label: '작품', count: hasResults.value ? works.value.length : null },
  { key: 'PLACES', label: '장소', count: hasResults.value ? places.value.length : null },
]);

const showWorks = computed(() => activeTab.value === 'ALL' || activeTab.value === 'WORKS');
const showPlaces = computed(() => activeTab.value === 'ALL' || activeTab.value === 'PLACES');

// Debounce the input → single search call. 300ms balances "feels instant"
// with "don't spam the server on every keystroke".
const DEBOUNCE_MS = 300;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(rawQuery, (next) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  const q = next.trim();
  if (!q) {
    // Short-circuit empty: clear immediately, no pending fetch.
    void searchStore.search('');
    return;
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void searchStore.search(q);
  }, DEBOUNCE_MS);
});

function onClear(): void {
  rawQuery.value = '';
  void inputEl.value?.focus();
}

function onBack(): void {
  router.back();
}

async function onOpenWork(w: SearchWorkResult): Promise<void> {
  await router.push(`/work/${w.id}`);
}

async function onOpenPlace(p: SearchPlaceResult): Promise<void> {
  await router.push(`/place/${p.id}`);
}

onMounted(() => {
  // Autofocus the search input so the keyboard pops up on mobile.
  void inputEl.value?.focus();
});

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});

// Swallow any prior error when entering fresh — user doesn't need a stale
// toast from the last search session.
if (error.value) searchStore.reset();
</script>

<style scoped>
ion-content.sr-content {
  --background: #ffffff;
}

.sr-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 10px 8px;
  background: #ffffff;
  border-bottom: 1px solid var(--fr-line-soft);
}
.back {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: transparent;
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  flex-shrink: 0;
  cursor: pointer;
}
.sr-box {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 14px 0 40px;
  background: var(--fr-bg-muted);
  border-radius: 12px;
}
.sr-box .search-ic {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fr-ink-4);
}
.sr-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 14px;
  color: var(--fr-ink);
  padding: 0;
}
.sr-input::placeholder {
  color: var(--fr-ink-4);
}
.clear {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(15, 23, 42, 0.1);
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  margin-right: -4px;
}

.sr-tabs {
  display: flex;
  padding: 4px 16px 8px;
  gap: 8px;
  border-bottom: 1px solid var(--fr-line-soft);
}
.sr-tab {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  color: var(--fr-ink-3);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.sr-tab.on {
  color: #ffffff;
  background: var(--fr-ink);
}
.sr-tab .cnt {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--fr-ink-3);
}
.sr-tab.on .cnt {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.sr-scroll {
  overflow-y: auto;
  padding: 0 16px calc(80px + env(safe-area-inset-bottom));
}

.sr-empty {
  padding: 60px 16px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 14px;
}

.sr-section {
  padding: 16px 0 8px;
}
.sr-section h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.sr-section h2 .sm {
  font-size: 11.5px;
  color: var(--fr-ink-4);
  font-weight: 700;
  margin-left: 4px;
}

.works-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.work-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--fr-bg-muted);
  border: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.work-card .thumb {
  width: 48px;
  height: 64px;
  border-radius: 10px;
  background: #e2e8f0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-4);
  flex-shrink: 0;
}
.work-card .thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.work-card .thumb .fallback {
  color: var(--fr-ink-4);
}
.work-card .meta {
  flex: 1;
  min-width: 0;
}
.work-card .meta .t {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.work-card .meta .s {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.work-card .chev {
  color: var(--fr-ink-4);
}

.places-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.place-card {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
.place-card .cover {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 14px;
  overflow: hidden;
  background: #e2e8f0;
}
.place-card .cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.place-card .cover .grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6) 65%, rgba(0, 0, 0, 0.85) 100%);
}
.place-card .cover-caption {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  color: #ffffff;
  text-align: left;
}
.place-card .chip {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--fr-primary);
  color: #ffffff;
  letter-spacing: -0.01em;
  margin-bottom: 6px;
}
.place-card .name {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
}
.place-card .region {
  margin-top: 2px;
  font-size: 11px;
  opacity: 0.85;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.ic-14 {
  width: 14px;
  height: 14px;
}
</style>
