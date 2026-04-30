<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sv-content">
      <header class="top">
        <!-- Back button — not in 11-saved.html (디자인엔 없음) but the app
             routes here from ProfilePage's "저장" tab, so users need a way
             back to their profile context. Wrapped with h1 so the title
             hugs the back button instead of centering between the arrows. -->
        <div class="top-lead">
          <button
            type="button"
            class="back"
            aria-label="뒤로"
            data-testid="saved-back"
            @click="onBack"
          >
            <ion-icon :icon="chevronBackOutline" class="ic-20" />
          </button>
          <h1>저장한 장소</h1>
        </div>
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
            <button
              v-if="collections.length > 0 || editMode"
              type="button"
              class="sort-btn edit-toggle"
              data-testid="coll-edit-toggle"
              @click="onToggleEditMode"
            >{{ editMode ? '완료' : '편집' }}</button>
          </div>
        </section>

        <!-- 컬렉션 목록 — 서버 fetch 결과 직접 렌더. 편집 모드에선 카드 우상단
             "..." 버튼 노출, 카드 자체 탭은 막아 액션과 충돌 방지. -->
        <div class="collection-row no-scrollbar">
          <template v-if="loading && collections.length === 0">
            <div
              v-for="n in 3"
              :key="`coll-sk-${n}`"
              class="coll coll--skeleton"
              data-testid="coll-card-skeleton"
            >
              <ion-skeleton-text :animated="true" class="sk-cover" />
              <div>
                <ion-skeleton-text :animated="true" class="sk-name" />
                <ion-skeleton-text :animated="true" class="sk-count" />
              </div>
            </div>
          </template>
          <div
            v-for="c in collections"
            :key="c.id"
            :class="['coll', editMode ? 'editing' : '']"
            data-testid="coll-card"
            @click="onCollectionCardTap(c)"
          >
            <img
              v-if="(c.coverImageUrls ?? []).length > 0"
              :src="(c.coverImageUrls ?? [])[0]"
              :alt="c.name"
            />
            <div />
            <div>
              <div class="name">{{ c.name }}</div>
              <div class="count">
                <ion-icon :icon="collectionIconFor(c)" class="ic-16" />{{ c.count }}곳
              </div>
            </div>
            <button
              v-if="editMode"
              type="button"
              class="coll-menu"
              :aria-label="`${c.name} 컬렉션 옵션`"
              data-testid="coll-menu"
              @click.stop="onCollectionMenu(c)"
            >
              <ion-icon :icon="ellipsisHorizontal" class="ic-18" />
            </button>
          </div>
          <div
            v-if="!editMode"
            class="coll new"
            data-testid="coll-new"
            @click="onCreateCollection"
          >
            <ion-icon :icon="addOutline" class="ic-24" />
            새 컬렉션
          </div>
        </div>

        <!-- AI 루트 배너 — 항상 표시. 백엔드 추천 엔진 붙기 전엔 고정 문구. -->
        <div
          class="banner"
          data-testid="ai-route-banner"
          @click="onOpenSuggestion"
        >
          <div class="ico"><ion-icon :icon="routeIcon" class="ic-22" /></div>
          <div class="banner-text">
            <div class="t">{{ aiBanner.title }}</div>
            <div class="s">{{ aiBanner.subtitle }}</div>
          </div>
          <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
        </div>

        <section class="section">
          <div class="section-h">
            <h2>모든 저장 · {{ totalCount }}곳</h2>
            <span class="sort-btn">거리순<ion-icon :icon="chevronDownOutline" class="ic-16" /></span>
          </div>
          <div class="saved-list">
            <template v-if="loading && items.length === 0">
              <div
                v-for="n in 4"
                :key="`saved-sk-${n}`"
                class="saved saved--skeleton"
                data-testid="saved-card-skeleton"
              >
                <ion-skeleton-text :animated="true" class="sk-thumb" />
                <div class="saved-info">
                  <div>
                    <ion-skeleton-text :animated="true" class="sk-chip" />
                    <ion-skeleton-text :animated="true" class="sk-t" />
                    <ion-skeleton-text :animated="true" class="sk-loc" />
                  </div>
                </div>
              </div>
            </template>
            <div
              v-for="i in items"
              :key="i.placeId"
              class="saved"
              data-testid="saved-card"
              @click="onOpenPlace(i.placeId)"
            >
              <div class="saved-thumb">
                <img
                  v-if="i.coverImageUrls.length > 0"
                  :src="i.coverImageUrls[0]"
                  :alt="i.name"
                />
              </div>
              <div class="saved-info">
                <div>
                  <div class="chips">
                    <FrChip variant="soft">{{ i.contentTitle }}</FrChip>
                    <span v-if="i.visited" class="visited-flag" data-testid="visited-flag">
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
              <button
                type="button"
                :class="['saved-action', i.visited ? 'mint' : 'primary']"
                :aria-label="i.visited ? '방문함' : '인증샷 찍기'"
                data-testid="saved-action"
                @click.stop="onActionTap(i)"
              >
                <ion-icon :icon="i.visited ? checkmark : cameraOutline" class="ic-18" />
              </button>
            </div>
            <p v-if="!loading && items.length === 0" class="empty-note">저장한 장소가 없어요</p>
          </div>
        </section>
      </div>

      <!-- 새 컬렉션 만들기 다이얼로그는 task #29 에서 공통 컴포넌트
           (components/saved/NewCollectionModal.vue) 로 추출되어 App.vue 에
           1개만 마운트된다. 여기선 `uiStore.openNewCollectionModal()` 로
           트리거만 걸어두면, 전역 모달이 대신 뜬다. CollectionPicker 도
           동일 경로를 사용. -->
    </ion-content>
    <FrTabBar :model-value="'me'" />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  IonSkeletonText,
  actionSheetController,
  alertController,
} from '@ionic/vue';
import {
  searchOutline,
  swapVerticalOutline,
  locationOutline,
  addOutline,
  chevronForwardOutline,
  chevronDownOutline,
  chevronBackOutline,
  checkmark,
  navigateOutline,
  heartOutline,
  cameraOutline,
  filmOutline,
  moonOutline,
  starOutline,
  trailSignOutline,
  ellipsisHorizontal,
  pencilOutline,
  trashOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useSavedStore, type SavedItem, type SavedCollection } from '@/stores/saved';
