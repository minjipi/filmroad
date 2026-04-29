<template>
  <ion-page>
    <ion-content :fullscreen="true" class="lp-content">
      <header class="lp-top">
        <button
          type="button"
          class="back"
          aria-label="뒤로"
          data-testid="liked-places-back"
          @click="onBack"
        >
          <ion-icon :icon="chevronBackOutline" class="ic-20" />
        </button>
        <h1>좋아요한 장소</h1>
      </header>

      <div class="lp-scroll no-scrollbar">
        <!-- 빈 상태: 첫 fetch 끝났는데 아무것도 없을 때만. 미초기화 동안엔
             로딩 placeholder 가 자리 잡고 있어 빈 화면이 잠깐 깜빡이지 않게. -->
        <div
          v-if="!loading && loaded && items.length === 0"
          class="lp-empty"
          data-testid="liked-places-empty"
        >
          <ion-icon :icon="heartOutline" class="ic-48 lp-empty-ic" />
          <p>아직 좋아요한 장소가 없어요</p>
          <button
            type="button"
            class="lp-empty-cta"
            data-testid="liked-places-empty-cta"
            @click="onExplore"
          >탐색하기</button>
        </div>

        <div
          v-if="!loaded && loading"
          class="lp-loading"
          data-testid="liked-places-loading"
        >
          불러오는 중…
        </div>

        <div
          v-if="items.length > 0"
          class="lp-grid"
          data-testid="liked-places-grid"
        >
          <div
            v-for="p in items"
            :key="p.id"
            class="cell"
            role="button"
            tabindex="0"
            data-testid="liked-place-cell"
            :data-place-id="p.id"
            :aria-label="`${p.name} 상세 보기`"
            @click="onOpenPlace(p.id)"
            @keydown.enter="onOpenPlace(p.id)"
            @keydown.space.prevent="onOpenPlace(p.id)"
          >
            <img
              v-if="p.coverImageUrls.length > 0"
              :src="p.coverImageUrls[0]"
              :alt="p.name"
            />
            <div v-else class="cell-fallback">
              <ion-icon :icon="locationOutline" class="ic-22" />
            </div>
            <span v-if="p.contentTitle" class="drama">{{ p.contentTitle }}</span>
          </div>
        </div>

        <div
          v-if="hasMore && items.length > 0"
          ref="sentinelEl"
          class="lp-sentinel"
          aria-hidden="true"
          data-testid="liked-places-sentinel"
        />
        <div v-if="loading && items.length > 0" class="lp-loading-more">
          더 불러오는 중…
        </div>

        <div class="lp-tail" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBackOutline,
  heartOutline,
  locationOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useLikedPlacesStore } from '@/stores/likedPlaces';

const router = useRouter();
const store = useLikedPlacesStore();
const { items, loading, hasMore, loaded } = storeToRefs(store);

const sentinelEl = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

function teardown(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function setup(): void {
  teardown();
  if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') return;
  if (!sentinelEl.value) return;
  observer = new window.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (!store.hasMore || store.loading) continue;
        void store.loadMore();
      }
    },
    { rootMargin: '300px 0px' },
  );
  observer.observe(sentinelEl.value);
}

// 데이터가 늘어 sentinel 이 새로 마운트되거나 끝에 도달해 사라지는 케이스에 맞춰
// observer 를 재설정. items 변동 + hasMore 변동 두 시그널 모두 watch.
watch(
  () => [items.value.length, hasMore.value],
  async () => {
    await nextTick();
    if (hasMore.value && items.value.length > 0) {
      setup();
    } else {
      teardown();
    }
  },
);

function onBack(): void {
  router.back();
}

async function onOpenPlace(id: number): Promise<void> {
  await router.push(`/place/${id}`);
}

async function onExplore(): Promise<void> {
  await router.push('/feed');
}

onMounted(async () => {
  // 페이지 진입 시 항상 첫 페이지 재조회 — 다른 surface 에서 일어난 좋아요
  // 변경(특히 새로 누른 like)을 흡수.
  await store.fetch();
});
onUnmounted(teardown);
</script>

<style scoped>
ion-content.lp-content {
  --background: #ffffff;
}

.lp-scroll {
  overflow-y: auto;
  height: 100%;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}

.lp-top {
  position: sticky;
  top: 0;
  z-index: 5;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
  border-bottom: 1px solid var(--fr-line);
}
.lp-top h1 {
  margin: 0 0 0 4px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.lp-top .back {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: transparent;
  color: var(--fr-ink-2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.lp-top .back:active { background: var(--fr-bg-muted); }

.lp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding-top: 2px;
}
.cell {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  background: #eef2f6;
  display: block;
}
.cell:focus-visible {
  outline: 2px solid var(--fr-primary);
  outline-offset: -2px;
}
.cell img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}
.cell:hover img { transform: scale(1.04); }
.cell .cell-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-3);
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
  max-width: calc(100% - 10px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp-empty {
  padding: 80px 24px;
  text-align: center;
  color: var(--fr-ink-3);
}
.lp-empty-ic {
  color: var(--fr-ink-4);
  margin-bottom: 14px;
}
.lp-empty p {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--fr-ink-2);
}
.lp-empty-cta {
  border: none;
  background: var(--fr-ink);
  color: #ffffff;
  font-weight: 700;
  font-size: 13px;
  padding: 10px 18px;
  border-radius: 999px;
  cursor: pointer;
}

.lp-loading {
  padding: 60px 16px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}
.lp-loading-more {
  padding: 16px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 12px;
}
.lp-sentinel {
  height: 1px;
}
.lp-tail {
  height: 20px;
}
.ic-48 {
  font-size: 48px;
  width: 48px;
  height: 48px;
}
</style>
