<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sr-content">
      <header class="sr-top">
        <button
          type="button"
          class="back"
          aria-label="뒤로"
          data-testid="saved-routes-back"
          @click="onBack"
        >
          <ion-icon :icon="chevronBackOutline" class="ic-20" />
        </button>
        <h1>내 코스</h1>
      </header>

      <div class="sr-scroll no-scrollbar">
        <div v-if="!loaded && loading" class="sr-loading" data-testid="saved-routes-loading">
          불러오는 중…
        </div>

        <div
          v-else-if="loaded && items.length === 0"
          class="sr-empty"
          data-testid="saved-routes-empty"
        >
          <ion-icon :icon="mapOutline" class="ic-48 sr-empty-ic" />
          <p>아직 저장한 코스가 없어요</p>
          <button
            type="button"
            class="sr-empty-cta"
            data-testid="saved-routes-empty-cta"
            @click="onExplore"
          >작품 둘러보기</button>
        </div>

        <ul v-else class="sr-list" data-testid="saved-routes-list">
          <li
            v-for="r in items"
            :key="r.id"
            class="sr-card"
            :data-testid="`saved-route-card-${r.id}`"
            @click="onOpen(r.id)"
          >
            <div class="sr-thumb">
              <img v-if="r.coverImageUrl" :src="r.coverImageUrl" :alt="r.name" />
              <div v-else class="sr-thumb-fallback" aria-hidden="true">
                <ion-icon :icon="mapOutline" class="ic-22" />
              </div>
            </div>
            <div class="sr-body">
              <h2 class="sr-name">{{ r.name }}</h2>
              <p class="sr-meta">
                <span v-if="r.contentTitle">{{ r.contentTitle }}</span>
                <span v-if="r.contentTitle" class="sep">·</span>
                <span>📍 {{ r.placeCount }}곳</span>
                <span class="sep">·</span>
                <span>{{ formatRelativeTime(r.updatedAt) }} 갱신</span>
              </p>
            </div>
            <button
              type="button"
              class="sr-delete"
              :aria-label="`${r.name} 삭제`"
              :data-testid="`saved-route-delete-${r.id}`"
              @click.stop="onDelete(r)"
            >
              <ion-icon :icon="trashOutline" class="ic-18" />
            </button>
          </li>
        </ul>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import { chevronBackOutline, mapOutline, trashOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { listMyRoutes, deleteRoute, type SavedRouteSummary } from '@/services/route';
import { useToast } from '@/composables/useToast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

const router = useRouter();
const { showInfo, showError } = useToast();

const items = ref<SavedRouteSummary[]>([]);
const loading = ref(false);
const loaded = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listMyRoutes();
  } catch (e) {
    void showError(e instanceof Error ? e.message : '코스를 불러올 수 없어요');
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

function onBack(): void {
  router.back();
}
async function onExplore(): Promise<void> {
  await router.push('/home');
}
async function onOpen(id: number): Promise<void> {
  await router.push({ path: '/route', query: { routeId: String(id) } });
}
async function onDelete(r: SavedRouteSummary): Promise<void> {
  // 삭제 확인은 plain confirm — 디자인 시안에 별도 모달 시안이 없어 native 로 충분.
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (!window.confirm(`"${r.name}" 을(를) 삭제할까요?`)) return;
  }
  try {
    await deleteRoute(r.id);
    items.value = items.value.filter((it) => it.id !== r.id);
    await showInfo('코스를 삭제했어요');
  } catch (e) {
    await showError(e instanceof Error ? e.message : '삭제에 실패했어요');
  }
}

onMounted(load);
</script>

<style scoped>
ion-content.sr-content {
  --background: var(--fr-bg-soft, #f8fafc);
}
.sr-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 8px;
  padding-top: calc(14px + env(safe-area-inset-top));
  background: #ffffff;
  border-bottom: 1px solid var(--fr-line);
}
.sr-top h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--fr-ink);
  letter-spacing: -0.3px;
}
.back {
  width: 36px;
  height: 36px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fr-ink-2);
}

.sr-scroll {
  padding: 12px 16px 80px;
}
.sr-loading,
.sr-empty {
  padding: 80px 0;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.sr-empty-ic {
  color: var(--fr-line);
}
.sr-empty-cta {
  margin-top: 4px;
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--fr-primary);
  color: #ffffff;
  border: 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.sr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sr-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid var(--fr-line);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
}
.sr-thumb {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--fr-bg-muted);
}
.sr-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sr-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-3);
}
.sr-body {
  flex: 1;
  min-width: 0;
}
.sr-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--fr-ink);
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sr-meta {
  margin: 4px 0 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 12px;
  color: var(--fr-ink-3);
}
.sr-meta .sep {
  color: var(--fr-line);
}
.sr-delete {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: #fef2f2;
  border: 0;
  color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
</style>