import { useUploadStore } from '@/stores/upload';
import { useUiStore } from '@/stores/ui';
import FrChip from '@/components/ui/FrChip.vue';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const savedStore = useSavedStore();
const uploadStore = useUploadStore();
const uiStore = useUiStore();
const { collections, items, totalCount, error, loading } = storeToRefs(savedStore);
const { showError, showInfo } = useToast();

// AI 루트 배너는 고정 문구. `savedStore.suggestion` 이 null 이 아닌 값으로
// 오기 시작하면 computed 로 교체.
const aiBanner = {
  title: '근처 성지 4곳, 하루에 돌 수 있어요',
  subtitle: 'AI가 자동으로 루트를 짜드려요',
};
const routeIcon = trailSignOutline;

// 컬렉션 카드 카운트 아이콘 — 서버가 iconKey 를 내려주면 몇 가지 고정된
// ionicon 중 하나로 매핑. 없으면 map-pin 기본값.
const COLLECTION_ICON_MAP: Record<string, string> = {
  MAP_PIN: locationOutline,
  LOCATION: locationOutline,
  FILM: filmOutline,
  MOON: moonOutline,
  STAR: starOutline,
};
function collectionIconFor(c: SavedCollection): string {
  const key = c.iconKey;
  if (key && COLLECTION_ICON_MAP[key]) return COLLECTION_ICON_MAP[key];
  return locationOutline;
}

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
    // 방문 완료한 장소의 체크 아이콘 동작은 "인증샷 보기" 로 확장 예정 —
    // 현재는 안내 토스트만.
    await showInfo('이미 방문한 성지예요');
    return;
  }
  // 미방문: 카메라 아이콘 → 바로 인증샷 찍기 플로우. upload store 를 seed
  // 한 뒤 /camera 로 이동해 scene 오버레이까지 함께 로드.
  uploadStore.beginCapture({
    placeId: item.placeId,
    contentId: item.contentId,
    contentTitle: item.contentTitle,
    contentEpisode: null,
    placeName: item.name,
    sceneImageUrl: null,
  });
  await router.push('/camera');
}

function onBack(): void {
  // Prefer native back so forward/back stack stays accurate; fall back to
  // /profile when the user deep-linked directly into /saved (no history).
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    void router.replace('/profile');
  }
}

async function onSearch(): Promise<void> {
  await router.push('/search');
}

async function onSort(): Promise<void> {
  await showInfo('정렬 옵션은 곧 공개됩니다');
}

// 편집 모드: 컬렉션 카드 우상단 "..." 버튼이 노출되고, 카드 탭으로의 상세
// 진입은 잠긴다. 편집/완료 토글로 진입/종료. 컬렉션이 0개가 되면 자동 종료.
const editMode = ref(false);

