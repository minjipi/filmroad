<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sv-content">
      <header class="top">
        <h1>저장한 장소</h1>
        <div class="actions">
          <button type="button" aria-label="search" @click="onSearch">
            <ion-icon :icon="searchOutline" class="ic-20" />
          </button>
          <button type="button" aria-label="sort" @click="onSort">
            <ion-icon :icon="swapVerticalOutline" class="ic-20" />
          </button>
        </div>
      </header>

      <div class="sv-scroll no-scrollbar">
        <section class="section">
          <div class="section-h">
            <h2>컬렉션</h2>
            <span class="sort-btn" @click="onEditCollections">편집</span>
          </div>
        </section>

        <div class="collection-row no-scrollbar">
          <div
            v-for="c in collections"
            :key="c.id"
            class="coll"
            @click="onOpenCollection(c.id)"
          >
            <img v-if="c.coverImageUrl" :src="c.coverImageUrl" :alt="c.name" />
            <div />
            <div>
              <div class="name">{{ c.name }}</div>
              <div class="count">
                <ion-icon :icon="locationOutline" class="ic-16" />{{ c.count }}곳
              </div>
            </div>
          </div>
          <div class="coll new" @click="onCreateCollection">
            <ion-icon :icon="addOutline" class="ic-24" />
            새 컬렉션
          </div>
        </div>

        <div v-if="suggestion" class="banner" @click="onOpenSuggestion">
          <div class="ico"><ion-icon :icon="mapOutline" class="ic-22" /></div>
          <div class="banner-text">
            <div class="t">{{ suggestion.title }}</div>
            <div class="s">{{ suggestion.subtitle }}</div>
          </div>
          <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
        </div>

        <section class="section">
          <div class="section-h">
            <h2>모든 저장 · {{ totalCount }}곳</h2>
            <span class="sort-btn">거리순<ion-icon :icon="chevronDownOutline" class="ic-16" /></span>
          </div>
          <div class="saved-list">
            <div
              v-for="i in items"
              :key="i.placeId"
              class="saved"
              @click="onOpenPlace(i.placeId)"
            >
              <div class="saved-thumb"><img :src="i.coverImageUrl" :alt="i.name" /></div>
              <div class="saved-info">
                <div>
                  <div class="chips">
                    <FrChip variant="soft">{{ i.workTitle }}</FrChip>
                    <span v-if="i.visited" class="visited-flag">
                      <ion-icon :icon="checkmark" class="ic-16" />방문함
                    </span>
                  </div>
                  <div class="t">{{ i.name }}</div>
                  <div class="loc">
                    <ion-icon :icon="locationOutline" class="ic-16" />{{ i.regionLabel }}
                  </div>
                </div>
                <div class="meta">
                  <span v-if="i.distanceKm != null" class="m">
                    <ion-icon :icon="navigateOutline" class="ic-16 m-primary" />{{ formatDistance(i.distanceKm) }}
                  </span>
                  <span class="m">
                    <ion-icon :icon="heartOutline" class="ic-16" />{{ formatCount(i.likeCount) }}
                  </span>
                </div>
              </div>
              <div
                :class="['saved-action', i.visited ? 'mint' : 'primary']"
                @click.stop="onActionTap(i)"
              >
                <ion-icon :icon="i.visited ? checkmark : cameraOutline" class="ic-18" />
              </div>
            </div>
            <p v-if="items.length === 0" class="empty-note">저장한 장소가 없어요</p>
          </div>
        </section>
      </div>

    </ion-content>
    <FrTabBar :model-value="'saved'" />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  searchOutline,
  swapVerticalOutline,
  locationOutline,
  addOutline,
  mapOutline,
  chevronForwardOutline,
  chevronDownOutline,
  checkmark,
  navigateOutline,
  heartOutline,
  cameraOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSavedStore, type SavedItem } from '@/stores/saved';
