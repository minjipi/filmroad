<template>
  <ion-page>
    <ion-content :fullscreen="true" class="pd-content">
      <div v-if="place" class="pd-scroll no-scrollbar">
        <section class="hero">
          <!-- 1:N drama scene carousel — transform 기반 무한 슬라이드.
               외곽은 overflow:hidden 으로 시야창 역할만 하고, 안쪽 .hero-track 이
               translateX 로 좌우 이동한다. 양쪽 끝에 clone 슬라이드를 두어
               (마지막 → 첫번째 wrap 시 오른쪽으로, 첫번째 → 마지막 wrap 시 왼쪽으로)
               항상 진행 방향으로 자연스럽게 흐른다. transitionend 시점에 clone 자리에
               도착했다면 transition 잠깐 끄고 진짜 슬라이드 자리로 instant snap.
               데이터는 `place.scenes` (PlaceSceneDto) — 회차/타임스탬프/설명은
               realHeroSlide 인덱스를 따라가는 chip + section 본문에서 동기화. -->
          <div
            v-if="place.scenes.length > 0"
            ref="heroCarouselEl"
            class="hero-carousel"
            data-testid="pd-hero-carousel"
            @pointerdown="onHeroPointerDown"
            @pointermove="onHeroPointerMove"
            @pointerup="onHeroPointerUp"
            @pointercancel="onHeroPointerUp"
            @dragstart.prevent
          >
            <div
              class="hero-track"
              :class="{
                panning: heroPanning,
                'no-transition': skipHeroTransition,
              }"
              :style="heroTrackStyle"
              @transitionend="onHeroTrackTransitionEnd"
            >
              <!-- clone of last slide (마지막 → 0 으로 오른쪽 wrap 시 prev 자리) -->
              <img
                v-if="place.scenes.length > 1"
                :src="place.scenes[place.scenes.length - 1].imageUrl"
                :alt="`${place.name} 장면 ${place.scenes.length} (clone)`"
                class="hero-img"
                draggable="false"
                aria-hidden="true"
              />
              <!-- 진짜 슬라이드들 -->
              <img
                v-for="(s, i) in place.scenes"
                :key="s.id"
                :src="s.imageUrl"
                :alt="`${place.name} 장면 ${i + 1}`"
                class="hero-img"
                draggable="false"
              />
              <!-- clone of first slide (마지막 + 1 자리, 오른쪽 wrap 시 도착점) -->
              <img
                v-if="place.scenes.length > 1"
                :src="place.scenes[0].imageUrl"
                :alt="`${place.name} 장면 1 (clone)`"
                class="hero-img"
                draggable="false"
                aria-hidden="true"
              />
            </div>
          </div>
          <span
            v-if="place.scenes.length > 1"
            class="hero-counter"
            data-testid="pd-hero-counter"
          >
            {{ realHeroSlide + 1 }} / {{ place.scenes.length }}
          </span>

          <button
            v-if="place.scenes.length > 1"
            type="button"
            class="hero-nav prev"
            data-testid="pd-hero-prev"
            aria-label="이전 장면"
            @click="onHeroPrev"
          >
            <ion-icon :icon="chevronBack" class="ic-22" />
          </button>
          <button
            v-if="place.scenes.length > 1"
            type="button"
            class="hero-nav next"
            data-testid="pd-hero-next"
            aria-label="다음 장면"
            @click="onHeroNext"
          >
            <ion-icon :icon="chevronForward" class="ic-22" />
          </button>
          <div
            v-if="place.scenes.length > 1"
            class="hero-dots"
            data-testid="pd-hero-dots"
            aria-hidden="true"
          >
            <button
              v-for="(_, i) in place.scenes"
              :key="i"
              type="button"
              :class="['hero-dot', i === realHeroSlide ? 'active' : '']"
              :aria-label="`장면 ${i + 1} 보기`"
              @click="onHeroDotClick(i)"
            />
          </div>
          <div class="hero-grad" />
          <div class="hero-top">
            <button class="round-btn" type="button" aria-label="back" @click="onBack">
              <ion-icon :icon="chevronBack" class="ic-22" />
            </button>
          </div>
          <div class="hero-caption">
            <div class="hero-chips">
              <span class="content-chip" @click.stop="onOpenContent">
                <FrChip variant="primary">{{ place.contentTitle }}</FrChip>
              </span>
              <FrChip v-if="episodeLabel" variant="ghost">{{ episodeLabel }}</FrChip>
            </div>
            <h1>{{ place.name }}</h1>
            <div class="loc">
              <ion-icon :icon="locationOutline" class="ic-16" />{{ place.regionLabel }}
            </div>
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
            <p v-if="currentSceneDescription" class="body">{{ currentSceneDescription }}</p>
            <div class="stat-bar">
              <div class="stat-chip">
                <div class="n">{{ formatCount(place.photoCount) }}</div>
                <div class="l">인증샷</div>
              </div>
              <!-- 주변 맛집 chip — 백엔드의 Place.nearby_restaurant_count 는
                   denormalized 컬럼이 갱신되지 않아 stale (0 고정). 같은
                   페이지에서 이미 fetch 한 한국관광공사 tourNearby 응답의
                   .length 를 그대로 사용 — 아래 .k-nearby 섹션과 동일 수치
                   보장. -->
              <div class="stat-chip">
                <div class="n">{{ tourNearbyItems.length }}곳</div>
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

          <!-- 혼잡도 예측 — 한국관광공사 TatsCnctrRateService 기반. 백엔드의
               /api/places/:id/congestion 이 available=true + forecasts 채워줄
               때만 노출. 디자인은 design/pages/03-place-detail.html 의
               '언제 가면 좋을까?' 섹션을 따른다. 카카오 섹션과는 별도 출처
               (한국관광공사) 라 형제 섹션으로 분리. -->
          <section
            v-if="congestion?.available && congestion.forecasts.length > 0"
            class="section crowd-section"
            data-testid="pd-crowd-section"
          >
            <div class="section-head">
              <h2>언제 가면 좋을까?</h2>
              <span
                class="link"
                data-testid="pd-crowd-see-all"
                @click="onSeeAllCongestion"
              >10일 전체 보기</span>
            </div>
            <p class="crowd-sub">{{ congestion.source ?? '한국관광공사' }} 관광지 집중률 · 실시간 예측</p>
            <div class="crowd-chips">
              <div
                v-for="f in congestion.forecasts"
                :key="f.key"
                :class="['crowd-chip', `crowd-tx-${f.state.toLowerCase()}`]"
                :data-testid="`pd-crowd-${f.key.toLowerCase()}`"
              >
                <div class="lbl">
                  {{ f.label }}
                  <span class="sub">· {{ f.dateLabel }}</span>
                </div>
                <div class="row">
                  <span class="pct">
                    {{ f.percent }}<span class="pct-unit">%</span>
                  </span>
                  <span class="state">{{ stateLabel(f.state) }}</span>
                </div>
                <div class="meter">
                  <i
                    :class="`crowd-bg-${f.state.toLowerCase()}`"
                    :style="{ width: `${f.percent}%` }"
                  />
                </div>
              </div>
            </div>
            <!-- 가장 한가한 시점 추천. forecasts 중 percent 최저값을 골라
                 사용자에게 "셋 중 X 가 가장 한가해요" 형태로 안내. -->
            <div
              v-if="congestionHint"
              class="crowd-hint"
              data-testid="pd-crowd-hint"
            >
              <ion-icon :icon="bulbOutline" class="ic-16 hint-ic" />
              <span class="hint-text">
                셋 중 <strong>{{ congestionHint.label }}</strong>이 가장 한가해요 (예상 {{ congestionHint.percent }}%).
              </span>
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
                :data-testid="p.kind === 'photo' ? 'pd-gallery-cell' : undefined"
                @click="p.kind === 'more' ? onOpenGallery() : onOpenShot(p.photo.id)"
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
                <div class="thumb">
                  <img
                    v-if="r.sceneImageUrl"
                    :src="r.sceneImageUrl"
                    :alt="r.name"
                  />
                </div>
                <div class="t">{{ r.name }}</div>
                <div class="s">
                  <template v-if="r.contentEpisode">{{ r.contentEpisode }} · </template>{{ r.regionShort }}
                </div>
              </div>
            </div>
          </section>

          <!-- 카카오맵 정보 — 백엔드 /api/places/:id/kakao-info 가 available=true 일 때만
               렌더한다. 영업시간/리뷰는 카카오 로컬 API 가 안줘서 "카카오맵에서 확인" CTA
               로 대체. 미매핑 place 또는 dev 환경(키 없음)에서는 v-if 로 통째로 숨김. -->
          <section
            v-if="kakaoInfo?.available"
            class="kakao-section"
            data-testid="pd-kakao-section"
          >
            <div class="kakao-head">
              <span class="kakao-badge"><span class="k">K</span>카카오맵</span>
              <span v-if="kakaoInfo.lastSyncedAt" class="sync">
                <ion-icon :icon="refreshOutline" class="ic-16" />{{ syncLabel }}
              </span>
            </div>

            <div v-if="kakaoInfo.kakaoPlaceUrl" class="k-hours">
              <span class="open-chip">
                <ion-icon :icon="ellipse" class="ic-12" style="color:#16a34a;" />카카오맵 정보
              </span>
              <span class="time">영업시간 / 리뷰는 카카오맵에서 확인</span>
            </div>

            <div v-if="kakaoInfo.roadAddress || kakaoInfo.jibunAddress" class="k-info-row">
              <ion-icon :icon="locationOutline" class="ic-20 ico" />
              <div class="txt">
                {{ kakaoInfo.roadAddress ?? kakaoInfo.jibunAddress }}
                <div v-if="kakaoInfo.jibunAddress && kakaoInfo.roadAddress" class="sub">
                  지번 · {{ kakaoInfo.jibunAddress }}
                </div>
              </div>
              <button type="button" class="act" @click="onCopyAddress">복사</button>
            </div>

            <div v-if="kakaoInfo.phone" class="k-info-row">
              <ion-icon :icon="callOutline" class="ic-20 ico" />
              <div class="txt">
                {{ kakaoInfo.phone }}
                <div v-if="kakaoInfo.category" class="sub">{{ kakaoInfo.category }}</div>
              </div>
              <a :href="`tel:${kakaoInfo.phone}`" class="act">전화</a>
            </div>

            <div v-if="kakaoInfo.kakaoPlaceUrl" class="k-info-row">
              <ion-icon :icon="globeOutline" class="ic-20 ico" />
              <div class="txt">카카오맵에서 보기<div class="sub">영업시간 · 리뷰 · 메뉴</div></div>
              <a :href="kakaoInfo.kakaoPlaceUrl" target="_blank" rel="noopener" class="act">열기</a>
            </div>

            <div class="k-actions">
              <button type="button" class="k-act-btn" @click="onKakaoNavigate">
                <ion-icon :icon="navigateOutline" class="ic-22" />길찾기
              </button>
              <button
                type="button"
                class="k-act-btn"
                :class="{ on: isSaved(place.id) }"
                @click="onToggleSave"
              >
                <ion-icon
                  :icon="isSaved(place.id) ? bookmark : bookmarkOutline"
                  class="ic-22"
                />저장
              </button>
              <button type="button" class="k-act-btn" @click="onShare">
                <ion-icon :icon="shareSocialOutline" class="ic-22" />공유
              </button>
              <a
                :href="kakaoInfo.kakaoPlaceUrl ?? '#'"
                target="_blank"
                rel="noopener"
                class="k-act-btn"
              >
                <ion-icon :icon="openOutline" class="ic-22" />카카오맵
              </a>
            </div>

            <!-- task #29: 카카오 nearby → 한국관광공사 TourAPI 기반.
                 빈 응답이면 섹션 자체 미렌더 (별도 안내 텍스트 없음 — 보조
                 정보라 페이지 전체 흐름을 차지하지 않게). -->
            <div v-if="tourNearbyItems.length > 0" class="k-nearby" data-testid="pd-nearby">
              <h4>주변 맛집</h4>
              <div class="k-nearby-row no-scrollbar">
                <a
                  v-for="n in tourNearbyItems"
                  :key="n.contentId"
                  :href="tourNearbyHref(n)"
                  target="_blank"
                  rel="noopener"
                  class="k-nearby-card"
                  data-testid="pd-nearby-card"
                >
                  <div class="th" :class="{ 'th-icon': !n.imageUrl }">
                    <!-- imageUrl 가 빈 문자열인 케이스도 fallback (백엔드는 null 을
                         빈 문자열로 평탄화할 수 있음). -->
                    <img v-if="n.imageUrl" :src="n.imageUrl" :alt="n.title" />
                    <ion-icon v-else :icon="restaurantOutline" class="ic-22" />
                  </div>
                  <div class="nm">{{ n.title }}</div>
                  <div class="d">{{ formatTourNearby(n) }}</div>
                </a>
              </div>
            </div>

            <div class="kakao-foot">카카오맵 정보 제공 · 실시간 동기화</div>
          </section>

          <div class="tail" />
        </div>
      </div>

      <div
        v-else-if="loading"
        class="pd-loading pd-skeleton"
        data-testid="pd-skeleton"
      >
        <ion-skeleton-text :animated="true" class="sk-hero" />
        <div class="sk-body">
          <ion-skeleton-text :animated="true" class="sk-title" />
          <ion-skeleton-text :animated="true" class="sk-sub" />
          <div class="sk-actions">
            <ion-skeleton-text
              v-for="n in 4"
              :key="`sk-act-${n}`"
              :animated="true"
              class="sk-action"
            />
          </div>
          <ion-skeleton-text :animated="true" class="sk-section-h" />
          <ion-skeleton-text :animated="true" class="sk-block" />
          <ion-skeleton-text :animated="true" class="sk-section-h" />
          <ion-skeleton-text :animated="true" class="sk-block" />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { IonPage, IonContent, IonIcon, IonSkeletonText } from '@ionic/vue';
