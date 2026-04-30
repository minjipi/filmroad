<template>
  <!-- 전체 화면 검색 모달. open=false 면 통째로 미렌더 → DOM 비용 0. 디자인의
       SearchModal 마크업을 그대로 옮기되, mock 추천 배열은 tripRouteStore 의
       searchSuggestions(이미 코스에 없는 것만), 검색 결과는 searchStore 를 재사용.
       Add 버튼은 emit('select', TripPlace) 으로 부모(TripRoutePage) 에 위임. -->
  <div
    v-if="open"
    class="rt-search-overlay"
    data-testid="rt-search-overlay"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div class="rt-search-sheet">
      <header class="rt-search-head">
        <div class="rt-search-input-wrap">
          <ion-icon :icon="searchOutline" class="ic-18 rt-search-ic" aria-hidden="true" />
          <input
            ref="inputEl"
            v-model="q"
            type="search"
            placeholder="장소, 카페, 맛집 검색"
            data-testid="rt-search-input"
            @keyup.enter="onSubmitQuery"
          />
        </div>
        <button
          type="button"
          class="rt-search-cancel"
          data-testid="rt-search-cancel"
          @click="emit('close')"
        >
          취소
        </button>
      </header>

      <div class="rt-search-chips" data-testid="rt-search-chips">
        <button
          v-for="c in CATEGORY_CHIPS"
          :key="c.key"
          type="button"
          :class="['rt-chip', activeChip === c.key ? 'is-active' : '']"
          @click="activeChip = c.key"
        >
          {{ c.label }}
        </button>
      </div>

      <div class="rt-search-body" data-testid="rt-search-body">
        <template v-if="!q.trim()">
          <h3 class="rt-section-title">최근 검색</h3>
          <div v-if="recentSearches.length > 0" class="rt-recent">
            <button
              v-for="r in recentSearches"
              :key="r"
              type="button"
              class="rt-recent-chip"
              @click="q = r"
            >
              <ion-icon :icon="timeOutline" class="ic-14" aria-hidden="true" />
              {{ r }}
            </button>
          </div>
          <p v-else class="rt-muted">최근 검색이 없어요</p>

          <h3 class="rt-section-title">코스에 추가하기 좋은 장소</h3>
          <div v-if="suggestions.length === 0" class="rt-empty">
            추가할 장소가 더 없어요
          </div>
          <SearchPlaceRow
            v-for="s in suggestions"
            :key="s.id"
            :place="s"
            data-testid="rt-suggestion-row"
            @add="emit('select', s)"
          />
        </template>

        <template v-else>
          <h3 class="rt-section-title">검색 결과</h3>
          <div v-if="searchStore.loading" class="rt-muted">불러오는 중…</div>
          <div v-else-if="searchResults.length === 0" class="rt-empty">
            결과가 없어요. 다른 키워드로 검색해보세요.
          </div>
          <SearchPlaceRow
            v-for="r in searchResults"
            :key="r.id"
            :place="r"
            data-testid="rt-search-result-row"
            @add="emit('select', r)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { searchOutline, timeOutline } from 'ionicons/icons';
import { useSearchStore, type SearchPlaceResult } from '@/stores/search';
import { useTripRouteStore, type TripPlace } from '@/stores/tripRoute';
import SearchPlaceRow from './SearchPlaceRow.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', place: TripPlace): void;
}>();

const searchStore = useSearchStore();
const tripRouteStore = useTripRouteStore();

/** 최근 검색은 sessionStorage 로 한 세션 유지. 디자인은 데이터 고정이지만
 *  실 사용감을 위해 검색 시 prepend / 5건 cap. */
const RECENT_KEY = 'fr.tripRoute.recentSearches';
function readRecent(): string[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}
function writeRecent(v: string[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(v.slice(0, 5)));
  } catch {
    /* full quota or denied — silent */
  }
}
const recentSearches = ref<string[]>(readRecent());

const CATEGORY_CHIPS = [
  { key: 'all', label: '전체' },
  { key: '관광지', label: '관광지' },
  { key: '맛집', label: '맛집' },
  { key: '카페', label: '카페' },
  { key: '액티비티', label: '액티비티' },
  { key: '숙소', label: '숙소' },
];
type ChipKey = (typeof CATEGORY_CHIPS)[number]['key'];
const activeChip = ref<ChipKey>('all');

