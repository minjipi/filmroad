<template>
  <ion-page>
    <ion-content :fullscreen="true" class="gl-content">
      <header class="top">
        <button type="button" aria-label="back" @click="onBack">
          <ion-icon :icon="chevronBack" class="ic-22" />
        </button>
        <h1>
          {{ placeHeader?.name ?? '갤러리' }}
          <span class="s">
            {{ formatCount(placeHeader?.totalPhotoCount ?? total) }}개<template v-if="placeHeader"> · {{ placeHeader.workTitle }}<template v-if="placeHeader.workEpisode"> {{ placeHeader.workEpisode }}</template></template>
          </span>
        </h1>
        <button type="button" aria-label="map" @click="onOpenMap">
          <ion-icon :icon="mapOutline" class="ic-20" />
        </button>
      </header>

      <div class="filter-row">
        <div class="chips no-scrollbar">
          <div
            v-for="s in sortOptions"
            :key="s.key"
            :class="['ch', sort === s.key ? 'on' : '']"
            @click="onSelectSort(s.key)"
          >{{ s.label }}</div>
        </div>
        <div class="view-toggle">
          <div
            :class="['vi', viewMode === 'FEED' ? 'on' : '']"
            @click="onSelectView('FEED')"
          >
            <ion-icon :icon="listOutline" class="ic-16" />
          </div>
          <div
            :class="['vi', viewMode === 'GRID' ? 'on' : '']"
            @click="onSelectView('GRID')"
          >
            <ion-icon :icon="gridOutline" class="ic-16" />
          </div>
        </div>
      </div>

      <div class="gl-scroll no-scrollbar">
        <div v-if="viewMode === 'FEED'" class="gal-feed">
          <article
            v-for="p in photos"
            :key="p.id"
            class="post"
          >
            <div class="post-head">
              <div class="ava">
                <img v-if="p.authorAvatarUrl" :src="p.authorAvatarUrl" :alt="p.authorHandle" />
              </div>
              <div class="handle-block">
                <div class="n">
                  @{{ p.authorHandle }}
                  <ion-icon v-if="p.authorVerified" :icon="checkmarkCircle" class="ic-16 verify" />
                </div>
                <div class="s">{{ formatRelative(p.createdAt) }}</div>
              </div>
              <ion-icon :icon="ellipsisHorizontal" class="ic-20 more" />
            </div>
            <div class="post-img">
              <img :src="p.imageUrl" :alt="p.caption ?? ''" />
              <div v-if="p.sceneCompare" class="scene-marker">
                <span class="d"><ion-icon :icon="sparklesOutline" class="ic-16" /></span>
                <span class="t">드라마 장면과 비교</span>
              </div>
            </div>
            <div class="post-actions">
              <span class="a">
                <ion-icon :icon="heartOutline" class="ic-20" />{{ formatCount(p.likeCount) }}
              </span>
              <span class="a" @click="onComment(p.id)">
                <ion-icon :icon="chatbubbleOutline" class="ic-20" />{{ formatCount(p.commentCount) }}
              </span>
              <span class="a">
                <ion-icon :icon="shareSocialOutline" class="ic-20" />
              </span>
              <span
                class="save-r"
                data-testid="gallery-save"
                @click="onToggleSave"
              >
                <ion-icon
                  :icon="placeSaved ? bookmark : bookmarkOutline"
                  class="ic-20"
                />
              </span>
            </div>
            <div v-if="p.caption" class="caption">
              <b>@{{ p.authorHandle }}</b> {{ p.caption }}
            </div>
          </article>
          <p v-if="photos.length === 0 && !loading" class="empty-note">인증샷이 아직 없어요</p>
        </div>

        <div v-else class="grid-view">
          <div
            v-for="p in photos"
            :key="p.id"
            class="gc"
          >
            <img :src="p.imageUrl" :alt="p.caption ?? ''" />
            <span v-if="p.sceneCompare" class="hl">장면 비교</span>
            <div class="hr">
              <span>
                <ion-icon :icon="heartOutline" class="ic-16" /> {{ formatCount(p.likeCount) }}
              </span>
              <span>
                <ion-icon :icon="chatbubbleOutline" class="ic-16" /> {{ formatCount(p.commentCount) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="photos.length < total" class="load-more" @click="onLoadMore">더 보기</div>
      </div>
    </ion-content>
    <CommentSheet
      :photo-id="activeCommentPhotoId"
      :open="activeCommentPhotoId !== null"
      @close="activeCommentPhotoId = null"
      @created="onCommentCreated"
    />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBack,
  mapOutline,
  listOutline,
  gridOutline,
  sparklesOutline,
  checkmarkCircle,
  ellipsisHorizontal,
  heartOutline,
  chatbubbleOutline,
  shareSocialOutline,
  bookmarkOutline,
  bookmark,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import {
  useGalleryStore,
  type GallerySort,
  type GalleryViewMode,
} from '@/stores/gallery';
import { useSavedStore } from '@/stores/saved';
import { useUiStore } from '@/stores/ui';
import CommentSheet from '@/components/comment/CommentSheet.vue';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ placeId: string | number }>();

const router = useRouter();
const galleryStore = useGalleryStore();
const savedStore = useSavedStore();
const uiStore = useUiStore();
const { placeHeader, photos, total, sort, viewMode, loading, error } = storeToRefs(galleryStore);
const { showError } = useToast();

// All photos on a gallery page share the same underlying place — bookmarks
// on any photo row save that place (not the individual photo).
const placeSaved = computed<boolean>(() =>
  placeHeader.value ? savedStore.isSaved(placeHeader.value.placeId) : false,
);

async function onToggleSave(): Promise<void> {
  const id = placeHeader.value?.placeId;
  if (id == null) return;
  if (savedStore.isSaved(id)) {
    await savedStore.toggleSave(id);
    if (savedStore.error) await showError(savedStore.error);
    return;
  }
  uiStore.openCollectionPicker(id);
}

const activeCommentPhotoId = ref<number | null>(null);

function onComment(id: number): void {
  activeCommentPhotoId.value = id;
}

function onCommentCreated(): void {
  const id = activeCommentPhotoId.value;
  if (id == null) return;
  const photo = photos.value.find((p) => p.id === id);
  if (photo) photo.commentCount += 1;
}

const placeIdNum = computed(() => Number(props.placeId));

const sortOptions: Array<{ key: GallerySort; label: string }> = [
  { key: 'RECENT', label: '전체' },
  { key: 'POPULAR', label: '인기순' },
  { key: 'SCENE_COMPARE', label: '장면 비교' },
];

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diffSec = Math.max(0, (Date.now() - t) / 1000);
  if (diffSec < 60) return '방금 전';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  return new Date(t).toLocaleDateString('ko-KR');
}