import {
  chevronBack,
  chevronForward,
  shareSocialOutline,
  locationOutline,
  navigateOutline,
  star,
  bookmark,
  bookmarkOutline,
  heart,
  heartOutline,
  cameraOutline,
  refreshOutline,
  ellipse,
  callOutline,
  globeOutline,
  openOutline,
  restaurantOutline,
  bulbOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import FrChip from '@/components/ui/FrChip.vue';
import { usePlaceDetailStore, type PlacePhoto } from '@/stores/placeDetail';
import { useUploadStore } from '@/stores/upload';
import { useMapStore } from '@/stores/map';
import { useSavedStore } from '@/stores/saved';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import {
  useKakaoInfoStore,
} from '@/stores/kakaoInfo';
// task #29: 카카오 nearby → 한국관광공사 TourAPI 기반 신규 store 로 교체.
import { useTourNearbyStore, type TourNearbyRestaurant } from '@/stores/tourNearby';
import { useCongestionStore, type CongestionState } from '@/stores/congestion';
import { useToast } from '@/composables/useToast';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

const props = defineProps<{ id: string | number }>();

const router = useRouter();
const detailStore = usePlaceDetailStore();
const uploadStore = useUploadStore();
const mapStore = useMapStore();
const savedStore = useSavedStore();
const uiStore = useUiStore();
const authStore = useAuthStore();
const kakaoInfoStore = useKakaoInfoStore();
const tourNearbyStore = useTourNearbyStore();
const congestionStore = useCongestionStore();
const { place, photos, related, loading, error } = storeToRefs(detailStore);
const { showError, showInfo } = useToast();

const isLiked = (id: number): boolean => detailStore.isLiked(id);
// Saved state is global (used on Feed / Gallery / Map / Profile too); route
// bookmark reads + writes through the single savedStore so the on/off icon
// stays consistent across pages without manual syncing.
const isSaved = (id: number): boolean => savedStore.isSaved(id);

const placeId = computed(() => Number(props.id));

// 카카오맵 정보 — placeId 별로 캐싱된 응답을 그대로 노출. available=false 또는
// 아직 fetch 전이면 null. 컴포넌트는 v-if="kakaoInfo?.available" 로 섹션 자체를 숨긴다.
const kakaoInfo = computed(() => kakaoInfoStore.infoFor(placeId.value));
// task #29: 한국관광공사 nearby — kakaoInfo 와 별도 채널. items.length === 0
// 이면 섹션 자동 hide.
const tourNearbyItems = computed<TourNearbyRestaurant[]>(() =>
  tourNearbyStore.itemsFor(placeId.value),
);
// 한국관광공사 혼잡도 예측 — null 또는 available=false 면 v-if 로 섹션 hide.
const congestion = computed(() => congestionStore.infoFor(placeId.value));
function stateLabel(s: CongestionState): string {
  if (s === 'PACK') return '매우혼잡';
  if (s === 'BUSY') return '혼잡';
  return '보통';
}
// 추천 hint — forecasts 중 percent 가 가장 낮은 항목을 가장 한가한 시점으로
// 안내. 동률이면 forecasts 배열 순서(오늘→내일→주말)대로 처음 만나는 것.
// forecasts 가 비었을 때는 null 을 반환해 hint 자체가 안 보이게.
const congestionHint = computed<{ label: string; percent: number } | null>(() => {
  const fs = congestion.value?.forecasts ?? [];
  if (fs.length === 0) return null;
  let best = fs[0];
  for (const f of fs) {
    if (f.percent < best.percent) best = f;
  }
  return { label: best.label, percent: best.percent };
});
const syncLabel = computed(() => {
  const at = kakaoInfo.value?.lastSyncedAt;
  if (!at) return '';
  // formatRelativeTime 의 "방금 전"/"5분 전"/... 라더에 "동기화" suffix 를 붙여
  // 의미를 명확히. 1일 이상이면 "어제" 같은 자체 라벨을 그대로 사용한다.
  const rel = formatRelativeTime(at);
  if (!rel) return '';
  if (rel === '방금 전') return '방금 동기화';
  if (rel === '어제') return '어제 동기화';
  return `${rel} 동기화`;
});

// task #29: 한국관광공사 TourAPI 기반 카드 라벨 — 카테고리(있으면) + 도보
// 분(distanceM 기준, 80m/min). 도보 0분은 "1분" 으로 round-up. distanceM 이
// null 이면 카테고리만, 카테고리도 null 이면 "주변 맛집".
function formatTourNearby(n: TourNearbyRestaurant): string {
  const cat = n.categoryName?.trim() || null;
  if (typeof n.distanceM === 'number') {
    const minutes = Math.max(1, Math.round(n.distanceM / 80));
    return cat ? `${cat} · 도보 ${minutes}분` : `도보 ${minutes}분`;
  }
  return cat ?? '주변 맛집';
}

// 한국관광공사 데이터는 사용자-친화 외부 페이지가 따로 없어, 카드 클릭 시
// 카카오맵 검색 결과 페이지로 fallback (기존 사용자 동선과 일관). 이름이
// 비어있는 변종은 클릭 무시 — href="#" 로 두면 페이지 reload 사고.
function tourNearbyHref(n: TourNearbyRestaurant): string {
  const q = n.title.trim();
  if (!q) return 'javascript:void(0)';
  return `https://map.kakao.com/?q=${encodeURIComponent(q)}`;
}

// Hero carousel — transform 기반 무한 슬라이드.
// heroSlide 는 "track 안에서 어느 진짜 슬라이드를 보고 있는가" 를 나타내는
// 카운터지만 modulo 안 해서 순간적으로 -1 (clone-of-last 자리) 또는 len
// (clone-of-first 자리) 까지 갈 수 있다. transitionend 가 발생하면 clone 자리에
// 도달했는지 검사해 instant snap (`skipHeroTransition`=true 한 프레임) 으로
// 진짜 자리로 옮긴다 — 사용자 시각적으론 끊김 없는 무한 회전.
const heroCarouselEl = ref<HTMLElement | null>(null);
const heroSlide = ref(0);
const heroPanning = ref(false);
const skipHeroTransition = ref(false);
const heroDragOffset = ref(0); // 손가락 이동 중 px (음수=오른쪽으로 슬라이드, 양수=왼쪽)

// dot active / counter 가 참조하는 진짜 슬라이드 인덱스. heroSlide 가 -1 또는
// len 같은 transient 값이어도 사용자에게 보이는 "현재 슬라이드" 는 wrap 된
// 정수로 노출.
const realHeroSlide = computed<number>(() => {
  const len = place.value?.scenes.length ?? 0;
  if (len <= 0) return 0;
  return ((heroSlide.value % len) + len) % len;
});

// track 의 transform. clone 슬라이드가 있는 경우 (len>1) 진짜 슬라이드들은
// position [1..len] 에 있으니 offset 1 추가. 단일 씬이면 clone 없으므로
// 평이하게 0.
const heroTrackStyle = computed<Record<string, string>>(() => {
  const len = place.value?.scenes.length ?? 0;
  if (len <= 1) return { transform: 'none' };
  const offset = 1; // prepended clone of last
  if (heroPanning.value) {
    const el = heroCarouselEl.value;
    const width = el?.clientWidth ?? 0;
    const tx = -(heroSlide.value + offset) * width + heroDragOffset.value;
    return { transform: `translate3d(${tx}px, 0, 0)` };
  }
  const tx = -(heroSlide.value + offset) * 100;
  return { transform: `translate3d(${tx}%, 0, 0)` };
});

// transition 이 끝나는 시점에 heroSlide 가 clone 자리에 있다면 진짜 자리로
// instant 점프. browser 한 프레임 동안 transition 을 꺼서 jump 가 보이지
// 않게 하고, 다음 프레임에 다시 켠다.
function onHeroTrackTransitionEnd(e: TransitionEvent): void {
  // transform 트랜지션만 — 다른 속성(예: opacity 같은 건 없지만 안전 장치)에
  // 의해 콜백이 한 번 더 부르지는 걸 막는다.
  if (e.propertyName !== 'transform') return;
  const len = place.value?.scenes.length ?? 0;
  if (len <= 1) return;
  if (heroSlide.value >= len) {
    skipHeroTransition.value = true;
    heroSlide.value = heroSlide.value - len; // 보통 0
    requestAnimationFrame(() => {
      // 두 프레임 후 transition 다시 켜야 jump 가 시각적으로 일어남 — 같은 프레임에
      // 켜면 브라우저가 두 transform 을 묶어서 다시 transition 을 그릴 수 있음.
      requestAnimationFrame(() => {
        skipHeroTransition.value = false;
      });
    });
  } else if (heroSlide.value < 0) {
    skipHeroTransition.value = true;
    heroSlide.value = heroSlide.value + len; // 보통 len-1
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skipHeroTransition.value = false;
      });
    });
  }
}

