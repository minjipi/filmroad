<template>
  <ion-page>
    <ion-content :fullscreen="true" class="up-content">
      <!-- Floating top bar -->
      <header class="up-top">
        <!-- task #24: 뒤로가기 버튼 — `/shot/:id` 의 avatar/nm 클릭으로 진입한
             경우 사용자가 직전 shot 으로 자연스럽게 복귀할 수 있게. 다른 진입
             경로(피드/검색/직접 URL)에서도 동일 패턴이 일반적이라 항상 노출.
             aria-label 은 한국어로 통일 (task #23 MapPage 와 일관). -->
        <button
          type="button"
          class="ic-btn"
          aria-label="뒤로 가기"
          data-testid="up-back"
          @click="onBack"
        >
          <ion-icon :icon="chevronBackOutline" class="ic-22" />
        </button>
        <span class="title">
          <template v-if="user">@{{ user.handle }}</template>
        </span>
        <div class="right">
          <button type="button" class="ic-btn" aria-label="notifications" @click="onNotifs">
            <ion-icon :icon="notificationsOutline" class="ic-20" />
          </button>
          <button type="button" class="ic-btn" aria-label="more" @click="onMore">
            <ion-icon :icon="ellipsisHorizontal" class="ic-20" />
          </button>
        </div>
      </header>

      <!--
        task #22: flicker 제거 — 첫 sync 렌더 시점엔 onMounted 가 아직 안
        돌아 `loading` 이 false. 기존 `v-if="loading && !user"` 는 그 첫 1
        tick 동안 false 가 되어 페이지가 빈 상태(헤더만)로 깜빡임. 조건을
        `!user && !error` 로 넓혀, 데이터/에러가 도착하기 전 모든 시점을
        loading placeholder 가 흐름 끊김 없이 덮도록 수정.
      -->
      <div v-if="!user && !error" class="up-placeholder" data-testid="up-loading">
        불러오는 중…
      </div>
      <div v-else-if="!user && error" class="up-placeholder error" data-testid="up-error">
        {{ error }}
      </div>

      <div v-else-if="user" class="up-scroll no-scrollbar" data-testid="up-loaded">
        <!-- Cover — backend doesn't expose a dedicated field; use the
             avatar as a blurred backdrop so the page doesn't render a
             bare black rectangle. -->
        <div class="cover">
          <img
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            class="blur"
            :alt="user.nickname"
          />
        </div>

        <section class="up-head">
          <div class="up-avatar">
            <img
              v-if="user.avatarUrl"
              :src="user.avatarUrl"
              :alt="user.nickname"
            />
          </div>
          <div class="up-nm-row">
            <span class="up-nm">{{ user.nickname }}</span>
            <ion-icon v-if="user.verified" :icon="checkmarkCircle" class="ic-18 verify" />
            <span class="up-badge">
              <ion-icon :icon="star" class="ic-16" />
              Lv.{{ user.level }} {{ user.levelName }}
            </span>
          </div>
          <div class="up-handle">@{{ user.handle }}</div>
          <p v-if="user.bio" class="up-bio">{{ user.bio }}</p>
        </section>

        <section class="up-stats">
          <div class="up-stat">
            <div class="n">{{ formatCount(user.stats.photoCount) }}</div>
            <div class="l">인증샷</div>
          </div>
          <div
            class="up-stat clickable"
            data-testid="up-followers-stat"
            @click="onOpenFollowers"
          >
            <div class="n">{{ formatCount(user.stats.followersCount) }}</div>
            <div class="l">팔로워</div>
          </div>
          <div
            class="up-stat clickable"
            data-testid="up-following-stat"
            @click="onOpenFollowing"
          >
            <div class="n">{{ formatCount(user.stats.followingCount) }}</div>
            <div class="l">팔로잉</div>
          </div>
          <div class="up-stat">
            <div class="n">{{ formatCount(user.stats.collectedWorksCount) }}</div>
            <div class="l">작품</div>
          </div>

          <button
            v-if="user.isMe"
            type="button"
            class="btn-follow-inline"
            data-testid="up-edit-btn"
            @click="onEditProfile"
          >
            <ion-icon :icon="createOutline" class="ic-16" />프로필 편집
          </button>
          <button
            v-else
            type="button"
            :class="['btn-follow-inline', user.following ? 'on' : '']"
            :disabled="followPending"
            data-testid="up-follow-btn"
            @click="onToggleFollow"
          >
            <ion-icon
              :icon="user.following ? checkmarkOutline : personAddOutline"
              class="ic-16"
            />
            {{ user.following ? '팔로잉' : '팔로우' }}
          </button>
        </section>

        <!-- Highlights — 17-design "스탬프 북" horizontal row of
             collected works. Backend gives collectedCount + totalCount. -->
        <section
          v-if="user.recentCollectedWorks.length > 0"
          class="highlights"
          data-testid="up-highlights"
        >
          <div class="hl-label">스탬프 북</div>
          <div class="hl-row no-scrollbar">
            <div
              v-for="w in user.recentCollectedWorks"
              :key="w.id"
              class="hl"
              data-testid="up-highlight"
              @click="onOpenWork(w.id)"
            >
              <div class="ring">
                <div class="inner">
                  <img v-if="w.posterUrl" :src="w.posterUrl" :alt="w.title" />
                </div>
              </div>
              <div class="nm">{{ w.title }}</div>
              <div class="c">{{ w.collectedCount }}/{{ w.totalCount }}</div>
            </div>
          </div>
        </section>

        <!-- Tabs. Only 인증샷 is functional for now; 컬렉션/지도 render
             placeholder copy until their endpoints land. -->
        <nav class="up-tabs">
          <div
            v-for="t in tabs"
            :key="t.key"
            :class="['t', activeTab === t.key ? 'on' : '']"
            :data-testid="`up-tab-${t.key}`"
            @click="activeTab = t.key"
          >
            <ion-icon :icon="t.icon" class="ic-16" />{{ t.label }}
          </div>
        </nav>

        <!-- PHOTOS grid — backend `topPhotos` payload. Work-title overlay
             only; no per-photo like/compare flag in this payload. -->
        <div v-if="activeTab === 'photos'" class="grid" data-testid="up-grid">
          <div
            v-for="p in user.topPhotos"
            :key="p.id"
            class="cell"
            data-testid="up-cell"
            @click="onOpenShot(p.id)"
          >
            <img :src="p.imageUrl" :alt="p.placeName" />
            <span v-if="p.workTitle" class="ov">{{ p.workTitle }}</span>
          </div>
          <p
            v-if="user.topPhotos.length === 0"
            class="up-empty"
            data-testid="up-photos-empty"
          >
            아직 올린 인증샷이 없어요
          </p>
        </div>
        <div v-else-if="activeTab === 'collections'" class="up-placeholder">
          공개 컬렉션은 곧 공개됩니다
        </div>
        <div v-else-if="activeTab === 'map'" class="up-placeholder">
          방문 지도는 곧 공개됩니다
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { IonPage, IonContent, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import {
  chevronBackOutline,
  ellipsisHorizontal,
  notificationsOutline,
  checkmarkCircle,
  checkmarkOutline,
  personAddOutline,
  star,
  createOutline,
  gridOutline,
  bookmarkOutline,
  locationOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useUserProfileStore } from '@/stores/userProfile';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ id: string | number }>();

const router = useRouter();
const userStore = useUserProfileStore();
const authStore = useAuthStore();
// task #22: template no longer reads `loading` directly — `!user && !error`
// is enough to drive the placeholder. Keeping `userStore.loading` access
// inside refresh() (`if (userStore.loading) return`) since it's a guard.
const { user, error, followPending } = storeToRefs(userStore);
const { showInfo } = useToast();

type UpTab = 'photos' | 'collections' | 'map';
const activeTab = ref<UpTab>('photos');
const tabs: Array<{ key: UpTab; label: string; icon: string }> = [
  { key: 'photos', label: '인증샷', icon: gridOutline },
  { key: 'collections', label: '컬렉션', icon: bookmarkOutline },
  { key: 'map', label: '지도', icon: locationOutline },
];

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function onBack(): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    void router.replace('/home');
  }
}

