<template>
  <ion-page>
    <ion-content :fullscreen="true" class="pf-content">
      <header class="top-bar">
        <h1>{{ handleLabel }}</h1>
        <div class="r">
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
          <div class="stat clickable" data-testid="profile-followers-stat" @click="onOpenFollowers"><div class="n">{{ formatCount(stats.followersCount) }}</div><div class="l">팔로워</div></div>
          <div class="stat clickable" data-testid="profile-following-stat" @click="onOpenFollowing"><div class="n">{{ formatCount(stats.followingCount) }}</div><div class="l">팔로잉</div></div>
        </section>

        <VisitMap :pins="miniMapPins" @open="onOpenMap" />

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

        <!-- 인증샷 — backend `/api/users/me/photos` 실데이터 (task #35).
             빈 상태 placeholder + 각 cell 의 작품 chip 을 contentTitle 로. -->
        <div
          v-if="localTab === 'photos'"
          class="tab-photos-wrap"
          data-testid="tab-photos"
        >
          <div v-if="myPhotos.length > 0" class="grid3">
            <div
              v-for="photo in myPhotos"
              :key="photo.id"
              class="c"
              data-testid="shot-cell"
              @click="onOpenShot(photo.id)"
            >
              <img :src="photo.imageUrl" :alt="photo.placeName" />
              <span v-if="photo.contentTitle" class="tag">{{ photo.contentTitle }}</span>
            </div>
          </div>
          <p
            v-else-if="!myPhotosLoading && myPhotosLoaded"
            class="empty-note"
            data-testid="photos-empty"
          >
            아직 인증샷이 없어요
          </p>
          <p
            v-else-if="myPhotosLoading"
            class="empty-note"
            data-testid="photos-loading"
          >
            불러오는 중…
          </p>
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

          <div class="drama-list" data-testid="stampbook-contents-list">
            <div
              v-for="w in stampbookContents"
              :key="w.contentId"
              class="drama-card"
              data-testid="stampbook-content-card"
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
            <p v-if="stampbookContents.length === 0" class="empty-note">
              수집 중인 작품이 없어요
            </p>
          </div>
        </section>

        <!-- 저장 탭 (task #36): in-place 컬렉션 요약. 11-saved.html 의
             `.collection-row` 가로 스크롤 패턴을 그대로 차용 — 132px 카드
             + 1.05 aspect-ratio. 첫 카드 "기본" 은 `collectionId==null`
             미분류 count; 사용자 컬렉션은 `/collection/:id` 로 네비게이션.
             "새 컬렉션" 카드는 SavedPage 전용이라 여기선 렌더하지 않음. -->
        <section
          v-else-if="localTab === 'saved'"
          class="saved-tab"
          data-testid="tab-saved"
        >
          <div
            v-if="isSavedEmpty"
            class="saved-empty"
            data-testid="saved-empty"
          >
            <ion-icon :icon="bookmarkOutline" class="ic-22 saved-empty-ic" />
            <p class="msg">아직 저장한 성지가 없어요</p>
            <span class="hint">마음에 드는 성지를 북마크해보세요</span>
            <button
              type="button"
              class="fr-btn primary"
              data-testid="saved-empty-cta"
              @click="onGoFindPlaces"
            >
              <ion-icon :icon="addOutline" class="ic-16" />추가하러 가기
            </button>
          </div>
          <div v-else class="collection-row no-scrollbar">
            <div
              class="coll default"
              data-testid="coll-default"
              @click="onOpenDefaultCollection"
            >
              <div class="coll-placeholder">
                <ion-icon :icon="bookmarkOutline" class="ic-24" />
              </div>
              <div>
                <div class="name">기본</div>
                <div class="count">
                  <ion-icon :icon="bookmarkOutline" class="ic-16" />{{ defaultCount }}곳
                </div>
              </div>
            </div>
            <div
              v-for="c in savedCollections"
              :key="c.id"
              class="coll"
              data-testid="coll-card"
              @click="onOpenCollection(c.id)"
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
                  <ion-icon :icon="locationOutline" class="ic-16" />{{ c.count }}곳
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

    </ion-content>
    <FrTabBar :model-value="'me'" />

    <!-- 우상단 menu 아이콘으로 여는 액션 시트. Ionic actionSheetController 는
         header 에 아이콘을 꽂을 슬롯이 없어 ShareSheet 와 같은 Teleport 기반
         커스텀 시트로 대체. 취소 버튼은 별도 행 대신 헤더 우상단 X 아이콘으로
         일원화. 백드롭 탭으로도 닫힘. -->
    <Teleport to="body">
      <Transition name="pf-backdrop-fade">
        <div
          v-if="menuOpen"
          class="pf-backdrop"
          data-testid="profile-menu-backdrop"
          @click="closeMenu"
        />
      </Transition>
      <Transition name="pf-sheet-slide">
        <div
          v-if="menuOpen"
          class="pf-sheet"
          role="dialog"
          aria-label="프로필 메뉴"
          data-testid="profile-menu-sheet"
        >
          <header class="pf-sheet-head">
            <h2>프로필</h2>
            <button
              type="button"
              class="pf-sheet-close"
              aria-label="닫기"
              data-testid="profile-menu-close"
              @click="closeMenu"
            >
              <ion-icon :icon="closeOutline" class="ic-22" />
            </button>
          </header>

          <div class="pf-sheet-body">
            <button
              type="button"
              class="pf-sheet-row"
              data-testid="profile-menu-edit"
              @click="onEditAndClose"
            >
              <span class="pf-sheet-ico">
                <ion-icon :icon="createOutline" class="ic-20" />
              </span>
              <span class="pf-sheet-label">프로필 편집</span>
            </button>
            <button
              type="button"
              class="pf-sheet-row"
              data-testid="profile-menu-share"
              @click="onShareAndClose"
            >
              <span class="pf-sheet-ico">
                <ion-icon :icon="shareSocialOutline" class="ic-20" />
              </span>
              <span class="pf-sheet-label">공유</span>
            </button>
            <button
              type="button"
              class="pf-sheet-row danger"
              data-testid="profile-menu-logout"
              @click="onLogoutAndClose"
            >
              <span class="pf-sheet-ico">
                <ion-icon :icon="logOutOutline" class="ic-20" />
              </span>
              <span class="pf-sheet-label">로그아웃</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';
import {
  shareSocialOutline,
  menuOutline,
  checkmarkCircle,
  star,
  createOutline,
  locationOutline,
  gridOutline,
  ribbonOutline,
  bookmarkOutline,
  logOutOutline,
  trophyOutline,
  addOutline,
  closeOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useProfileStore } from '@/stores/profile';
import VisitMap from '@/components/profile/VisitMap.vue';
import { useStampbookStore } from '@/stores/stampbook';
import { useSavedStore } from '@/stores/saved';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';
import { buildProfileShareData } from '@/utils/share';

type LocalTab = 'photos' | 'stampbook' | 'saved';

const router = useRouter();
const profileStore = useProfileStore();
const stampbookStore = useStampbookStore();
const savedStore = useSavedStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const { user, stats, miniMapPins, error, myPhotos, myPhotosLoading, myPhotosLoaded } = storeToRefs(profileStore);
const { contents: stampbookContents } = storeToRefs(stampbookStore);
const { collections: savedCollections, items: savedItems } = storeToRefs(savedStore);
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

// task #35: PLACEHOLDER_IMAGES / gridCells were removed. Photos tab now
// renders `profileStore.myPhotos` from `/api/users/me/photos`; task #41
// rewired the fetch to fire on every page *entry* (mount + ion-view
// re-entry) so uploads / edits from other pages land back on /profile
// already fresh.

async function onSelectLocalTab(t: LocalTab): Promise<void> {
  // task #36: saved tab is back to in-place — no router.push for any tab.
  localTab.value = t;
  if (t === 'stampbook' && stampbookContents.value.length === 0) {
    await stampbookStore.fetch();
  }
  // First-time entry into 'photos' triggers the fetch; subsequent entries
  // reuse the cached list (users can scroll away and back without refetch).
  if (t === 'photos' && !myPhotosLoaded.value && !myPhotosLoading.value) {
    await profileStore.fetchMyPhotos();
  }
}

// ---------- Saved tab (task #36) ----------
// Derive the "기본" count from items whose collectionId is null — these are
// unfiled places. savedStore is the single source of truth; no local cache.
const defaultCount = computed(
  () => savedItems.value.filter((i) => i.collectionId == null).length,
);

// First saved-tab entry fires savedStore.fetch() once. savedStore is shared
// across SavedPage + CollectionPicker, so if the user already visited /saved
// this session the cache hits and the fetch is a no-op.
const savedFetched = ref(false);
watch(
  () => localTab.value,
  async (v) => {
    if (v !== 'saved' || savedFetched.value) return;
    savedFetched.value = true;
    await savedStore.fetch();
    if (savedStore.error) await showError(savedStore.error);
  },
);

// 저장 탭이 완전히 비어 있을 때(컬렉션도 없고 미분류도 0개) "추가하러 가기" CTA 를
// 노출. 컬렉션이 하나라도 있으면 그 카드들은 평소대로 보여 주는 게 자연스러우므로
// totalCount===0 이 아닌 collections.length === 0 까지 함께 본다. fetch 가 아직
// 안 끝났을 때 한 프레임 빈 상태가 깜빡이는 걸 막기 위해 savedFetched 가드 포함.
const isSavedEmpty = computed(
  () =>
    savedFetched.value &&
    defaultCount.value === 0 &&
    savedCollections.value.length === 0,
);

async function onGoFindPlaces(): Promise<void> {
  await router.push('/home');
}

async function onOpenDefaultCollection(): Promise<void> {
  // No /collection/default route — SavedPage doubles as the unclassified
  // drill-down until a dedicated default-collection page exists.
  await router.push('/saved');
}

async function onOpenCollection(id: number): Promise<void> {
  await router.push(`/collection/${id}`);
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
  await router.push('/profile/edit');
}

function onOpenFollowers(): void {
  if (!user.value) return;
  void router.push(`/user/${user.value.id}/followers`);
}

function onOpenFollowing(): void {
  if (!user.value) return;
  void router.push(`/user/${user.value.id}/following`);
}

function onShare(): void {
  if (!user.value) return;
  uiStore.openShareSheet(buildProfileShareData(user.value));
}

// 우상단 menu 버튼이 토글하는 커스텀 시트의 open 상태. 취소 버튼은 별도
// 행으로 두지 않고 헤더 우상단 X 아이콘 + 백드롭 탭으로 일원화.
const menuOpen = ref(false);

function onMenu(): void {
  menuOpen.value = true;
}

function closeMenu(): void {
  menuOpen.value = false;
}

// 각 액션은 시트를 먼저 닫고 → 동작 호출. 라우팅/공유 시트가 떠 있는 메뉴
// 시트에 가려지지 않게 하기 위함.
async function onEditAndClose(): Promise<void> {
  closeMenu();
  await onEdit();
}

function onShareAndClose(): void {
  closeMenu();
  onShare();
}

async function onLogoutAndClose(): Promise<void> {
  closeMenu();
  await handleLogout();
}

async function handleLogout(): Promise<void> {
  await authStore.logout();
  await showInfo('로그아웃되었습니다');
  await router.replace('/onboarding');
}

// task #41: refresh on every page entry (not just first mount) so /profile
// picks up fresh data after a user uploads a shot, edits their profile, or
// any other write-path that mutates server state. Ionic caches the page in
// its router outlet, so `onMounted` alone never re-fires — we hook the
// ionic-specific `onIonViewWillEnter` lifecycle that runs on both first
// entry AND re-entry from a pushed/popped route.
//
// Both hooks target the same handler; the in-flight `loading` flag
// prevents a duplicate first-mount fetch (mounted fires before
// ionViewWillEnter, so by the time Ionic's hook runs the initial fetch
// has already flipped `profileStore.loading = true` synchronously).
async function refreshProfileData(): Promise<void> {
  if (profileStore.loading) return;
  await profileStore.fetch();
  if (error.value) await showError(error.value);
  // Always re-fetch the photos grid on page entry — users come back to
  // /profile after uploading a new shot and expect to see it without
  // pulling to refresh or reloading the page.
  if (!profileStore.myPhotosLoading) {
    await profileStore.fetchMyPhotos();
  }
  // If the user was on the saved tab (mutated from SavedPage or the
  // collection picker elsewhere), refresh collections too. Reset the
  // tab-level `savedFetched` guard so the next tab-click fetch still
  // no-ops on a cache-hit rather than double-fetching.
  if (localTab.value === 'saved' && !savedStore.loading) {
    savedFetched.value = true;
    await savedStore.fetch();
  }
}

onMounted(refreshProfileData);
onIonViewWillEnter(refreshProfileData);
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
.stat.clickable { cursor: pointer; }
.stat .n { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; color: var(--fr-ink); }
.stat .l { font-size: 11.5px; color: var(--fr-ink-3); margin-top: 2px; }
.stat + .stat { border-left: 1px solid var(--fr-line); }

/* .cta (편집/공유) 는 PR #42 에서 우상단 menu 시트로 이전됐고, .mini-map /
   .mini-pin / .map-overlay 의 가짜 지도 스타일은 VisitMap 컴포넌트로 이전돼
   여기서는 모두 제거. */

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

/* ---------- 저장 탭 — 컬렉션 요약 (task #36) ----------
   11-saved.html `.collection-row` 패턴 그대로: 132px 고정 폭 카드 +
   aspect-ratio 1.05, 가로 스크롤. "기본" 카드는 이미지 없이 slate gradient
   + 북마크 아이콘, 나머지는 커버 이미지 + gradient overlay. */
.saved-tab {
  padding: 8px 0 14px;
}
.collection-row {
  display: flex;
  gap: 10px;
  padding: 8px 16px 14px;
  overflow-x: auto;
}
.collection-row .coll {
  flex-shrink: 0;
  width: 132px;
  aspect-ratio: 1.05;
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #ffffff;
  cursor: pointer;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
}
.collection-row .coll::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.8));
  z-index: 1;
}
.collection-row .coll > * {
  position: relative;
  z-index: 2;
}
.collection-row .coll img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.collection-row .coll .name {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.collection-row .coll .count {
  font-size: 10.5px;
  opacity: 0.9;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 3px;
}
.collection-row .coll.default {
  background: linear-gradient(135deg, #475569, #1e293b);
}
.collection-row .coll .coll-placeholder {
  align-self: flex-start;
  opacity: 0.75;
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

/* 저장 탭이 완전히 비어있을 때 노출되는 empty state. collection-row 와 같은
   가로 인셋(16px) 을 유지해 다른 탭의 콘텐츠 정렬과 일관되게 보이도록. */
.saved-empty {
  margin: 24px 16px 16px;
  padding: 28px 20px;
  border-radius: 18px;
  background: var(--fr-bg-muted, #f5f7fa);
  border: 1px solid var(--fr-line);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}
.saved-empty-ic {
  color: var(--fr-ink-3);
  margin-bottom: 4px;
}
.saved-empty .msg {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--fr-ink);
}
.saved-empty .hint {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-bottom: 14px;
}
.saved-empty .fr-btn {
  width: 100%;
  max-width: 220px;
  height: 44px;
  border-radius: 14px;
  font-weight: 700;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  cursor: pointer;
}
.saved-empty .fr-btn.primary {
  background: var(--fr-primary);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(20, 188, 237, 0.3);
}

/* ---------- 우상단 menu 시트 ----------
   z-index 60/70 — 글로벌 ShareSheet (80/90) 보다 한 단 아래로 둬, 공유 행
   탭 시 menu 가 leave 트랜지션 중이어도 위로 올라오는 ShareSheet 가 가려지지
   않게 한다. App.vue 에 먼저 마운트된 ShareSheet 의 teleport 노드가 DOM 상
   더 앞에 있어 동일 z-index 면 menu 가 위로 그려지던 버그가 있었음. */
.pf-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, 0.5);
}
.pf-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 70;
  background: #ffffff;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom));
  box-shadow: 0 -12px 32px rgba(15, 23, 42, 0.18);
}
.pf-sheet-slide-enter-from,
.pf-sheet-slide-leave-to {
  transform: translateY(100%);
}
.pf-sheet-slide-enter-active,
.pf-sheet-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.pf-backdrop-fade-enter-from,
.pf-backdrop-fade-leave-to {
  opacity: 0;
}
.pf-backdrop-fade-enter-active,
.pf-backdrop-fade-leave-active {
  transition: opacity 0.2s ease;
}

.pf-sheet-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0 12px;
}
.pf-sheet-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink-3);
}
.pf-sheet-close {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--fr-ink-3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.pf-sheet-close:hover,
.pf-sheet-close:active {
  background: var(--fr-bg-muted);
  color: var(--fr-ink);
}

.pf-sheet-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 4px;
}
.pf-sheet-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  height: 56px;
  padding: 0 12px;
  border: none;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
  transition: background 0.12s ease;
}
.pf-sheet-row:hover,
.pf-sheet-row:active {
  background: var(--fr-bg-muted);
}
.pf-sheet-ico {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--fr-bg-muted);
  color: var(--fr-ink);
}
.pf-sheet-label {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.pf-sheet-row.danger .pf-sheet-ico {
  background: rgba(239, 68, 68, 0.1);
  color: var(--fr-coral, #ef4444);
}
.pf-sheet-row.danger .pf-sheet-label {
  color: var(--fr-coral, #ef4444);
}

</style>