// dot 클릭은 modulo 거리로 시작점을 맞춰 절대 인덱스에 도달 — 예를 들어
// realSlide=2 (heroSlide=2) 에서 dot 0 을 누르면 heroSlide 0 으로 점프 (왼쪽).
// 단순한 절대 점프라 wrap 방향성 의미는 없다 (한 칸 차이가 아니니까). 원하면
// nearest-direction 으로도 갈 수 있지만 디자인상 dot 점프는 modal-style 직접
// 이동이라 그대로 유지.
function onHeroDotClick(i: number): void {
  heroSlide.value = i;
  startHeroAutoAdvance();
}

// prev/next 는 modulo 없이 그냥 -1/+1. 끝점에 도달하면 heroSlide 가 -1 또는
// len 이 되고, 그 자리에 clone 슬라이드가 있어 transition 이 자연스럽게 흐른다.
// transition 끝에서 onHeroTrackTransitionEnd 가 instant snap 으로 진짜 자리에
// 정렬한다. 결과적으로 어느 방향이든 항상 진행 방향으로 이동.
function onHeroPrev(): void {
  const len = place.value?.scenes.length ?? 0;
  if (len <= 1) return;
  heroSlide.value -= 1;
  startHeroAutoAdvance();
}

function onHeroNext(): void {
  const len = place.value?.scenes.length ?? 0;
  if (len <= 1) return;
  heroSlide.value += 1;
  startHeroAutoAdvance();
}