async function onToggleFollow(): Promise<void> {
  await userStore.toggleFollow();
}

function onOpenFollowers(): void {
  if (!user.value) return;
  void router.push(`/user/${user.value.id}/followers`);
}

function onOpenFollowing(): void {
  if (!user.value) return;
  void router.push(`/user/${user.value.id}/following`);
}

async function onEditProfile(): Promise<void> {
  await router.push('/profile/edit');
}

async function onOpenWork(workId: number): Promise<void> {
  await router.push(`/work/${workId}`);
}

async function onOpenShot(photoId: number): Promise<void> {
  await router.push(`/shot/${photoId}`);
}

async function onNotifs(): Promise<void> {
  await showInfo('알림은 곧 공개됩니다');
}

async function onMore(): Promise<void> {
  await showInfo('메뉴는 곧 공개됩니다');
}

// Shared fetch handler — fires on first mount AND every IonViewWillEnter
// (task #41 pattern). If the viewer is actually the signed-in user, we
// redirect to /profile so they land on their personal dashboard with
// edit affordances instead of this public view.
async function refresh(): Promise<void> {
  const id = Number(props.id);
  if (!Number.isFinite(id)) return;
  if (
    authStore.user &&
    authStore.user.id === id &&
    router.currentRoute.value.path !== '/profile'
  ) {
    await router.replace('/profile');
    return;
  }
  if (userStore.loading) return;
  await userStore.fetchUser(id);
}

