<template>
  <ion-page>
    <ion-content :fullscreen="true" class="fl-content">
      <header class="fl-top">
        <button
          type="button"
          class="back"
          aria-label="뒤로"
          data-testid="fl-back"
          @click="onBack"
        >
          <ion-icon :icon="chevronBackOutline" class="ic-22" />
        </button>
        <h1 class="title" data-testid="fl-title">{{ headerTitle }}</h1>
        <span class="back" aria-hidden="true" />
      </header>

      <!--
        Tabs — 한 번 들어와도 followers / following 사이 전환은 라우트 query 가
        아닌 활성 탭 ref 로만 처리. 같은 사용자 id 라 데이터는 store 에 캐시되어
        탭 토글 시 즉시 노출 (재 fetch 없음, 처음 진입 탭만 fetch).
      -->
      <div class="fl-tabs" role="tablist">
        <button
          type="button"
          :class="['tab', activeTab === 'followers' ? 'on' : '']"
          role="tab"
          :aria-selected="activeTab === 'followers'"
          data-testid="fl-tab-followers"
          @click="onSelectTab('followers')"
        >팔로워</button>
        <button
          type="button"
          :class="['tab', activeTab === 'following' ? 'on' : '']"
          role="tab"
          :aria-selected="activeTab === 'following'"
          data-testid="fl-tab-following"
          @click="onSelectTab('following')"
        >팔로잉</button>
      </div>

      <div class="fl-list no-scrollbar">
        <div
          v-for="u in current.users"
          :key="u.id"
          class="fl-row"
          data-testid="fl-row"
          @click="onOpenUser(u.id)"
        >
          <div class="ava">
            <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.handle" />
          </div>
          <div class="meta">
            <div class="nm">{{ u.nickname }}</div>
            <div class="hd">{{ u.handle }}</div>
          </div>
          <button
            v-if="!u.isMe"
            type="button"
            :class="['follow-btn', u.following ? 'on' : '']"
            :disabled="current.togglingIds.has(u.id)"
            data-testid="fl-row-follow"
            @click.stop="onToggleRow(u.id)"
          >{{ u.following ? '팔로잉' : '팔로우' }}</button>
        </div>

        <p v-if="!current.loading && current.users.length === 0" class="empty-note">
          {{ activeTab === 'followers' ? '아직 팔로워가 없어요' : '아직 팔로우하는 사람이 없어요' }}
        </p>

        <button
          v-if="current.hasMore"
          type="button"
          class="load-more"
          :disabled="current.loading"
          data-testid="fl-load-more"
          @click="onLoadMore"
        >더 보기</button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import { chevronBackOutline } from 'ionicons/icons';
import { useRouter, useRoute } from 'vue-router';
import { useFollowListStore, type FollowTab } from '@/stores/followList';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  id: string | number;
  /** 라우트가 지정한 시작 탭 — /user/:id/followers 또는 /user/:id/following. */
  initialTab: FollowTab;
}>();

const router = useRouter();
const route = useRoute();
const store = useFollowListStore();
const { showError } = useToast();

const userId = computed<number>(() => Number(props.id));
const activeTab = ref<FollowTab>(props.initialTab);

const current = computed(() => store.tabFor(userId.value, activeTab.value));

const headerTitle = computed<string>(() =>
  activeTab.value === 'followers' ? '팔로워' : '팔로잉',
);

async function ensureLoaded(): Promise<void> {
  if (!Number.isFinite(userId.value)) return;
  const t = store.tabFor(userId.value, activeTab.value);
  if (t.loaded || t.loading) return;
  await store.fetch(userId.value, activeTab.value);
  if (store.error) await showError(store.error);
}

function onSelectTab(tab: FollowTab): void {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  // URL 도 동기화 — 새로고침 / 공유 시 같은 탭으로 진입.
  void router.replace({
    path: `/user/${userId.value}/${tab}`,
    query: route.query,
  });
}

async function onLoadMore(): Promise<void> {
  await store.loadMore(userId.value, activeTab.value);
  if (store.error) await showError(store.error);
}

async function onToggleRow(rowUserId: number): Promise<void> {
  await store.toggleFollowRow(userId.value, activeTab.value, rowUserId);
  if (store.error) await showError(store.error);
}

function onOpenUser(rowUserId: number): void {
  void router.push(`/user/${rowUserId}`);
}

function onBack(): void {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
  } else {
    void router.replace(`/user/${userId.value}`);
  }
}

onMounted(ensureLoaded);
// 탭 변경 시 lazy fetch.
watch(activeTab, ensureLoaded);
// id 가 라우트로 바뀌면 reset + fetch.
watch(
  () => props.id,
  (next, prev) => {
    if (next !== prev) {
      store.reset(Number(prev));
      void ensureLoaded();
    }
  },
);
// task #25: route 가 같은 컴포넌트 instance 를 재사용하면서 initialTab prop
// 만 바뀔 때 (예: /user/1/followers → /user/1/following 같은 사용자 내 탭
// 전환) activeTab 동기. 이전엔 onMounted 시점의 props.initialTab 만 반영하고
// 후속 prop 변경을 무시해 탭 UI 가 stale 되는 문제.
watch(
  () => props.initialTab,
  (next) => {
    if (next !== activeTab.value) activeTab.value = next;
  },
);
</script>

<style scoped>
ion-content.fl-content {
  --background: #ffffff;
}

.fl-top {
  padding: calc(8px + env(safe-area-inset-top)) 16px 8px;
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  background: #ffffff;
  border-bottom: 1px solid var(--fr-line);
}
.fl-top .back {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.fl-top .title {
  margin: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}

.fl-tabs {
  display: flex;
  border-bottom: 1px solid var(--fr-line);
}
.fl-tabs .tab {
  flex: 1;
  background: transparent;
  border: none;
  padding: 14px 0;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  color: var(--fr-ink-3);
  letter-spacing: -0.02em;
  cursor: pointer;
  position: relative;
}
.fl-tabs .tab.on {
  color: var(--fr-ink);
}
.fl-tabs .tab.on::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--fr-ink);
}

.fl-list {
  padding: 6px 0 calc(20px + env(safe-area-inset-bottom));
}

.fl-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
}
.fl-row:hover {
  background: var(--fr-bg-muted);
}
.fl-row .ava {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--fr-bg-muted);
}
.fl-row .ava img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.fl-row .meta {
  flex: 1;
  min-width: 0;
}
.fl-row .nm {
  font-size: 14px;
  font-weight: 700;
  color: var(--fr-ink);
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fl-row .hd {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follow-btn {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--fr-primary);
  color: #ffffff;
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
}
.follow-btn.on {
  background: #ffffff;
  border-color: var(--fr-line);
  color: var(--fr-ink-2);
}
.follow-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.empty-note {
  padding: 60px 24px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}

.load-more {
  margin: 8px auto 0;
  display: block;
  background: transparent;
  border: none;
  color: var(--fr-primary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 10px 16px;
}
.load-more[disabled] {
  opacity: 0.5;
  cursor: default;
}
</style>