// --- swipe 처리 -----------------------------------------------------------
// 손가락이 carousel 위에 닿으면 transition 을 잠깐 꺼서 1:1 로 따라가게 하고,
// 떼면 deltaX 가 임계값(viewport 의 15%)을 넘었는지에 따라 다음/이전/제자리로
// snap. touch-action: pan-y 가 CSS 로 걸려있어 수직 페이지 스크롤은 그대로.
const HERO_SWIPE_RATIO = 0.15;
let heroPointerId: number | null = null;
let heroStartX = 0;
let heroStartY = 0;
let heroLockedAxis: 'x' | 'y' | null = null;

function onHeroPointerDown(e: PointerEvent): void {
  if ((place.value?.scenes.length ?? 0) <= 1) return;
  heroPointerId = e.pointerId;
  heroStartX = e.clientX;
  heroStartY = e.clientY;
  heroLockedAxis = null;
  heroDragOffset.value = 0;
  // 마우스가 carousel 영역을 벗어나도 pointerup 까지 계속 받기 위해 capture.
  // 이게 없으면 데스크톱에서 손목 한 번 꺾어 영역 밖으로 가는 순간 드래그가
  // 그대로 멈춰버려 swipe 가 commit 안 된 채 panning=true 로 남는다.
  // jsdom 등 setPointerCapture 가 noop / undefined 인 환경 대비해 try/catch.
  try {
    (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
  } catch {
    /* unsupported in this environment — drag still contents inside the bounds */
  }
  // mousedown 이 일어나는 그 frame 에 native image-drag 가 시작될 수 있어
  // 즉시 차단한다. <img draggable="false"> 와 .hero-img { pointer-events: none }
  // 이 있긴 하지만 일부 브라우저는 mousedown 시점에 이미 ghost 를 띄우려 한다.
  if (typeof e.preventDefault === 'function') e.preventDefault();
  // 자동 전환은 사용자가 만지고 있는 동안 일시 중지. pointerup 에서 재시작.
  stopHeroAutoAdvance();
}

function onHeroPointerMove(e: PointerEvent): void {
  if (heroPointerId !== e.pointerId) return;
  const dx = e.clientX - heroStartX;
  const dy = e.clientY - heroStartY;
  // 첫 5px 이상 움직였을 때 한 번만 축 결정. |dx| > |dy| 면 carousel 이 이벤트
  // 잡고 (panning), 아니면 페이지 세로 스크롤로 양보 (heroLockedAxis='y').
  if (heroLockedAxis === null) {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < 5 && ady < 5) return;
    heroLockedAxis = adx > ady ? 'x' : 'y';
    if (heroLockedAxis === 'x') heroPanning.value = true;
  }
  if (heroLockedAxis !== 'x') return;
  e.preventDefault();
  heroDragOffset.value = dx;
}

