<template>
  <ion-page>
    <ion-content :fullscreen="true" class="pd-content">
      <div v-if="place" class="pd-scroll no-scrollbar">
        <section class="hero">
          <img :src="place.coverImageUrl" :alt="place.name" class="hero-img" />
          <div class="hero-grad" />
          <div class="hero-top">
            <button class="round-btn" type="button" aria-label="back" @click="onBack">
              <ion-icon :icon="chevronBack" class="ic-22" />
            </button>
            <div class="hero-top-right">
              <button class="round-btn" type="button" aria-label="share">
                <ion-icon :icon="shareSocialOutline" class="ic-20" />
              </button>
              <button class="round-btn" type="button" aria-label="more">
                <ion-icon :icon="ellipsisHorizontal" class="ic-20" />
              </button>
            </div>
          </div>
          <div class="hero-caption">
            <div class="hero-chips">
              <span class="work-chip" @click.stop="onOpenWork">
                <FrChip variant="primary">{{ place.workTitle }}</FrChip>
              </span>
              <FrChip v-if="episodeLabel" variant="ghost">{{ episodeLabel }}</FrChip>
            </div>
            <h1>{{ place.name }}</h1>
            <div class="loc">
              <ion-icon :icon="locationOutline" class="ic-16" />{{ place.regionLabel }}
            </div>
          </div>
          <div v-if="place.sceneImageUrl" class="scene-compare">
            <span class="lbl">드라마 장면</span>
            <img :src="place.sceneImageUrl" :alt="`${place.name} 장면`" />
          </div>
        </section>

        <div class="sheet">
          <div class="info-row">
            <div>
              <div class="info-chips">
                <span v-if="distanceLabel" class="meta">
                  <ion-icon :icon="navigateOutline" class="ic-16" />{{ distanceLabel }}
                </span>
                <span v-if="distanceLabel && driveLabel" class="meta-dot" />
                <span v-if="driveLabel" class="meta">{{ driveLabel }}</span>
              </div>
              <div class="rating-row">
                <ion-icon :icon="star" class="ic-16 star-ic" />
                <strong>{{ place.rating.toFixed(1) }}</strong>
                <span class="meta">({{ formatCount(place.reviewCount) }}명)</span>
              </div>
            </div>
            <div class="action-col">
              <button
                class="act"
                :class="{ on: isSaved(place.id) }"
                type="button"
                aria-label="save"
                @click="onToggleSave"
              >
                <ion-icon :icon="isSaved(place.id) ? bookmark : bookmarkOutline" class="ic-20" />
              </button>
              <button
                class="act like"
                :class="{ on: isLiked(place.id) }"
                type="button"
                aria-label="like"
                @click="onToggleLike"
              >
                <ion-icon :icon="isLiked(place.id) ? heart : heartOutline" class="ic-20" />
              </button>
            </div>
          </div>

          <section class="section">
            <h2>이 장면, 기억나세요?</h2>
            <p v-if="place.sceneDescription" class="body">{{ place.sceneDescription }}</p>
            <div class="stat-bar">
              <div class="stat-chip">
                <div class="n">{{ formatCount(place.photoCount) }}</div>
                <div class="l">인증샷</div>
              </div>
              <div class="stat-chip">
                <div class="n">{{ place.nearbyRestaurantCount }}곳</div>
                <div class="l">주변 맛집</div>
              </div>
              <div v-if="place.recommendedTimeLabel" class="stat-chip">
                <div class="n">{{ place.recommendedTimeLabel }}</div>
                <div class="l">추천 시간</div>
              </div>
            </div>
            <div class="cta-row">
              <button class="fr-btn ghost" type="button" @click="onViewMap">
                <ion-icon :icon="navigateOutline" class="ic-20" />지도 보기
              </button>
              <button class="fr-btn primary" type="button" @click="onCapture">
                <ion-icon :icon="cameraOutline" class="ic-20" />인증하기
              </button>
            </div>
          </section>

          <section v-if="photos.length > 0" class="section">
            <div class="section-head">
              <h2>방문객 인증샷</h2>
              <span class="link" @click="onOpenGallery">전체 보기</span>
            </div>
            <div class="gallery">
              <div
                v-for="(p, i) in galleryCells"
                :key="p.kind === 'photo' ? `ph-${p.photo.id}` : 'more'"
                :class="['cell', p.kind === 'more' ? 'more' : '']"
                @click="p.kind === 'more' ? onOpenGallery() : undefined"
              >
                <img v-if="p.kind === 'photo'" :src="p.photo.imageUrl" :alt="`photo-${i}`" />
                <template v-else>+{{ formatCount(p.remaining) }}</template>
              </div>
            </div>
          </section>

          <section v-if="related.length > 0" class="section">
            <h2>이 작품의 다른 성지</h2>
            <div class="related no-scrollbar">
              <div
                v-for="r in related"
                :key="r.id"
                class="rel-card"
                @click="onOpenRelated(r.id)"
              >
                <div class="thumb"><img :src="r.coverImageUrl" :alt="r.name" /></div>
                <div class="t">{{ r.name }}</div>
                <div class="s">
                  <template v-if="r.workEpisode">{{ r.workEpisode }} · </template>{{ r.regionShort }}
                </div>
              </div>
            </div>
          </section>

          <div class="tail" />
        </div>
      </div>

      <div v-else-if="loading" class="pd-loading" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  chevronBack,
  shareSocialOutline,
  ellipsisHorizontal,
  locationOutline,
  navigateOutline,
  star,
  bookmark,
  bookmarkOutline,
  heart,
  heartOutline,
  cameraOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import FrChip from '@/components/ui/FrChip.vue';