function onBack(): void {
  router.back();
}

async function onOpenMap(): Promise<void> {
  const id = placeIdNum.value;
  await router.push({ path: '/map', query: { selectedId: String(id) } });
}

async function onSelectSort(s: GallerySort): Promise<void> {
  await galleryStore.setSort(s);
}

function onSelectView(m: GalleryViewMode): void {
  galleryStore.setViewMode(m);
}

async function onLoadMore(): Promise<void> {
  await galleryStore.loadMore();
}

async function load(): Promise<void> {
  await galleryStore.fetch(placeIdNum.value);
  if (error.value) await showError(error.value);
}

onMounted(load);
// task #25: stale-data 가드 — 페이지 떠날 때 store 비우기. 다른 placeId
// 의 갤러리로 진입 시 이전 사진/헤더가 잠시 잔류하는 flicker 차단.
onUnmounted(() => galleryStore.reset());
watch(placeIdNum, (next, prev) => {
  if (next !== prev) void load();
});
</script>

<style scoped>
ion-content.gl-content {
  --background: #ffffff;
}
.gl-scroll {
  overflow-y: auto;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}

.top {
  padding: calc(8px + env(safe-area-inset-top)) 16px 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--fr-line);
  background: #ffffff;
}
.top h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  flex: 1;
  line-height: 1.2;
  color: var(--fr-ink);
  min-width: 0;
}
.top h1 .s {
  display: block;
  font-size: 11px;
  color: var(--fr-ink-3);
  font-weight: 600;
  margin-top: 1px;
}
.top button {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: transparent;
  color: var(--fr-ink-2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 8px;
}
.chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
}
.ch {
  white-space: nowrap;
  padding: 6px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  cursor: pointer;
  user-select: none;
}
.ch.on { background: var(--fr-ink); color: #ffffff; }
.view-toggle {
  display: flex;
  background: var(--fr-bg-muted);
  border-radius: 10px;
  padding: 2px;
  flex-shrink: 0;
}
.view-toggle .vi {
  width: 30px; height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-3);
  cursor: pointer;
}
.view-toggle .vi.on {
  background: #ffffff;
  color: var(--fr-ink);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.gal-feed {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.post { background: #ffffff; }
.post-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
}
.ava {
  width: 34px; height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: #fce7f3;
  flex-shrink: 0;
}
.ava img { width: 100%; height: 100%; object-fit: cover; display: block; }
.handle-block { min-width: 0; }
.post-head .n {
  font-size: 13px; font-weight: 800;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fr-ink);
}
.post-head .verify { color: var(--fr-primary); }
.post-head .s {
  font-size: 10.5px;
  color: var(--fr-ink-3);
  margin-top: 1px;
}
.post-head .more {
  margin-left: auto;
  color: var(--fr-ink-4);
}

.post-img {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  background: #000;
}
.post-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.scene-marker {
  position: absolute;
  left: 12px; bottom: 12px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  color: #ffffff;
  padding: 5px 10px 5px 5px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.scene-marker .d {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--fr-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}
.scene-marker .t { font-size: 10.5px; font-weight: 800; }

.post-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 4px;
}
.post-actions .a {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink-2);
}
.post-actions .a.liked { color: var(--fr-coral); }
.post-actions .save-r {
  margin-left: auto;
  color: var(--fr-ink-2);
}

.caption {
  padding: 4px 16px 14px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--fr-ink-2);
  letter-spacing: -0.01em;
}
.caption b { color: var(--fr-ink); }

.grid-view {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  padding: 0 6px;
}
.grid-view .gc {
  aspect-ratio: 4 / 5;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}
.grid-view .gc img { width: 100%; height: 100%; object-fit: cover; display: block; }
.grid-view .gc .hl {
  position: absolute;
  top: 8px; left: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  backdrop-filter: blur(6px);
}
.grid-view .gc .hr {
  position: absolute;
  bottom: 8px; left: 8px; right: 8px;
  display: flex;
  justify-content: space-between;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.empty-note {
  padding: 48px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}

.load-more {
  padding: 14px;
  text-align: center;
  color: var(--fr-primary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
</style>