const q = ref('');
const inputEl = ref<HTMLInputElement | null>(null);

/** 모달이 열릴 때마다 input 포커스 + 쿼리 초기화. */
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    q.value = '';
    activeChip.value = 'all';
    recentSearches.value = readRecent();
    await nextTick();
    try {
      inputEl.value?.focus();
    } catch {
      /* jsdom — focus may throw */
    }
  },
);

/** searchStore.query 와 양방향 결합 — 사용자 타이핑 → 디바운스 fetch. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(q, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!v.trim()) return;
  debounceTimer = setTimeout(() => {
    void searchStore.search(v.trim());
  }, 220);
});

function onSubmitQuery(): void {
  const v = q.value.trim();
  if (!v) return;
  // 즉시 push — 디바운스 우회.
  if (debounceTimer) clearTimeout(debounceTimer);
  void searchStore.search(v);
  // 최근 검색 prepend (중복 제거).
  const next = [v, ...recentSearches.value.filter((r) => r !== v)].slice(0, 5);
  recentSearches.value = next;
  writeRecent(next);
}

const suggestions = computed<TripPlace[]>(() => tripRouteStore.searchSuggestions);

/**
 * searchStore.places → TripPlace 어댑팅. lat/lng 가 있는 항목만 — 좌표 없는
 * 결과는 지도 마커로 그릴 수 없어 코스 후보에서 제외(조용히 필터). 카테고리
 * 필터는 mock 단계에서 의미 있는 분류 데이터가 없어 적용하지 않고 chip 만 UI 로 유지.
 */
const searchResults = computed<TripPlace[]>(() =>
  searchStore.places
    .filter((r): r is SearchPlaceResult & { latitude: number; longitude: number } =>
      typeof r.latitude === 'number' && typeof r.longitude === 'number',
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      regionLabel: r.regionLabel,
      latitude: r.latitude,
      longitude: r.longitude,
      contentId: r.contentId,
      contentTitle: r.contentTitle,
      coverImageUrl: r.coverImageUrls[0] ?? null,
      sceneImageUrl: r.sceneImageUrl ?? null,
      durationMin: 60,
      // 검색 결과는 backend visited 정보 없음 — 사용자가 코스에 추가한 후
      // 다음 init/load 에서 backend 가 채워준다. 기본값 false/null.
      visited: false,
      visitedAt: null,
    })),
);
</script>

<style scoped>
.rt-search-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(15, 23, 42, 0.4);
  display: flex;
  flex-direction: column;
}
.rt-search-sheet {
  flex: 1;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.rt-search-head {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: calc(env(safe-area-inset-top) + 14px) 16px 12px;
}
.rt-search-input-wrap {
  flex: 1;
  height: 44px;
  border-radius: 14px;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
  padding: 0 14px;
  gap: 8px;
}
.rt-search-input-wrap input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 15px;
  color: var(--fr-ink);
}
.rt-search-input-wrap input::placeholder {
  color: var(--fr-ink-4);
}
.rt-search-ic {
  color: var(--fr-ink-3);
}

.rt-search-cancel {
  border: 0;
  background: transparent;
  color: var(--fr-primary);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  padding: 0 4px;
}

.rt-search-chips {
  display: flex;
  gap: 8px;
  padding: 4px 16px 12px;
  overflow-x: auto;
  scrollbar-width: none;
}
.rt-search-chips::-webkit-scrollbar {
  display: none;
}
.rt-chip {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--fr-line);
  background: #ffffff;
  color: var(--fr-ink-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.rt-chip.is-active {
  background: var(--fr-primary);
  color: #ffffff;
  border-color: var(--fr-primary);
}

.rt-search-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px calc(env(safe-area-inset-bottom) + 16px);
}
.rt-section-title {
  margin: 14px 4px 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--fr-ink);
  letter-spacing: -0.2px;
}
.rt-recent {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.rt-recent-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  border: 0;
  font-size: 13px;
  color: var(--fr-ink-2);
  font-weight: 500;
  cursor: pointer;
}
.rt-muted,
.rt-empty {
  font-size: 13px;
  color: var(--fr-ink-3);
  padding: 8px 4px;
}
.rt-empty {
  padding: 16px 4px;
  text-align: center;
}
</style>