function onHeroPointerUp(e: PointerEvent): void {
  if (heroPointerId !== e.pointerId) return;
  heroPointerId = null;
  // pointerdown 에서 잡았던 capture 를 해제 (브라우저는 pointerup 시 자동
  // release 하지만 일부 환경에서 명시적 release 가 안전).
  try {
    (e.currentTarget as Element | null)?.releasePointerCapture?.(e.pointerId);
  } catch {
    /* swallow — capture may not have been set */
  }
  if (heroLockedAxis !== 'x') {
    heroLockedAxis = null;
    return;
  }
  const el = heroCarouselEl.value;
  const width = el?.clientWidth ?? 0;
  const dx = heroDragOffset.value;
  let next = heroSlide.value;
  // 임계값(width 의 15%) 초과면 진행 방향으로 한 칸 이동. heroSlide 는 modulo
  // 안 하므로 끝점에서도 -1 / len 로 흘러가 clone 슬라이드 자리에 도달하고,
  // transitionend 가 진짜 자리로 instant snap.
  if (width > 0 && Math.abs(dx) > width * HERO_SWIPE_RATIO) {
    next = heroSlide.value + (dx < 0 ? 1 : -1);
  }
  // panning 끄기 → transition 다시 켜진다 → snap 위치까지 부드럽게.
  heroPanning.value = false;
  heroDragOffset.value = 0;
  heroSlide.value = next;
  heroLockedAxis = null;
  // swipe 가 한 번 이라도 있었으면 auto-advance 타이머 재가동.
  startHeroAutoAdvance();
}

// 일정 시간마다 다음 사진으로 자동 전환 — Instagram stories / 광고 배너와 같은
// 패턴. 4초 간격, 마지막 슬라이드 다음은 0 으로 wrap. 한 장만 있는 place 는
// 타이머 자체를 안 돌린다(불필요한 setInterval 회피). 탭이 hidden 일 때는
// 정지 → visible 되면 재시작 (백그라운드 타이머가 throttled 되긴 하지만
// 명시적으로 끊는 편이 배터리/CPU 측면에서 깔끔).
const HERO_AUTO_ADVANCE_MS = 4000;
let heroAutoTimer: ReturnType<typeof setInterval> | null = null;

function advanceHeroSlide(): void {
  const len = place.value?.scenes.length ?? 0;
  if (len <= 1) return;
  // 진행 방향은 항상 forward (+1). modulo 없이 두면 마지막에서 한 번 더
  // 증가했을 때 clone-of-first 자리로 흘러 transition 이 오른쪽으로 자연스럽게
  // 이어지고, transitionend 가 instant snap 으로 진짜 첫 슬라이드로 정렬한다.
  heroSlide.value += 1;
}

function startHeroAutoAdvance(): void {
  stopHeroAutoAdvance();
  const len = place.value?.scenes.length ?? 0;
  if (len <= 1) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  heroAutoTimer = setInterval(advanceHeroSlide, HERO_AUTO_ADVANCE_MS);
}

