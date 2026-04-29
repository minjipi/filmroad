<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <!-- Status bar is the device's; we don't mock it in-app. -->
      <header class="home-head">
        <div class="logo">
          <div class="logo-badge">
            <ion-icon :icon="locationOutline" class="ic-18" />
          </div>
          <span class="logo-name">필름로드</span>
        </div>
        <div class="head-actions">
          <button class="icon-btn" type="button" aria-label="search" @click="onSearch">
            <ion-icon :icon="searchOutline" class="ic-20" />
          </button>
          <button class="icon-btn" type="button" aria-label="notifications">
            <ion-icon :icon="notificationsOutline" class="ic-20" />
            <span class="dot" />
          </button>
        </div>
      </header>

      <div class="home-scroll no-scrollbar">
        <section v-if="hero" class="home-hero">
          <div class="deco" />
          <div class="deco2" />
          <div class="label">{{ hero.monthLabel }} · {{ hero.tag }}</div>
          <h1>{{ hero.title }}</h1>
          <div class="sub">{{ hero.subtitle }}</div>
        </section>
        <section v-else-if="loading" class="home-hero home-hero--skeleton" />

        <nav class="home-tabs">
          <div
            :class="['tab', selectedContentId === null ? 'active' : '']"
            @click="onSelectWork(null)"
          >
            모두
          </div>
          <div
            v-for="w in contents"
            :key="w.id"
            :class="['tab', selectedContentId === w.id ? 'active' : '']"
            @click="onSelectWork(w.id)"
          >
            {{ w.title }}
          </div>
        </nav>

        <div
          v-if="selectedContentId === null"
          class="home-segmented"
          data-testid="home-segmented"
        >
          <span
            :class="['seg', scope === 'NEAR' ? 'active' : '']"
            @click="onSelectScope('NEAR')"
          >내 위치 근처</span>
          <span
            :class="['seg', scope === 'TRENDING' ? 'active' : '']"
            @click="onSelectScope('TRENDING')"
          >전국 트렌드</span>
          <span
            :class="['seg', scope === 'POPULAR_WORKS' ? 'active' : '']"
            data-testid="seg-popular-contents"
            @click="onSelectScope('POPULAR_WORKS')"
          >인기 작품</span>
        </div>

        <!-- 인기 작품 뷰: 작품 카드 grid. POPULAR_WORKS 가 아닌 scope 는
             기존 place grid 그대로. 작품 탭(selectedContentId !== null) 에서는
             segmented 자체가 숨겨지지만, state.scope 는 사용자가 모두 탭에서
             골라둔 값을 그대로 보존한다. 그래서 POPULAR_WORKS 상태로 작품 탭에
             들어와도 contents-grid 가 뜨지 않도록 명시적으로 가드. -->
        <div
          v-if="scope === 'POPULAR_WORKS' && selectedContentId === null"
          class="home-grid contents-grid"
          data-testid="contents-grid"
        >
          <div
            v-for="w in popularContents"
            :key="w.id"
            class="photo-card content-card"
            data-testid="content-card"
            @click="onOpenPopularWork(w.id)"
          >
            <img v-if="w.posterUrl" :src="w.posterUrl" :alt="w.title" />
            <div v-else class="content-initial-bg">
              <span class="content-initial">{{ posterInitial(w.title) }}</span>
            </div>
            <div class="grad" />
            <div class="cap">
              <div class="t">{{ w.title }}</div>
              <div class="loc">
                <ion-icon :icon="locationOutline" class="ic-16" />성지 {{ w.placeCount }}곳
              </div>
            </div>
          </div>
          <p v-if="popularContents.length === 0" class="empty-note">
            인기 작품 데이터가 없어요
          </p>
        </div>

        <template v-else>
          <!-- NEAR 배너 / nearby-empty 는 사용자가 모두 탭에서 NEAR 를 선택해
               geo 가 실패/granted-empty 상태일 때 노출. 작품 탭에선 scope 가
               state 상 NEAR 라도 서버에는 TRENDING 으로 보내고 segmented 도
               숨기므로, 이 NEAR-전용 UI 자체도 모두 탭으로 한정한다. -->
          <div
            v-if="selectedContentId === null && scope === 'NEAR' && geo.status === 'fail' && geo.reason === 'denied'"
            class="geo-banner"
            data-testid="geo-denied-banner"
          >
            <ion-icon :icon="locationOutline" class="ic-20" />
            <div class="txt">
              <b>위치 사용을 허용하면 내 근처 장소를 볼 수 있어요</b>
              <span>주소창 자물쇠 아이콘 → 권한 설정 → 위치 허용</span>
            </div>
          </div>

          <div
            v-else-if="selectedContentId === null && scope === 'NEAR' && geo.status === 'fail' && geo.reason === 'unavailable'"
            class="geo-banner"
            data-testid="geo-unavailable-banner"
          >
            <ion-icon :icon="locationOutline" class="ic-20" />
            <div class="txt">
              <b>위치를 받지 못했어요</b>
              <span>GPS 또는 네트워크 연결을 확인해 주세요</span>
            </div>
            <button
              type="button"
              class="retry"
              data-testid="geo-retry"
              @click="onRetryLocation"
            >다시 시도</button>
          </div>

          <div
            v-else-if="selectedContentId === null && scope === 'NEAR' && geo.status === 'fail' && geo.reason === 'timeout'"
            class="geo-banner"
            data-testid="geo-timeout-banner"
          >
            <ion-icon :icon="locationOutline" class="ic-20" />
            <div class="txt">
              <b>위치 확인이 지연됐어요</b>
              <span>실내에선 오래 걸릴 수 있어요. 잠시 후 다시 시도해 보세요</span>
            </div>
            <button
              type="button"
              class="retry"
              data-testid="geo-retry"
              @click="onRetryLocation"
            >다시 시도</button>
          </div>

          <div class="home-grid">
            <div
              v-for="p in places"
              :key="p.id"
              class="photo-card"
              @click="onOpenDetail(p.id)"
            >
              <img
                v-if="p.coverImageUrls.length > 0"
                :src="p.coverImageUrls[0]"
                :alt="p.name"
              />
              <div class="grad" />
              <div
                :class="['like', p.liked ? 'on' : '']"
                @click.stop="onToggleLike(p.id)"
              >
                <ion-icon :icon="p.liked ? heart : heartOutline" class="ic-16" />
              </div>
              <div class="cap">
                <div class="chip-wrap">
                  <FrChip variant="primary">{{ p.contentTitle }}</FrChip>
                </div>
                <div class="t">{{ p.name }}</div>
                <div class="loc">
                  <ion-icon :icon="locationOutline" class="ic-16" />{{ p.regionLabel }}
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="selectedContentId === null && scope === 'NEAR' && geo.status === 'granted' && places.length === 0"
            class="nearby-empty"
            data-testid="nearby-empty"
          >
            <ion-icon :icon="locationOutline" class="ic-22 empty-ic" />
            <p class="msg">
              반경 <b>{{ radiusKm }}km</b> 이내에 등록된 장소가 없어요
            </p>
            <span class="hint">반경을 넓혀서 다시 찾아볼까요?</span>
            <div class="radius-toggle" data-testid="radius-toggle">
              <button
                v-for="km in radiusOptions"
                :key="km"
                type="button"
                :class="['rt', radiusKm === km ? 'on' : '']"
                @click="onExpandRadius(km)"
              >{{ km }}km</button>
            </div>
          </div>
        </template>
      </div>

      <Teleport to="body">
        <div
          v-if="showPrimingSheet"
          class="geo-prime-backdrop"
          role="dialog"
          aria-label="위치 사용 안내"
          @click.self="onPrimingDismiss"
        >
          <div class="geo-prime-sheet" data-testid="geo-priming-sheet">
            <button
              type="button"
              class="close"
              aria-label="닫기"
              @click="onPrimingDismiss"
            >
              <ion-icon :icon="closeOutline" class="ic-22" />
            </button>
            <div class="hero-ic">
              <ion-icon :icon="locationOutline" class="ic-28" />
            </div>
            <h2>내 위치로 근처 성지를 찾아드려요</h2>
            <p>
              정확한 추천을 위해 위치 정보가 필요해요.<br />
              위치는 전송되지 않고, 근처 장소를 찾는 데만 쓰여요.
            </p>
            <button
              type="button"
              class="primary"
              data-testid="geo-prime-accept"
              @click="onPrimingAccept"
            >위치 허용하기</button>
            <button
              type="button"
              class="ghost"
              data-testid="geo-prime-dismiss"
              @click="onPrimingDismiss"
            >나중에</button>
          </div>
        </div>
      </Teleport>

    </ion-content>
    <FrTabBar :model-value="'home'" />
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  locationOutline,
  searchOutline,
  notificationsOutline,
  closeOutline,
  heart,
  heartOutline,
} from 'ionicons/icons';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useHomeStore, type HomeScope } from '@/stores/home';
import FrChip from '@/components/ui/FrChip.vue';
import FrTabBar from '@/components/layout/FrTabBar.vue';
import { useToast } from '@/composables/useToast';
import {
  requestLocation,
  peekPermission,
  type Coords,
  type LocationFailReason,
} from '@/composables/useGeolocation';