function onToggleEditMode(): void {
  editMode.value = !editMode.value;
}

function onCollectionCardTap(c: SavedCollection): void {
  if (editMode.value) {
    // 편집 모드에선 "..." 메뉴를 명시적으로 눌러야만 액션 시트가 열린다.
    // 카드 자체 탭은 무시 — 사용자가 메뉴 버튼을 노린 미스 탭을 막는다.
    return;
  }
  void router.push(`/collection/${c.id}`);
}

async function onCollectionMenu(c: SavedCollection): Promise<void> {
  const sheet = await actionSheetController.create({
    header: c.name,
    buttons: [
      {
        text: '이름 변경',
        icon: pencilOutline,
        handler: () => {
          uiStore.openRenameCollectionModal({ id: c.id, name: c.name });
        },
      },
      {
        text: '삭제',
        role: 'destructive',
        icon: trashOutline,
        handler: () => {
          void confirmDeleteCollection(c);
        },
      },
      { text: '취소', role: 'cancel' },
    ],
  });
  await sheet.present();
}

async function confirmDeleteCollection(c: SavedCollection): Promise<void> {
  const alert = await alertController.create({
    header: '컬렉션 삭제',
    message: `컬렉션 '${c.name}'을(를) 삭제할까요? 저장된 ${c.count}곳도 함께 삭제됩니다.`,
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: () => {
          void handleDeleteCollection(c);
        },
      },
    ],
  });
  await alert.present();
}

async function handleDeleteCollection(c: SavedCollection): Promise<void> {
  const ok = await savedStore.deleteCollection(c.id);
  if (!ok) {
    if (error.value) await showError(error.value);
    return;
  }
  await showInfo('컬렉션이 삭제되었어요');
  // 마지막 컬렉션을 지웠으면 편집 모드를 자동 종료해 빈 상태에서 "편집" 버튼이
  // 둥둥 떠있지 않게 한다.
  if (savedStore.collections.length === 0) {
    editMode.value = false;
  }
}

// 새 컬렉션 모달은 task #29 에서 공통 컴포넌트로 빠졌다. 여기선 버튼
// 탭에 uiStore 액션만 걸어두면, App.vue 에 마운트된 NewCollectionModal 이
// 대신 열린다. CollectionPicker 도 같은 진입점을 공유.
function onCreateCollection(): void {
  uiStore.openNewCollectionModal();
}

async function onOpenSuggestion(): Promise<void> {
  // AI 루트는 후속 기능 — v1 에선 안내만.
  await showInfo('AI 루트 기능은 곧 공개됩니다');
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
.top .top-lead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.top h1 {
  margin: 0;
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--fr-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* 편집 모드 카드: 살짝 들썩이는 효과로 "탭 가능"이 아니라 "옵션 노출 중"임을
   시각적으로 구분. 카드 탭 자체는 비활성. */
.coll.editing { cursor: default; }

.coll--skeleton {
  background: var(--fr-bg-muted);
  cursor: default;
}
.coll--skeleton::before { display: none; }
.coll--skeleton .sk-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  z-index: 1;
}
.coll--skeleton > div {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.coll--skeleton .sk-name {
  width: 70%;
  height: 14px;
  margin: 0;
  border-radius: 4px;
}
.coll--skeleton .sk-count {
  width: 45%;
  height: 11px;
  margin: 0;
  border-radius: 4px;
}

.coll-menu {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: var(--fr-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
}

.edit-toggle {
  border: none;
  background: transparent;
  font: inherit;
  padding: 4px 8px;
  cursor: pointer;
}

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
.saved--skeleton {
  cursor: default;
}
.saved--skeleton .sk-thumb {
  width: 88px;
  height: 88px;
  margin: 0;
  border-radius: 12px;
  flex-shrink: 0;
}
.saved--skeleton .sk-chip {
  width: 50px;
  height: 16px;
  margin: 0 0 6px;
  border-radius: 6px;
}
.saved--skeleton .sk-t {
  width: 65%;
  height: 14px;
  margin: 0 0 4px;
  border-radius: 4px;
}
.saved--skeleton .sk-loc {
  width: 40%;
  height: 11px;
  margin: 0;
  border-radius: 4px;
}
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

/* 새 컬렉션 모달 관련 CSS 는 components/saved/NewCollectionModal.vue 로
   이동했다 (task #29). SavedPage 전용 스타일만 여기 남는다. */
</style>