import { usePlaceDetailStore, type PlacePhoto } from '@/stores/placeDetail';
import { useUploadStore } from '@/stores/upload';
import { useMapStore } from '@/stores/map';
import { useSavedStore } from '@/stores/saved';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ id: string | number }>();

const router = useRouter();
const detailStore = usePlaceDetailStore();
const uploadStore = useUploadStore();
const mapStore = useMapStore();
const savedStore = useSavedStore();
const { place, photos, related, loading, error } = storeToRefs(detailStore);
const { showError } = useToast();

const isLiked = (id: number): boolean => detailStore.isLiked(id);
// Saved state is global (used on Feed / Gallery / Map / Profile too); route
// bookmark reads + writes through the single savedStore so the on/off icon
// stays consistent across pages without manual syncing.
const isSaved = (id: number): boolean => savedStore.isSaved(id);

const placeId = computed(() => Number(props.id));

const episodeLabel = computed(() => {
  const p = place.value;
  if (!p) return '';
  const ep = p.workEpisode ?? '';
  const ts = p.sceneTimestamp ?? '';
  if (ep && ts) return `${ep} · ${ts}`;
  return ep || ts;
});

const distanceLabel = computed(() => {
  const d = place.value?.distanceKm;
  if (d == null) return '';
  if (d < 1) return `${Math.round(d * 1000)}m`;
  return `${d.toFixed(1)}km`;
});

const driveLabel = computed(() => {
  const m = place.value?.driveTimeMin;
  if (m == null) return '';
  return `차로 ${m}분`;
});

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

type GalleryCell =
  | { kind: 'photo'; photo: PlacePhoto }
  | { kind: 'more'; remaining: number };

const GALLERY_CAP = 6;
const galleryCells = computed<GalleryCell[]>(() => {
  const ps = photos.value;
  const total = place.value?.photoCount ?? ps.length;
  const remaining = Math.max(0, total - ps.length);
  if (remaining > 0) {
    const shown = ps.slice(0, GALLERY_CAP - 1);
    return [
      ...shown.map<GalleryCell>((photo) => ({ kind: 'photo', photo })),
      { kind: 'more', remaining },
    ];
  }
  return ps.slice(0, GALLERY_CAP).map<GalleryCell>((photo) => ({ kind: 'photo', photo }));
});

function onBack(): void {
  router.back();
}

async function onToggleLike(): Promise<void> {
  if (!place.value) return;
  await detailStore.toggleLike();
  if (error.value) await showError(error.value);
}

async function onToggleSave(): Promise<void> {
  if (!place.value) return;
  await savedStore.toggleSave(place.value.id);
  if (savedStore.error) await showError(savedStore.error);
}

async function onViewMap(): Promise<void> {
  if (!place.value) return;
  await router.push({
    path: '/map',
    query: {
      selectedId: String(place.value.id),
      lat: String(place.value.latitude),
      lng: String(place.value.longitude),
    },
  });
}

async function onCapture(): Promise<void> {
  const p = place.value;
  if (!p) return;
  uploadStore.beginCapture({
    placeId: p.id,
    workId: p.workId,
    workTitle: p.workTitle,
    workEpisode: p.workEpisode,
    placeName: p.name,
    sceneImageUrl: p.sceneImageUrl,
  });
  await router.push('/camera');
}

async function onOpenGallery(): Promise<void> {
  if (!place.value) return;
  await router.push(`/gallery/${place.value.id}`);
}

async function onOpenWork(): Promise<void> {
  if (!place.value) return;
  await router.push(`/work/${place.value.workId}`);
}

async function onOpenRelated(id: number): Promise<void> {
  await router.push(`/place/${id}`);
}

async function load(id: number): Promise<void> {
  await detailStore.fetch(id);
  if (error.value) {
    await showError(error.value);
    return;
  }
  // Mirror the viewed place into the map store so switching back to the /map
  // tab restores this location instead of bouncing to the country overview.
  const p = place.value;
  if (p) {
    mapStore.markLastViewed({
      id: p.id,
      name: p.name,
      regionLabel: p.regionLabel,
      latitude: p.latitude,
      longitude: p.longitude,
      workId: p.workId,
      workTitle: p.workTitle,
      workEpisode: p.workEpisode,
      coverImageUrl: p.coverImageUrl,
      photoCount: p.photoCount,
      likeCount: p.likeCount,
      rating: p.rating,
      distanceKm: p.distanceKm,
    });
  }
}

onMounted(() => load(placeId.value));
watch(placeId, (next, prev) => {
  if (next !== prev) void load(next);
});
</script>