const homeStore = useHomeStore();
const { hero, contents, places, popularContents, loading, error, selectedContentId, scope } =
  storeToRefs(homeStore);
const { showError } = useToast();
const router = useRouter();
const route = useRoute();

// 위치 요청 결과 상태. 'idle' / 'pending' 은 아직 결과가 없는 UI 상태이고,
// 'granted' + coords 나 'fail' + reason 이 확정된 결과를 들고 있다. 실패
// 원인(denied/unavailable/timeout)별로 배너·CTA 가 달라지므로 flat string
// 대신 reason 을 그대로 저장한다.
type GeoState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'granted'; coords: Coords }
  | { status: 'fail'; reason: LocationFailReason };

const geo = ref<GeoState>({ status: 'idle' });

// 반경 토글. NEAR 결과 0개일 때 노출되며, 사용자가 직접 30→50→100 km 로 넓힐 수 있다.
const radiusKm = ref<number>(30);
const radiusOptions: number[] = [30, 50, 100];

// 첫 NEAR 탭 직전에 한번만 띄우는 priming bottom sheet.
const showPrimingSheet = ref(false);
const PRIMED_STORAGE_KEY = 'filmroad.geo-primed';

function hasBeenPrimed(): boolean {
  try {
    return localStorage.getItem(PRIMED_STORAGE_KEY) === 'yes';
  } catch {
    return false;
  }
}