function stopHeroAutoAdvance(): void {
  if (heroAutoTimer !== null) {
    clearInterval(heroAutoTimer);
    heroAutoTimer = null;
  }
}

function onVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  if (document.hidden) stopHeroAutoAdvance();
  else startHeroAutoAdvance();
}

// 회차/타임스탬프/설명은 hero carousel 의 현재 씬(`realHeroSlide` 인덱스)을
// 그대로 따라간다 — hero 가 곧 scene carousel 이므로 별도 인덱스 채널을 두지
// 않고 한 곳에서 일원화. 씬이 없거나 인덱스가 범위를 벗어난 transient 상태(예:
// place 변경 직후 한 프레임)면 null 폴백 → chip + section 본문 빈 라벨.
const currentScene = computed(() => {
  const list = place.value?.scenes ?? [];
  return list[realHeroSlide.value] ?? null;
});

const currentSceneDescription = computed(
  () => currentScene.value?.sceneDescription ?? null,
);

const episodeLabel = computed(() => {
  const s = currentScene.value;
  if (!s) return '';
  const ep = s.contentEpisode ?? '';
  const ts = s.sceneTimestamp ?? '';
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

function onShare(): void {
  const p = place.value;
  if (!p) return;
  uiStore.openShareSheet({
    title: p.name,
    description: `${p.contentTitle} · ${p.regionLabel}`,
    // 첫 번째 cover 이미지를 공유 미리보기로 — 없으면 빈 문자열로 두고 share sheet 측에서 fallback.
    imageUrl: p.coverImageUrls[0] ?? '',
    url: typeof window !== 'undefined' ? window.location.href : `/place/${p.id}`,
  });
}

async function onToggleLike(): Promise<void> {
  if (!place.value) return;
  await detailStore.toggleLike();
  if (error.value) await showError(error.value);
}

async function onToggleSave(): Promise<void> {
  if (!place.value) return;
  const pid = place.value.id;
  // 익명 viewer → 컬렉션 피커 띄우기 전에 로그인 안내. picker 가 컬렉션
  // 목록을 받아 보여줘봐야 그 다음 저장 mutation 이 401 로 깨질 흐름이라,
  // 처음부터 LoginPromptModal 로 유도하는 게 사용자 의도에 부합. (좋아요 버튼
  // 의 useAuthStore() 가드와 동일 패턴.)
  if (!authStore.isAuthenticated) {
    uiStore.showLoginPrompt('저장은 로그인 후 이용할 수 있어요.');
    return;
  }
  // Already saved → one-shot unsave (no picker). Fresh save → open the
  // collection picker so the user can file it (or skip into "기본").
  if (savedStore.isSaved(pid)) {
    await savedStore.toggleSave(pid);
    if (savedStore.error) await showError(savedStore.error);
    return;
  }
  uiStore.openCollectionPicker(pid);
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

// 주소 복사 — roadAddress 우선, 없으면 jibun. clipboard API 가 막혀있는
// (HTTP 페이지 / 권한 거부) 환경에서는 catch 로 떨어져 사용자에게 알린다.
async function onCopyAddress(): Promise<void> {
  const k = kakaoInfo.value;
  if (!k) return;
  const addr = k.roadAddress ?? k.jibunAddress ?? '';
  if (!addr) return;
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      throw new Error('clipboard unavailable');
    }
    await navigator.clipboard.writeText(addr);
    await showInfo('주소를 복사했어요');
  } catch {
    await showError('주소 복사에 실패했어요');
  }
}

// 카카오맵 길찾기 딥링크 — 모바일 앱이 깔려있으면 앱이 catch 하고, 없으면
// 모바일 웹/데스크톱 카카오맵으로 폴백. 이름은 좌표와 함께 보내야 핀이 정확히
// 찍힌다 (이름만 보내면 임의의 동명 장소로 매칭될 수 있음).
function onKakaoNavigate(): void {
  const p = place.value;
  if (!p) return;
  const name = encodeURIComponent(p.name);
  const url = `https://map.kakao.com/link/to/${name},${p.latitude},${p.longitude}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
  }
}

async function onCapture(): Promise<void> {
  const p = place.value;
  if (!p) return;
  // CaptureTarget 은 평면 사양 — primary 씬(0번)을 폴백으로 채운다. 씬이 하나도
  // 없으면 null 두 개. 사용자가 carousel 로 다른 씬을 보고 있더라도 채점/비교 기준은
  // primary 로 통일(backend ShotScoringService 기준과 일치).
  const primary = p.scenes[0] ?? null;
  uploadStore.beginCapture({
    placeId: p.id,
    contentId: p.contentId,
    contentTitle: p.contentTitle,
    contentEpisode: primary?.contentEpisode ?? null,
    placeName: p.name,
    sceneImageUrl: primary?.imageUrl ?? null,
  });
  await router.push('/camera');
}

async function onOpenGallery(): Promise<void> {
  if (!place.value) return;
  await router.push(`/feed/detail?placeId=${place.value.id}`);
}

// 디자인의 "10일 전체 보기" 링크는 별도 03b-congestion.html 화면을 가리키지만
// frontend 에는 아직 해당 페이지가 없어서 stub 토스트로 노출만 가시화.
async function onSeeAllCongestion(): Promise<void> {
  await showInfo('10일 예측 보기는 곧 공개됩니다');
}

// 갤러리 셀(개별 인증샷) 클릭 → `/feed/detail?placeId=...&shotId=...` (task #23 통합).
// place 컨텍스트(이 장소의 photos 만 무한스크롤) + 클릭한 shot 으로 anchor 스크롤.
// shotId 단독으로 넘기면 전체 feed 컨텍스트가 되어 사용자가 "이 장소 다른 사진"
// 으로 자연스럽게 이어보지 못하니 placeId 도 함께 전달.
async function onOpenShot(photoId: number): Promise<void> {
  if (!place.value) return;
  await router.push(`/feed/detail?placeId=${place.value.id}&shotId=${photoId}`);
}

async function onOpenContent(): Promise<void> {
  if (!place.value) return;
  await router.push(`/content/${place.value.contentId}`);
}

async function onOpenRelated(id: number): Promise<void> {
  await router.push(`/place/${id}`);
}

async function load(id: number): Promise<void> {
  // 카카오 정보 + task #29: 한국관광공사 nearby + 혼잡도 예측 — 모두 메인
  // place fetch 와 병렬. 보조 정보라 실패/지연이 place 본문 렌더를 막지
  // 않게 한다. 각 fetch 안에서 자체 try/catch 로 swallow.
  void kakaoInfoStore.fetch(id);
  void tourNearbyStore.fetch(id);
  void congestionStore.fetch(id);
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
      contentId: p.contentId,
      contentTitle: p.contentTitle,
      // 지도 시트는 평면 contentEpisode 사양 — primary 씬(0번)을 폴백으로 사용.
      contentEpisode: p.scenes[0]?.contentEpisode ?? null,
      coverImageUrls: p.coverImageUrls,
      sceneImageUrl: p.scenes[0]?.imageUrl ?? null,
      photoCount: p.photoCount,
      likeCount: p.likeCount,
      rating: p.rating,
      distanceKm: p.distanceKm,
      liked: p.liked,
    });
  }
}

onMounted(() => {
  void load(placeId.value);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
});

onUnmounted(() => {
  stopHeroAutoAdvance();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
  // 페이지를 떠날 때 store 비움 — 다음 진입 시 직전 place 의 hero/photos/
  // related 가 fetch 끝나기 전까지 잔류하지 않도록.
  detailStore.reset();
});

watch(placeId, (next, prev) => {
  if (next !== prev) {
    // /place/A → /place/B 처럼 같은 컴포넌트 인스턴스 안에서 id 만 바뀌는
    // 흐름. fetch 직전에 store 비워서 직전 place 데이터가 새 fetch 응답
    // 도착 전까지 보이지 않게. (fetch 가 loading=true 를 set 하므로 skeleton
    // 으로 자연스럽게 fallback.)
    detailStore.reset();
    void load(next);
    // 다른 place 로 이동할 때 hero carousel 위치/인덱스를 초기화 — 이전 place 에서
    // 끝 슬라이드까지 넘긴 상태(예: heroSlide=3 등)가 그대로 남아있으면 새 place
    // 첫 진입 시 transform 이 -300% 같은 위치로 점프한다. transition 도 한 프레임
    // 끄고 0 으로 보내서 reset 자체가 슬라이드 애니메이션으로 잘못 보이지 않게.
    skipHeroTransition.value = true;
    heroSlide.value = 0;
    heroDragOffset.value = 0;
    // realHeroSlide(=heroSlide modulo) 가 0 으로 떨어지므로 currentScene 도 자동
    // 으로 새 place 의 0번 씬을 가리킨다 — 별도 인덱스 reset 불필요.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skipHeroTransition.value = false;
      });
    });
  }
});

// scenes 가 셋업되거나(load 완료) 길이가 바뀔 때 자동 전환을 켜고/끈다.
// 한 장 → 한 장이면 그냥 정지 상태 유지, 한 장 → 여러 장이면 시작.
// place 가 null → populated 로 바뀌는 첫 fetch 도 이 watch 에서 함께 처리.
watch(
  () => place.value?.scenes.length ?? 0,
  (len) => {
    if (len > 1) startHeroAutoAdvance();
    else stopHeroAutoAdvance();
  },
  { immediate: true },
);
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
/* 가로 슬라이드 carousel — 외곽은 시야창(overflow:hidden) 역할.
   touch-action: pan-y 로 두면 세로 스크롤은 페이지(.pd-scroll)에 양보하고
   가로 swipe 만 컴포넌트가 직접 처리(pointer events).
   cursor: grab → 데스크톱 사용자에게 "여기 드래그 가능" 시각적 신호. */
.hero-carousel {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  cursor: grab;
}
.hero-carousel:active {
  cursor: grabbing;
}
/* 트랙은 flex 로 슬라이드를 일렬로 깔고 transform 으로 이동. transition 은
   .panning 클래스가 있을 때 (사용자 손가락 추적 중) 끄고, 평소에는 0.4s
   ease-out cubic 으로 부드럽게. translate3d 는 GPU 가속 hint. */
.hero-track {
  position: absolute;
  inset: 0;
  display: flex;
  will-change: transform;
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.hero-track.panning,
.hero-track.no-transition {
  transition: none;
}
.hero-img {
  flex: 0 0 100%;
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  /* hero-track 이 마우스/터치를 받게 두고, 이미지 자체는 native drag 도 막는다
     (Chrome/Safari 의 경우 draggable="false" 만으로는 한 frame 동안 ghost 가
     나타나는 케이스가 있어 user-drag 도 함께 차단). */
  pointer-events: none;
  -webkit-user-drag: none;
  user-drag: none;
}
.hero-dots {
  position: absolute;
  left: 0; right: 0;
  bottom: 18px;
  display: flex;
  justify-content: center;
  gap: 6px;
  z-index: 6;
}
/* dot 자체는 button — 탭하면 해당 슬라이드로 scroll. button 기본 스타일은 reset.
   .active 슬라이드는 흰색 + 가로로 늘려서 페이지 인디케이터 처럼 표시. */
.hero-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  transition: width 160ms ease, background 160ms ease;
}
.hero-dot.active {
  width: 18px;
  border-radius: 3px;
  background: #ffffff;
}
/* 좌/우 화살표 — 데스크톱/마우스 사용자가 swipe 없이 넘기는 표준 carousel 어포던스.
   모바일에서도 탭 가능. 한 장만 있을 때는 v-if 로 숨김. round-btn 톤(반투명 검정 +
   흰 아이콘)으로 hero 의 다른 round 버튼들과 시각 통일. */
.hero-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 6;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(6px);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  padding: 0;
  transition: background 160ms ease;
}
.hero-nav:hover { background: rgba(0, 0, 0, 0.55); }
.hero-nav:active { background: rgba(0, 0, 0, 0.7); }
.hero-nav.prev { left: 12px; }
.hero-nav.next { right: 12px; }

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
.content-chip { cursor: pointer; }
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
.pd-skeleton {
  background: #ffffff;
  overflow-y: auto;
}
.pd-skeleton .sk-hero {
  width: 100%;
  height: 440px;
  margin: 0;
  border-radius: 0;
}
.pd-skeleton .sk-body {
  padding: 18px 20px;
}
.pd-skeleton .sk-title {
  width: 60%;
  height: 22px;
  margin: 0 0 8px;
  border-radius: 6px;
}
.pd-skeleton .sk-sub {
  width: 35%;
  height: 13px;
  margin: 0 0 18px;
  border-radius: 4px;
}
.pd-skeleton .sk-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}
.pd-skeleton .sk-action {
  flex: 1;
  height: 44px;
  margin: 0;
  border-radius: 12px;
}
.pd-skeleton .sk-section-h {
  width: 40%;
  height: 16px;
  margin: 18px 0 12px;
  border-radius: 4px;
}
.pd-skeleton .sk-block {
  width: 100%;
  height: 120px;
  margin: 0;
  border-radius: 12px;
}

/* ----- 카카오맵 정보 섹션 -----
   design/pages/02-map.html 의 .kakao-section 톤을 그대로 옮겨오되, 다른 .section
   들과 시각 일관(상단 border + 동일 padding) 을 위해 padding-top 을 통일.
   브랜드 컬러(노란 배지 #FEE500)는 카카오 가이드라인 그대로 유지. */
.kakao-section {
  padding: 22px 0;
  border-top: 1px solid var(--fr-line);
}
.kakao-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.kakao-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #fee500;
  color: #3c1e1e;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.kakao-badge .k {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3c1e1e;
  color: #fee500;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 10px;
}
.kakao-head .sync {
  margin-left: auto;
  font-size: 11px;
  color: var(--fr-ink-4);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.k-hours {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}
.k-hours .open-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: #dcfce7;
  color: #166534;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
}
.k-hours .time {
  color: var(--fr-ink-2);
  font-weight: 600;
}

.k-info-row {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--fr-line-soft);
  align-items: flex-start;
  font-size: 13px;
}
.k-info-row .ico {
  flex-shrink: 0;
  width: 20px;
  color: var(--fr-ink-3);
  padding-top: 1px;
}
.k-info-row .txt {
  flex: 1;
  color: var(--fr-ink);
  line-height: 1.5;
}
.k-info-row .txt .sub {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}
.k-info-row .act {
  font-size: 11.5px;
  color: var(--fr-primary);
  font-weight: 700;
  padding: 4px 8px;
  background: var(--fr-primary-soft);
  border-radius: 7px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.k-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 14px 0 18px;
}
.k-act-btn {
  background: var(--fr-bg-muted);
  border: none;
  border-radius: 12px;
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--fr-ink);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}
.k-act-btn ion-icon {
  color: var(--fr-primary);
}
.k-act-btn.on {
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
}

.k-nearby {
  padding: 14px 0;
  border-top: 1px solid var(--fr-line-soft);
}
.k-nearby h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 800;
}
.k-nearby-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin: 0 -20px;
  padding: 0 20px;
}
.k-nearby-card {
  flex-shrink: 0;
  width: 140px;
  text-decoration: none;
  color: inherit;
}
.k-nearby-card .th {
  width: 100%;
  height: 90px;
  border-radius: 10px;
  background: #eef2f6;
  overflow: hidden;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-3);
}
.k-nearby-card .nm {
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink);
}
.k-nearby-card .d {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

.kakao-foot {
  margin-top: 14px;
  font-size: 11px;
  color: var(--fr-ink-4);
  text-align: center;
}

/* ---------- 혼잡도 예측 (한국관광공사 TatsCnctrRateService) ----------
   .section 클래스를 그대로 재사용해 페이지 다른 섹션 (이 장면, 방문객 인증샷,
   비슷한 장소) 과 동일한 padding/구분선 톤을 가져간다. .section-head 도
   같이 차용 — h2 + 우측 link 의 위계가 이미 이 페이지에서 표준화돼 있음. */
.crowd-section .section-head {
  margin-bottom: 4px;
  align-items: baseline;
}
.crowd-sub {
  margin: 0 0 12px;
  font-size: 11.5px;
  color: var(--fr-ink-3);
}
.crowd-chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.crowd-chip {
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  padding: 10px 11px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.crowd-chip .lbl {
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
  display: flex;
  align-items: baseline;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.crowd-chip .lbl .sub {
  font-size: 10px;
  font-weight: 600;
  color: var(--fr-ink-4);
  opacity: 0.85;
}
.crowd-chip .row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  margin-top: 2px;
}
.crowd-chip .pct {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
}
.crowd-chip .pct-unit {
  font-size: 10px;
  font-weight: 700;
  margin-left: 1px;
  opacity: 0.7;
}
.crowd-chip .state {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: -0.01em;
}
.crowd-chip .meter {
  margin-top: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--fr-bg-muted);
  overflow: hidden;
}
.crowd-chip .meter > i {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

/* 상태별 텍스트(state, pct) 색상 */
.crowd-tx-ok .pct,
.crowd-tx-ok .state {
  color: #16a34a;
}
.crowd-tx-busy .pct,
.crowd-tx-busy .state {
  color: #f59e0b;
}
.crowd-tx-pack .pct,
.crowd-tx-pack .state {
  color: #ef4444;
}

/* 상태별 meter 바 색상 */
.crowd-bg-ok {
  background: linear-gradient(90deg, #4ade80, #16a34a);
}
.crowd-bg-busy {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
}
.crowd-bg-pack {
  background: linear-gradient(90deg, #f87171, #ef4444);
}

/* 가장 한가한 시점 추천 hint 박스 */
.crowd-hint {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fr-ink-2);
}
.crowd-hint .hint-ic {
  color: var(--fr-amber, #f59e0b);
  flex-shrink: 0;
}
.crowd-hint .hint-text {
  line-height: 1.4;
}
.crowd-hint .hint-text strong {
  font-weight: 800;
  color: var(--fr-ink);
}
</style>