import FrChip from '@/components/ui/FrChip.vue';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const savedStore = useSavedStore();
const { collections, items, totalCount, suggestion, error } = storeToRefs(savedStore);
const { showError, showInfo } = useToast();

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km >= 100) return `${Math.round(km)}km`;
  return `${km.toFixed(1)}km`;
}

async function onOpenPlace(id: number): Promise<void> {
  await router.push(`/place/${id}`);
}

async function onActionTap(item: SavedItem): Promise<void> {
  if (item.visited) {
    await showInfo('이미 방문한 성지예요');
    return;
  }
  await router.push(`/place/${item.placeId}`);
}

async function onSearch(): Promise<void> {
  await showInfo('검색은 곧 공개됩니다');
}

async function onSort(): Promise<void> {
  await showInfo('정렬 옵션은 곧 공개됩니다');
}

async function onEditCollections(): Promise<void> {
  await showInfo('컬렉션 편집은 곧 공개됩니다');
}

async function onCreateCollection(): Promise<void> {
  await showInfo('새 컬렉션 만들기는 곧 공개됩니다');
}

async function onOpenCollection(_id: number): Promise<void> {
  await showInfo('컬렉션 상세는 곧 공개됩니다');
}

async function onOpenSuggestion(): Promise<void> {
  await router.push('/map');
}

onMounted(async () => {
  await savedStore.fetch();
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content.sv-content {
  --background: #ffffff;
}
.sv-scroll {
  overflow-y: auto;
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

.top {
  padding: calc(8px + env(safe-area-inset-top)) 16px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
}
.top h1 {
  margin: 0;
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--fr-ink);
}
.top .actions { display: flex; gap: 6px; }
.top button {
  width: 38px; height: 38px;
  border-radius: 11px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

.section {
  padding: 8px 16px 0;
}
.section-h {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.section-h h2 {
  margin: 0;
  font-size: 16px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.sort-btn {
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink-3);
  display: flex; align-items: center;
  gap: 3px;
  cursor: pointer;
}

.collection-row {
  display: flex;
  gap: 10px;
  padding: 8px 16px 14px;
  overflow-x: auto;
}
.coll {
  flex-shrink: 0;
  width: 132px;
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  aspect-ratio: 1.05;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #ffffff;
  cursor: pointer;
}
.coll::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.8));
  z-index: 1;
}
.coll > * { position: relative; z-index: 2; }
.coll img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.coll .name {
  font-size: 14px; font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.coll .count {
  font-size: 10.5px;
  opacity: 0.9;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 3px;
}
.coll.new {
  background: var(--fr-bg-muted);
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  border: 1.5px dashed var(--fr-line);
  font-weight: 800;
  font-size: 12px;
}
.coll.new::before { display: none; }

.banner {
  margin: 0 16px 14px;
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, #eef9ff, #faf5ff);
  border: 1px solid #e0e7ff;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.banner .ico {
  width: 40px; height: 40px;
  border-radius: 12px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-primary);
  flex-shrink: 0;
}
.banner .banner-text { flex: 1; }
.banner .t {
  font-size: 13px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.banner .s {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 1px;
}
.banner .chev { color: var(--fr-ink-4); }

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 8px;
}
.saved {
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 18px;
  padding: 10px;
  display: flex;
  gap: 12px;
  position: relative;
  cursor: pointer;
}
.saved-thumb {
  width: 88px; height: 88px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: #eef2f6;
}
.saved-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.saved-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2px 0;
  min-width: 0;
}
.saved-info .chips {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
  flex-wrap: wrap;
}
.visited-flag {
  font-size: 10px;
  color: var(--fr-mint);
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.saved-info .t {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.saved-info .loc {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.saved-info .meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--fr-ink-3);
  font-weight: 600;
}
.saved-info .meta .m {
  display: flex;
  align-items: center;
  gap: 3px;
}
.m-primary { color: var(--fr-primary); }

.saved-action {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  align-self: flex-start;
  cursor: pointer;
  flex-shrink: 0;
}
.saved-action.primary { background: var(--fr-primary); }
.saved-action.mint { background: var(--fr-mint); }

.empty-note {
  padding: 32px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}
</style>