function markPrimed(): void {
  try {
    localStorage.setItem(PRIMED_STORAGE_KEY, 'yes');
  } catch {
    // private mode / Storage 비활성화 — priming 이 매번 뜨는 건 감수.
  }
}

async function onSelectWork(id: number | null): Promise<void> {
  await homeStore.setContent(id);
  if (error.value) await showError(error.value);
  // task #25: 작품 탭 상태를 URL query 에 동기. id=null 이면 query 제거.
  syncQueryFromState();
}

// task #25: scope/selectedContentId 의 라우트 query 동기화 helpers.
// FeedPage 와 동일 패턴 — 새로고침/공유 URL 시 같은 상태로 복원.
const VALID_SCOPES: ReadonlySet<HomeScope> = new Set([
  'NEAR', 'TRENDING', 'POPULAR_WORKS',
]);
function pickQueryScope(): HomeScope | null {
  const raw = route.query.scope;
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : null;
  if (typeof value !== 'string') return null;
  return VALID_SCOPES.has(value as HomeScope) ? (value as HomeScope) : null;
}
function pickQueryWorkId(): number | null {
  const raw = route.query.contentId;
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function syncQueryFromState(): void {
  const next: Record<string, string> = { ...route.query as Record<string, string> };
  if (homeStore.scope === 'NEAR') delete next.scope; else next.scope = homeStore.scope;
  if (homeStore.selectedContentId === null) delete next.contentId; else next.contentId = String(homeStore.selectedContentId);
  // 변경 없으면 push 안 함 — Vue Router 가 noop 처리하지만 명시적 가드.
  const cur = route.query;
  if (cur.scope === next.scope && cur.contentId === next.contentId) return;
  void router.replace({ path: route.path, query: next });
}

// 외부 ?scope=POPULAR_WORKS / ?contentId=3 진입 또는 brower history navigation
// 시 store 상태 catch-up. push 한 본인이 부른 watch 는 store 가 이미 같은
// 값이라 무시되므로 무한 루프 없음.
watch(
  () => [route.query.scope, route.query.contentId] as const,
  (next, prev) => {
    // navigation 으로 query 가 실제로 바뀐 경우만. (Vue Router 가 같은
    // 객체를 재사용하면 watch 가 fire 하지 않지만 안전망.)
    if (JSON.stringify(next) === JSON.stringify(prev)) return;
    const s = pickQueryScope();
    const w = pickQueryWorkId();
    if (s !== null && s !== homeStore.scope) void homeStore.setScope(s);
    // contentId 는 명시적으로 비워질 수도 있음 (?contentId 제거) — 그땐 모두 탭으로.
    // prev 에 값이 있었고 next 에 없으면 의도된 clear 로 해석.
    if (w !== homeStore.selectedContentId) void homeStore.setContent(w);
  },
);

async function loadNearWithRadius(km: number): Promise<void> {
  // 이미 granted 상태로 받아둔 좌표가 있으면 그걸로, 없으면 지금 요청.
  let coords: Coords | null =
    geo.value.status === 'granted' ? geo.value.coords : null;

  if (!coords) {
    geo.value = { status: 'pending' };
    const result = await requestLocation();
    if (result.ok) {
      coords = result.coords;
      geo.value = { status: 'granted', coords: result.coords };
    } else {
      // 차단/비지원/타임아웃 — 원인별로 배너/CTA 가 달라지므로 reason 그대로
      // 저장. 데이터는 기본 센터로 폴백해 화면이 비지 않게 한다.
      geo.value = { status: 'fail', reason: result.reason };
      homeStore.scope = 'NEAR';
      await homeStore.fetchHome();
      return;
    }
  }
  await homeStore.setScope('NEAR', {
    lat: coords.lat,
    lng: coords.lng,
    radiusKm: km,
  });
}

async function onSelectScope(s: HomeScope): Promise<void> {
  if (s === 'NEAR') {
    // 첫 탭이면 priming sheet 를 먼저. 단, 브라우저가 이미 permission 상태를
    // 알고 있으면 (granted/denied) priming 은 무의미하니 스킵하고 바로 흐름을
    // 태운다. peekPermission 이 'unknown' 을 반환하는 구형 브라우저는 안전
    // 쪽으로 기존 priming 유지.
    if (!hasBeenPrimed() && geo.value.status === 'idle') {
      const state = await peekPermission();
      if (state === 'granted' || state === 'denied') {
        markPrimed();
      } else {
        showPrimingSheet.value = true;
        return;
      }
    }
    await loadNearWithRadius(radiusKm.value);
    if (error.value) await showError(error.value);
    syncQueryFromState();
    return;
  }
  await homeStore.setScope(s);
  if (error.value) await showError(error.value);
  syncQueryFromState();
}

async function onRetryLocation(): Promise<void> {
  // timeout / unavailable 케이스에서 "다시 시도" 버튼이 부르는 핸들러.
  // geo 를 idle 로 리셋해 loadNearWithRadius 가 requestLocation 을 다시 호출하게
  // 한다. denied 는 여기서 해소 안 됨 — 사용자가 브라우저 설정에서 권한을 풀어야
  // 하고, 배너 카피가 그걸 안내한다.
  geo.value = { status: 'idle' };
  await loadNearWithRadius(radiusKm.value);
  if (error.value) await showError(error.value);
}

async function onPrimingAccept(): Promise<void> {
  markPrimed();
  showPrimingSheet.value = false;
  await loadNearWithRadius(radiusKm.value);
  if (error.value) await showError(error.value);
}

function onPrimingDismiss(): void {
  // 나중에: primed 플래그만 세우고 스코프는 유지 (TRENDING). 다음번 NEAR 탭
  // 시엔 priming 없이 바로 request() 흐름으로 간다.
  markPrimed();
  showPrimingSheet.value = false;
}

async function onExpandRadius(km: number): Promise<void> {
  radiusKm.value = km;
  await loadNearWithRadius(km);
  if (error.value) await showError(error.value);
}

async function onToggleLike(id: number): Promise<void> {
  await homeStore.toggleLike(id);
  if (error.value) await showError(error.value);
}

async function onOpenDetail(id: number): Promise<void> {
  await router.push(`/place/${id}`);
}

async function onSearch(): Promise<void> {
  await router.push('/search');
}

async function onOpenPopularWork(id: number): Promise<void> {
  // 인기 작품 카드 → 작품 상세 페이지로 이동. 이전 버전은 scope/filter 를
  // 자동 전환해 place grid 를 보여줬지만, UX 피드백에 따라 작품 상세
  // (포스터 + 성지 리스트 + 진행도) 로 직접 유도하는 쪽이 명확해서 전환.
  await router.push(`/content/${id}`);
}

function posterInitial(title: string): string {
  // First Korean syllable / word char. Used when a work ships without a
  // poster image.
  const c = title.trim().charAt(0);
  return c || '?';
}

onMounted(async () => {
  // task #25: URL query 로 첫 진입 시 store 시드 — 새로고침/공유 URL 복원.
  // query 가 비어있으면 store 기본값 / 외부 시드를 그대로 존중. 명시적 query
  // 값(null 이 아닌 값)만 override 한다.
  const seedScope = pickQueryScope();
  const seedWork = pickQueryWorkId();
  if (seedScope !== null && seedScope !== homeStore.scope) homeStore.scope = seedScope;
  if (seedWork !== null && seedWork !== homeStore.selectedContentId) homeStore.selectedContentId = seedWork;
  await homeStore.fetchHome();
  if (error.value) await showError(error.value);
});
</script>

<style scoped>
ion-content {
  --background: #ffffff;
}

.home-head {
  padding: 12px 20px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo { display: flex; align-items: center; gap: 8px; }
.logo-badge {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
  color: #ffffff;
}
.logo-name { font-weight: 900; font-size: 18px; letter-spacing: -0.04em; color: var(--fr-ink); }
.head-actions { display: flex; gap: 4px; }
.icon-btn {
  width: 40px; height: 40px;
  border: none;
  background: var(--fr-bg-muted);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--fr-ink-2);
  position: relative;
  cursor: pointer;
}
.icon-btn .dot {
  position: absolute; top: 9px; right: 9px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--fr-coral);
  border: 2px solid var(--fr-bg-muted);
}