<style scoped>
ion-content.pd-content {
  --background: #ffffff;
}

.pd-scroll {
  overflow-y: auto;
  height: 100%;
}

.hero {
  position: relative;
  width: 100%;
  height: 440px;
  background: #000;
}
.hero-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.hero-grad {
  position: absolute; inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.4) 0%,
    rgba(0, 0, 0, 0) 30%,
    rgba(0, 0, 0, 0) 55%,
    rgba(0, 0, 0, 0.85) 100%
  );
}

.hero-top {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top));
  left: 0; right: 0;
  padding: 10px 16px;
  display: flex; justify-content: space-between; align-items: center;
  z-index: 5;
}
.hero-top-right { display: flex; gap: 8px; }
.round-btn {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  border: none;
  cursor: pointer;
}

.hero-caption {
  position: absolute;
  left: 20px; right: 20px; bottom: 44px;
  color: #ffffff;
  z-index: 4;
}
.hero-chips { display: flex; gap: 6px; }
.work-chip { cursor: pointer; }
.hero-caption h1 {
  font-size: 26px; font-weight: 800;
  letter-spacing: -0.03em;
  margin: 10px 0 6px;
}
.hero-caption .loc {
  display: flex; align-items: center; gap: 5px;
  font-size: 13px;
  opacity: 0.9;
}

.scene-compare {
  position: absolute;
  right: 18px; bottom: 44px;
  z-index: 5;
  width: 96px; height: 140px;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  border: 3px solid #ffffff;
}
.scene-compare img { width: 100%; height: 100%; object-fit: cover; }
.scene-compare .lbl {
  position: absolute;
  top: 6px; left: 6px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  font-size: 9px; font-weight: 700;
  padding: 3px 7px;
  border-radius: 999px;
  z-index: 1;
}

.sheet {
  background: #ffffff;
  border-radius: 28px 28px 0 0;
  margin-top: -28px;
  position: relative;
  z-index: 3;
  padding: 18px 20px 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--fr-line);
}
.info-chips {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.meta {
  font-size: 12px;
  color: var(--fr-ink-3);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.meta-dot {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: var(--fr-ink-4);
  display: inline-block;
}
.rating-row {
  display: flex; align-items: center; gap: 4px;
  margin-top: 4px;
}
.rating-row strong { font-size: 14px; }
.star-ic { color: var(--fr-amber); }
.action-col { display: flex; gap: 8px; }
.act {
  width: 44px; height: 44px;
  border-radius: 14px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  display: flex; align-items: center; justify-content: center;
  border: none;
  cursor: pointer;
}
.act.on { color: var(--fr-primary); }
.act.like.on { background: #fff1f2; color: var(--fr-coral); }

.section {
  padding: 22px 0;
  border-bottom: 1px solid var(--fr-line);
}
.section h2 {
  font-size: 17px; font-weight: 800;
  margin: 0 0 10px;
  letter-spacing: -0.02em;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}
.section-head h2 { margin: 0; }
.link {
  font-size: 12px;
  color: var(--fr-primary);
  font-weight: 700;
  cursor: pointer;
}
.body {
  font-size: 14px;
  color: var(--fr-ink-2);
  line-height: 1.55;
}

.stat-bar {
  display: flex; gap: 10px;
  margin-top: 14px;
  margin-bottom: 12px;
}
.stat-chip {
  flex: 1;
  background: var(--fr-bg-muted);
  border-radius: 14px;
  padding: 12px;
  text-align: center;
}
.stat-chip .n { font-weight: 800; font-size: 17px; letter-spacing: -0.02em; }
.stat-chip .l { font-size: 10.5px; color: var(--fr-ink-3); margin-top: 2px; }

.cta-row { display: flex; gap: 10px; margin-top: 16px; }
.fr-btn {
  flex: 1;
  height: 52px;
  border-radius: 16px;
  font-weight: 700; font-size: 15px;
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px;
  border: none;
  cursor: pointer;
}
.fr-btn.ghost { background: var(--fr-bg-muted); color: var(--fr-ink); }
.fr-btn.primary {
  background: var(--fr-primary);
  color: #ffffff;
  flex: 1.6;
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.35);
}

.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.gallery .cell {
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: #eef2f6;
}
.gallery .cell img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.gallery .cell.more {
  background: rgba(15, 23, 42, 0.8);
  color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px;
  cursor: pointer;
}

.related {
  display: flex; gap: 10px;
  overflow-x: auto;
  margin: 0 -20px;
  padding: 0 20px;
}
.rel-card {
  flex-shrink: 0;
  width: 140px;
  cursor: pointer;
}
.rel-card .thumb {
  width: 140px; height: 140px;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 8px;
}
.rel-card .thumb img { width: 100%; height: 100%; object-fit: cover; }
.rel-card .t {
  font-size: 12.5px; font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
}
.rel-card .s {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

.tail {
  height: calc(40px + env(safe-area-inset-bottom));
}

.pd-loading {
  height: 100%;
  background: var(--fr-bg-muted);
}
</style>