onMounted(refresh);
onIonViewWillEnter(refresh);
onUnmounted(() => userStore.reset());

// Re-fetch on :id change — Ionic may cache the page and route us to
// a different user id without unmount.
watch(
  () => props.id,
  (newId, oldId) => {
    if (newId !== oldId) void refresh();
  },
);
</script>

<style scoped>
ion-content.up-content {
  --background: #ffffff;
}

.up-top {
  position: absolute;
  top: calc(8px + env(safe-area-inset-top));
  left: 0;
  right: 0;
  z-index: 20;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.up-top .ic-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(10px);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.up-top .title {
  color: #ffffff;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.up-top .right {
  display: flex;
  gap: 8px;
}

.up-scroll {
  overflow-y: auto;
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

/* ---------- Cover ---------- */
.cover {
  height: 170px;
  position: relative;
  overflow: hidden;
  background: #111;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.85;
}
.cover img.blur {
  filter: blur(12px) brightness(0.8);
  transform: scale(1.1); /* hide blur fringe */
}
.cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.2),
    rgba(15, 23, 42, 0.55)
  );
}

/* ---------- Head ---------- */
.up-head {
  padding: 0 20px;
  margin-top: -44px;
  position: relative;
  z-index: 5;
}
.up-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid #ffffff;
  background: #eee;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}
.up-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.up-nm-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
}
.up-nm {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--fr-ink);
}
.up-nm-row .verify {
  color: var(--fr-primary);
}
.up-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
}
.up-handle {
  font-size: 12.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.up-bio {
  font-size: 13px;
  color: var(--fr-ink);
  line-height: 1.55;
  margin: 10px 0 0;
  letter-spacing: -0.01em;
  white-space: pre-line;
}

/* ---------- Stats ---------- */
.up-stats {
  display: flex;
  padding: 16px 20px 14px;
  gap: 12px;
  border-bottom: 1px solid var(--fr-line-soft);
  align-items: center;
}
.up-stat {
  text-align: left;
  flex-shrink: 0;
}
.up-stat.clickable {
  cursor: pointer;
}
.up-stat .n {
  font-size: 16px;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.up-stat .l {
  font-size: 10.5px;
  color: var(--fr-ink-3);
  font-weight: 700;
  margin-top: 1px;
}
.btn-follow-inline {
  margin-left: auto;
  height: 32px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  font-weight: 800;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 10px rgba(20, 188, 237, 0.28);
  letter-spacing: -0.01em;
  flex-shrink: 0;
  cursor: pointer;
}
.btn-follow-inline.on {
  background: var(--fr-bg-muted);
  color: var(--fr-ink);
  box-shadow: none;
  border: 1px solid var(--fr-line);
}
.btn-follow-inline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ---------- Highlights (collected works) ---------- */
.highlights {
  padding: 16px 20px 6px;
}
.hl-label {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--fr-ink-3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.hl-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
}
.hl {
  flex-shrink: 0;
  width: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}
.hl .ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(135deg, #14bced, #ff5a5f);
}
.hl .ring .inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #ffffff;
  overflow: hidden;
  background: #eee;
}
.hl .ring .inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hl .nm {
  font-size: 10.5px;
  font-weight: 700;
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hl .c {
  font-size: 10px;
  color: var(--fr-ink-4);
  font-weight: 700;
}

/* ---------- Tabs ---------- */
.up-tabs {
  display: flex;
  border-bottom: 1px solid var(--fr-line);
  margin-top: 10px;
}
.up-tabs .t {
  flex: 1;
  text-align: center;
  padding: 11px 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--fr-ink-4);
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  letter-spacing: -0.02em;
  cursor: pointer;
  user-select: none;
}
.up-tabs .t.on {
  color: var(--fr-ink);
  border-bottom-color: var(--fr-ink);
}

/* ---------- Grid ---------- */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
}
.grid .cell {
  aspect-ratio: 1;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  background: #eef2f6;
}
.grid .cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.grid .cell .ov {
  position: absolute;
  left: 6px;
  top: 6px;
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 800;
  color: #ffffff;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
}
/* Backend topPhotos shape (task #42 final) doesn't carry likeCount or
   sceneCompare — the compare stripe + heart overlay from the 17-design
   are deferred until the endpoint exposes those fields. */

.up-placeholder {
  padding: 80px 24px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 14px;
}
.up-placeholder.error {
  color: var(--fr-coral);
}
.up-empty {
  grid-column: 1 / -1;
  padding: 40px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}
</style>