.home-scroll {
  padding-bottom: calc(110px + env(safe-area-inset-bottom));
}

.home-hero {
  margin: 4px 20px 16px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #14BCED 0%, #0ea5d4 100%);
  border-radius: 22px;
  color: #ffffff;
  position: relative;
  overflow: hidden;
}
.home-hero .label {
  font-size: 11px; font-weight: 700; opacity: 0.9;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.home-hero h1 {
  font-size: 22px; font-weight: 800;
  margin: 6px 0 2px;
  letter-spacing: -0.03em; line-height: 1.3;
  white-space: pre-line;
}
.home-hero .sub { font-size: 13px; opacity: 0.9; }
.home-hero .deco {
  position: absolute; right: -18px; top: -18px;
  width: 120px; height: 120px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}
.home-hero .deco2 {
  position: absolute; right: 20px; bottom: -40px;
  width: 80px; height: 80px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}
.home-hero--skeleton {
  min-height: 110px;
  background: linear-gradient(135deg, #cbe8f2 0%, #b8dbe8 100%);
  opacity: 0.6;
}

.home-tabs {
  display: flex; gap: 18px;
  padding: 4px 20px 0;
  border-bottom: 1px solid var(--fr-line);
  margin: 0 0 16px;
  overflow-x: auto;
}
.home-tabs::-webkit-scrollbar { display: none; }
.tab {
  font-weight: 700; font-size: 15px;
  color: var(--fr-ink-4);
  padding: 10px 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.tab.active { color: var(--fr-ink); border-bottom-color: var(--fr-ink); }

.home-segmented {
  display: flex; gap: 16px;
  padding: 0 20px 14px;
}
.seg {
  font-size: 20px; font-weight: 800;
  color: var(--fr-ink-4);
  letter-spacing: -0.03em;
  cursor: pointer;
}
.seg.active { color: var(--fr-ink); }

/* ---------- 인기 작품 grid (task #24 refactor — POPULAR_WORKS scope) ---------- */
/* .home-grid.contents-grid reuses the 2-column grid + .photo-card envelope
   so the work cards match the existing place cards' shape. Only the
   empty-poster fallback needs its own visual. */
.content-initial-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #eef2f6, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
}
.content-initial {
  font-size: 48px;
  font-weight: 800;
  color: var(--fr-ink-3);
  letter-spacing: -0.02em;
}
.contents-grid .empty-note {
  grid-column: 1 / -1;
  padding: 32px 8px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 13px;
}

.home-grid {
  padding: 0 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.photo-card {
  position: relative;
  aspect-ratio: 3 / 4;
  border-radius: 16px;
  overflow: hidden;
  background: #eef2f6;
  cursor: pointer;
}
.photo-card img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.photo-card .grad {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 55%);
}
.photo-card .like {
  position: absolute; top: 10px; right: 10px;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  color: #ffffff;
  cursor: pointer;
}
.photo-card .like.on { color: var(--fr-coral); }
.photo-card .cap {
  position: absolute; left: 12px; right: 12px; bottom: 10px;
  color: #ffffff;
}
.photo-card .cap .chip-wrap { margin-bottom: 6px; display: inline-flex; }
.photo-card .t {
  font-size: 13px; font-weight: 800;
  line-height: 1.25; letter-spacing: -0.02em;
}
.photo-card .loc {
  display: flex; align-items: center; gap: 3px;
  font-size: 10px; opacity: 0.85; margin-top: 3px;
}

/* ---------- 위치 권한 거부 배너 ---------- */
.geo-banner {
  margin: 0 20px 12px;
  padding: 12px 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  color: #9a3412;
}
.geo-banner .txt {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.geo-banner .txt b {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #7c2d12;
}
.geo-banner .txt span {
  font-size: 11.5px;
  color: #9a3412;
  opacity: 0.9;
}
.geo-banner .retry {
  flex-shrink: 0;
  align-self: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: #7c2d12;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.02em;
  border: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.geo-banner .retry:active { opacity: 0.85; }

/* ---------- NEAR 0개 empty state + 반경 토글 ---------- */
.nearby-empty {
  margin: 4px 20px 0;
  padding: 28px 20px;
  border-radius: 16px;
  background: var(--fr-bg-muted);
  text-align: center;
  color: var(--fr-ink-2);
}
.nearby-empty .empty-ic {
  color: var(--fr-ink-4);
}
.nearby-empty .msg {
  margin: 10px 0 4px;
  font-size: 14px;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.nearby-empty .msg b { font-weight: 800; }
.nearby-empty .hint {
  font-size: 12px;
  color: var(--fr-ink-3);
}
.radius-toggle {
  margin-top: 14px;
  display: inline-flex;
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 10px;
  padding: 2px;
  gap: 2px;
}
.radius-toggle .rt {
  padding: 8px 14px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink-3);
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.radius-toggle .rt.on {
  background: var(--fr-ink);
  color: #ffffff;
}
</style>

<!-- Teleport 된 priming sheet 는 scoped 밖에서 스타일링. -->
<style>
.geo-prime-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: geo-fade-in 0.18s ease-out;
}
.geo-prime-sheet {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  padding: 32px 24px calc(24px + env(safe-area-inset-bottom));
  box-shadow: 0 -20px 60px rgba(15, 23, 42, 0.22);
  animation: geo-slide-up 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);
  text-align: center;
  color: var(--fr-ink);
}
.geo-prime-sheet .close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(118, 118, 128, 0.18);
  color: rgba(60, 60, 67, 0.72);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.geo-prime-sheet .hero-ic {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #e6f8fd;
  color: #14BCED;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}
.geo-prime-sheet h2 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0f172a;
}
.geo-prime-sheet p {
  margin: 0 0 20px;
  font-size: 13.5px;
  line-height: 1.55;
  color: #475569;
}
.geo-prime-sheet .primary,
.geo-prime-sheet .ghost {
  display: block;
  width: 100%;
  padding: 14px 0;
  border-radius: 12px;
  border: none;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.geo-prime-sheet .primary {
  background: #14BCED;
  color: #ffffff;
  margin-bottom: 8px;
}
.geo-prime-sheet .primary:active { opacity: 0.88; }
.geo-prime-sheet .ghost {
  background: transparent;
  color: #64748b;
}
.geo-prime-sheet .ghost:active { color: #334155; }

@keyframes geo-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes geo-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
</style>
