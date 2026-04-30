<template>
  <ion-page>
    <ion-content :fullscreen="true" class="up-content" :class="`up-stage-${stage}`">
      <!-- ============== Stage 0: Compose form ============== -->
      <template v-if="stage === 'compose'">
      <header class="top">
        <span class="cancel" @click="onCancel">취소</span>
        <h1>인증샷 올리기</h1>
        <button
          class="post"
          :class="{ 'post-disabled': !canShare }"
          type="button"
          :aria-disabled="!canShare"
          data-testid="upload-share-btn"
          @click="onShareClick"
        >
          {{ loading ? `공유 중 ${uploadProgress}%` : '공유하기' }}
        </button>
      </header>
      <div v-if="loading" class="upload-progress" data-testid="upload-progress">
        <div class="upload-progress-fill" :style="{ width: uploadProgress + '%' }" />
      </div>

      <!-- Offline banner — rendered whenever navigator.onLine is false.
           Pairs with the disabled "공유하기" button so the user has a clear
           explanation rather than a silently-inactive CTA. -->
      <div
        v-if="!online"
        class="upload-offline"
        role="status"
        data-testid="upload-offline-banner"
      >
        <ion-icon :icon="cloudOfflineOutline" class="ic-18" />
        <span>인터넷 연결을 확인해 주세요</span>
      </div>

      <!-- Persistent error banner with a retry button. Only rendered when
           a prior submit failed — the toast dismisses quickly, but users on
           flaky networks need a visible affordance to tap again. -->
      <div
        v-if="!loading && errorText"
        class="upload-error"
        role="alert"
        data-testid="upload-error-banner"
      >
        <div class="err-text">{{ errorText }}</div>
        <button
          type="button"
          class="err-retry"
          data-testid="upload-retry"
          @click="onRetry"
        >
          재시도
        </button>
      </div>

      <div class="up-scroll no-scrollbar">
        <div v-if="selectedPhoto" class="preview-wrap">
          <div class="preview">
            <img :src="selectedPhoto" alt="preview" />
            <div v-if="targetPlace" class="sticker-label">
              <ion-icon :icon="sparklesOutline" class="ic-16" />장면 비교 ON
            </div>
            <div v-if="targetPlace" class="frame-sticker">
              <div class="ico"><ion-icon :icon="filmOutline" class="ic-18" /></div>
              <div>
                <div class="t">
                  {{ targetPlace.contentTitle }}<span v-if="targetPlace.contentEpisode"> · {{ targetPlace.contentEpisode }}</span>
                </div>
                <div class="s">{{ targetPlace.placeName }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="thumbs no-scrollbar">
          <div
            v-for="(p, i) in photos"
            :key="i"
            :class="['t', i === selectedIndex ? 'sel' : '']"
            @click="onSelectThumb(i)"
          >
            <img :src="p" :alt="`thumb-${i}`" />
          </div>
          <label v-if="canAddMore" class="plus" data-testid="add-photo-btn">
            <ion-icon :icon="addOutline" class="ic-22" />
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              class="file-input"
              @change="onFilePick"
            />
          </label>
        </div>

        <div class="fields">
          <div class="field">
            <textarea
              class="caption"
              placeholder="이 장면에 대한 이야기를 들려주세요..."
              :value="caption"
              @input="onCaptionInput"
            />
            <div class="tags" data-testid="upload-tags">
              <span v-for="(t, i) in tags" :key="t" class="tag">
                #{{ t }}
                <button
                  type="button"
                  class="tag-x"
                  :aria-label="`태그 ${t} 삭제`"
                  data-testid="upload-tag-remove"
                  @click="onRemoveTag(i)"
                >×</button>
              </span>
              <input
                v-if="tags.length < MAX_TAGS"
                v-model="tagDraft"
                type="text"
                class="tag-input"
                :placeholder="tags.length === 0 ? '+ 태그 추가' : '태그 추가'"
                :maxlength="MAX_TAG_LEN + 2"
                data-testid="upload-tag-input"
                @keydown="onTagKeydown"
                @blur="onTagBlur"
              />
            </div>
          </div>

          <template v-if="targetPlace">
            <div class="field row-field">
              <div class="ico"><ion-icon :icon="filmOutline" class="ic-20" /></div>
              <div>
                <div class="k">작품</div>
                <div class="v">
                  {{ targetPlace.contentTitle }}<span v-if="targetPlace.contentEpisode"> · {{ targetPlace.contentEpisode }}</span>
                </div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
            </div>

            <div class="field row-field" data-testid="target-place-row" @click="onOpenPicker">
              <div class="ico"><ion-icon :icon="locationOutline" class="ic-20" /></div>
              <div class="grow">
                <div class="k">위치</div>
                <div class="v">{{ targetPlace.placeName }}</div>
              </div>
              <span class="change-link">변경</span>
            </div>
          </template>

          <!-- No place attached yet (bottom-nav camera CTA entry). Show a
               single CTA that opens the picker; "공유하기" stays disabled
               until the user picks something. -->
          <button
            v-else
            class="field row-field place-cta"
            type="button"
            data-testid="pick-place-cta"
            @click="onOpenPicker"
          >
            <div class="ico"><ion-icon :icon="locationOutline" class="ic-20" /></div>
            <div class="grow">
              <div class="k">장소</div>
              <div class="v missing">장소를 선택해 주세요</div>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="ic-20 chev" />
          </button>

          <!--
            "한 번 정하면 거의 안 바꾸는" 옵션(스탬프북 / 공개 범위)은 기본
            접힘. caption → 작품 → 위치 가 1차 작성 흐름이고, 나머지는 의식적
            으로 만질 때만 펼치게 한다 (Instagram 패턴 — TikTok 의 "더보기",
            Threads 의 "..." 메뉴와 같은 부류). 토글은 배지 행이라 data row
            들과는 다른 시각 무게로 노출.
          -->
          <button
            type="button"
            class="advanced-toggle"
            data-testid="advanced-toggle"
            :aria-expanded="advancedOpen"
            @click="advancedOpen = !advancedOpen"
          >
            <span>고급 설정</span>
            <ion-icon
              :icon="advancedOpen ? chevronUp : chevronDown"
              class="ic-18"
            />
          </button>

          <template v-if="advancedOpen">
            <div class="field row-field">
              <div class="ico stampbook"><ion-icon :icon="ribbonOutline" class="ic-20" /></div>
              <div class="grow">
                <div class="k">스탬프북에 추가</div>
                <div class="v">{{ addToStampbook ? '수집 대상' : '추가 안 함' }}</div>
              </div>
              <button
                class="toggle"
                :class="{ off: !addToStampbook }"
                type="button"
                aria-label="stampbook"
                @click="onToggleStampbook"
              />
            </div>

            <!--
              공개 범위는 두 개뿐(전체공개 / 비공개)이라 토글보다 양쪽 옵션이
              항상 보이는 segmented control 이 명확. 트위터 audience 선택,
              카카오톡 대화상대 공개범위 등 이 패턴을 따른다. role=radiogroup
              으로 a11y 도 정렬.
            -->
            <div class="field row-field vis-field">
              <div class="ico visibility"><ion-icon :icon="globeOutline" class="ic-20" /></div>
              <div class="grow">
                <div class="k">공개 범위</div>
                <div
                  class="vis-segmented"
                  role="radiogroup"
                  aria-label="공개 범위"
                  data-testid="visibility-segmented"
                >
                  <button
                    type="button"
                    class="vis-seg"
                    :class="{ on: visibility === 'PUBLIC' }"
                    role="radio"
                    :aria-checked="visibility === 'PUBLIC'"
                    data-testid="visibility-public"
                    @click="onSetVisibility('PUBLIC')"
                  >전체 공개</button>
                  <button
                    type="button"
                    class="vis-seg"
                    :class="{ on: visibility === 'PRIVATE' }"
                    role="radio"
                    :aria-checked="visibility === 'PRIVATE'"
                    data-testid="visibility-private"
                    @click="onSetVisibility('PRIVATE')"
                  >비공개</button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Place picker sheet. Backdrop-only dismiss; the list is a client-
           side filter over home places (recent/popular) — no dedicated
           search API yet, see task #15 brief. -->
      <div
        v-if="pickerOpen"
        class="picker-backdrop"
        data-testid="picker-backdrop"
        @click.self="onClosePicker"
      >
        <div class="picker-sheet" role="dialog" aria-label="장소 선택">
          <header class="picker-head">
            <h2>장소 선택</h2>
            <button type="button" aria-label="닫기" class="picker-close" @click="onClosePicker">
              <ion-icon :icon="closeOutline" class="ic-20" />
            </button>
          </header>

          <div class="picker-search">
            <ion-icon :icon="searchOutline" class="ic-18 search-ic" />
            <input
              v-model="pickerQuery"
              type="search"
              enterkeyhint="search"
              placeholder="촬영지나 작품을 검색해 보세요"
            />
          </div>

          <div class="picker-list no-scrollbar">
            <button
              v-for="p in pickerResults"
              :key="p.id"
              type="button"
              class="picker-item"
              data-testid="picker-item"
              @click="onPickPlace(p)"
            >
              <div class="thumb">
                <img
                  v-if="p.sceneImageUrl"
                  :src="p.sceneImageUrl"
                  :alt="p.name"
                />
              </div>
              <div class="meta">
                <div class="t">{{ p.name }}</div>
                <div class="s">{{ p.contentTitle }} · {{ p.regionLabel }}</div>
              </div>
            </button>
            <div v-if="pickerResults.length === 0" class="picker-empty">
              <span v-if="pickerQuery.trim()">검색 결과가 없어요</span>
              <span v-else>홈에서 장소를 더 둘러본 뒤 다시 시도해 주세요</span>
            </div>
          </div>
        </div>
      </div>
      </template>
      <!-- ============== /Stage 0 ============== -->

      <!-- ============== Stage A & B: 채점 / 인증 완료 ============== -->
      <template v-else>
        <div class="rw-bg" aria-hidden="true">
          <div
            v-for="c in confettiDots"
            :key="c.key"
            class="confetti"
            :style="c.style"
          />
        </div>

        <div
          class="rw-page-content no-scrollbar"
          data-testid="upload-completion"
        >
          <!-- Stage A: 채점 카운트업 (check-wrap 위치) -->
          <div
            v-if="stage === 'scoring'"
            class="check-wrap scoring-wrap"
            data-testid="upload-stage-scoring"
          >
            <ScoreRevealOverlay
              :loading="scoreLoading"
              :total-score="scoreTotal"
              :similarity-score="scoreSimilarity"
              :gps-score="scoreGps"
              @count-up-complete="onCountUpComplete"
            />
          </div>

          <!-- Stage B header (인증 완료 타이틀 + sub) -->
          <template v-if="stage === 'authenticated'">
            <div class="check-wrap" data-testid="upload-stage-authenticated">
              <div class="check-ring">
                <ion-icon :icon="checkmark" class="check-ic" />
              </div>
            </div>

            <h1 class="rw-title">인증 완료!</h1>
            <p class="rw-sub" data-testid="completion-place-name">
              <span class="bold-k">'{{ completionPlaceName }}'</span> 성지를<br />성공적으로 수집하셨어요 ✨
            </p>
          </template>

          <!-- Common to scoring + authenticated (task #10): stamp-card and
               rewards stay on screen across both stages once the response has
               landed, so the user has more to look at while the count-up
               plays out. Auto-hide individually when the field is missing. -->
          <section
            v-if="showCompletionExtras && completionStamp"
            class="stamp-card"
            data-testid="completion-stamp-card"
          >
            <div class="stamp-top">
              <div class="stamp-badge">
                <ion-icon :icon="filmOutline" class="ic-22" />
                <span class="num">{{ completionStamp.collectedCount }}</span>
              </div>
              <div class="stamp-info">
                <div class="t">{{ completionStamp.contentTitle }} 스탬프북</div>
                <div class="s">{{ completionStamp.collectedCount }} / {{ completionStamp.totalCount }} 성지 수집</div>
              </div>
            </div>
            <div class="progress">
              <span class="p-t">컬렉션 진행률</span>
              <span class="p-v">{{ completionStamp.percent }}%</span>
            </div>
            <div class="bar">
              <div class="fill" :style="{ width: `${completionStamp.percent}%` }" />
            </div>
            <div v-if="nextMilestoneCount > 0" class="next-milestone">
              다음 <b>{{ nextMilestoneCount }}곳</b> 모으면 <b>{{ completionStamp.contentTitle }} 완주</b>!
            </div>
          </section>

          <section
            v-if="showCompletionExtras && completionReward"
            class="rewards"
            data-testid="completion-rewards"
          >
            <div class="reward" data-testid="completion-score">
              <div class="ico ico-violet"><ion-icon :icon="sparklesOutline" class="ic-20" /></div>
              <div class="n">{{ scoreTotal ?? 0 }}점</div>
              <div class="l">인증 점수</div>
            </div>
            <div class="reward">
              <div class="ico ico-amber"><ion-icon :icon="star" class="ic-20" /></div>
              <div class="n">+{{ completionReward.pointsEarned }}</div>
              <div class="l">성지 포인트</div>
            </div>
            <div class="reward">
              <div class="ico ico-primary"><ion-icon :icon="flameOutline" class="ic-20" /></div>
              <div class="n">{{ completionReward.streakDays }}일</div>
              <div class="l">연속 인증</div>
            </div>
            <div class="reward">
              <div class="ico ico-mint"><ion-icon :icon="trendingUpOutline" class="ic-20" /></div>
              <div class="n">LV.{{ completionReward.level }}</div>
              <div class="l">{{ completionReward.levelName }}</div>
            </div>
          </section>

          <!-- Stage B trailing: new-badges and action buttons remain
               authenticated-only — the user shouldn't be able to "go home"
               while the count-up is still running. -->
          <template v-if="stage === 'authenticated'">
            <section
              v-if="completionReward && completionReward.newBadges.length > 0"
              class="new-badges"
            >
              <h3>새 뱃지!</h3>
              <div class="nb-list">
                <div
                  v-for="b in completionReward.newBadges"
                  :key="b.badgeId"
                  class="nb-card"
                >
                  <div
                    class="nb-circle"
                    :style="b.gradient ? { background: b.gradient } : undefined"
                  >
                    <ion-icon :icon="sparklesOutline" class="ic-24" />
                  </div>
                  <div class="nb-t">{{ b.name }}</div>
                  <div v-if="b.description" class="nb-s">{{ b.description }}</div>
                </div>
              </div>
            </section>

            <div class="rw-actions">
              <button
                class="fr-btn primary"
                type="button"
                data-testid="upload-boast"
                @click="onBoast"
              >
                <ion-icon :icon="shareSocialOutline" class="ic-20" />친구에게 자랑하기
              </button>
              <button
                class="link"
                type="button"
                data-testid="upload-go-home"
                @click="onGoHome"
              >
                이 성지 인증샷 보기
              </button>
            </div>
          </template>
        </div>
      </template>
      <!-- ============== /Stage A & B ============== -->

      <!-- 레벨 업 — 인증완료 연출과 분리된 별도 오버레이로 띄운다. -->
      <LevelUpOverlay
        v-if="completionReward"
        :open="levelUpOpen"
        :level="completionReward.level"
        :previous-level="completionReward.previousLevel"
        :level-name="completionReward.levelName"
        @close="onLevelUpClose"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { IonPage, IonContent, IonIcon } from '@ionic/vue';
import {
  sparklesOutline,
  filmOutline,
  locationOutline,
  ribbonOutline,
  globeOutline,
  chevronForwardOutline,
  chevronDown,
  chevronUp,
  addOutline,
  closeOutline,
  searchOutline,
  cloudOfflineOutline,
  // Stage B (인증 완료 / 06-reward) icons.
  checkmark,
  star,
  flameOutline,
  trendingUpOutline,
  shareSocialOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { MAX_PHOTOS_PER_POST, useUploadStore } from '@/stores/upload';
import { useHomeStore, type PlaceSummary } from '@/stores/home';
import { useUiStore } from '@/stores/ui';
import { useToast } from '@/composables/useToast';
import { useOnline } from '@/composables/useOnline';
import { requestLocation } from '@/composables/useGeolocation';
import api from '@/services/api';
import { buildBoastShareData } from '@/utils/share';
import ScoreRevealOverlay from '@/components/upload/ScoreRevealOverlay.vue';
import LevelUpOverlay from '@/components/upload/LevelUpOverlay.vue';

const router = useRouter();
const uploadStore = useUploadStore();
const homeStore = useHomeStore();
const uiStore = useUiStore();
const { targetPlace, photos, selectedIndex, caption, tags, visibility, addToStampbook, loading, uploadProgress, error: errorText, lastResult } = storeToRefs(uploadStore);
const selectedPhoto = computed(() => uploadStore.selectedPhoto);
const { showError, showInfo } = useToast();
const online = useOnline();

// ---------- Stage machine (task #8) ----------
// /upload now hosts the entire compose → scoring → authenticated flow in one
// page (no /reward redirect). Stage transitions:
//   compose  → user fills form, taps 공유하기
//   scoring  → submit() in flight (loading) and then count-up reveal
//   authenticated → 06-reward style 인증 완료 page (stamp + rewards + actions)
type Stage = 'compose' | 'scoring' | 'authenticated';
const stage = ref<Stage>('compose');
const scoreLoading = ref(false);
const scoreTotal = ref<number | null>(null);
const scoreSimilarity = ref<number | null>(null);
const scoreGps = ref<number | null>(null);

// Pending timer for the count-up → authenticated handoff (~700ms beat so the
// final score lingers long enough to register before the screen swaps).
let pendingStageTimer: ReturnType<typeof setTimeout> | null = null;
function clearStageTimer(): void {
  if (pendingStageTimer !== null) {
    clearTimeout(pendingStageTimer);
    pendingStageTimer = null;
  }
}

// stamp-card / rewards 노출 타이밍 — authenticated stage 진입 후 잠깐 뒤에
// 띄워서 "인증 완료!" 헤더가 자리 잡고 나서 fade-up 애니메이션으로 따라
// 들어오게 한다. scoring 단계에서는 미노출.
const EXTRAS_REVEAL_DELAY_MS = 500;
const extrasVisible = ref(false);
let extrasRevealTimer: ReturnType<typeof setTimeout> | null = null;
function clearExtrasTimer(): void {
  if (extrasRevealTimer !== null) {
    clearTimeout(extrasRevealTimer);
    extrasRevealTimer = null;
  }
}

// 레벨 업 오버레이 — rewards 가 자리 잡은 뒤 한 번 더 텀을 두고 띄운다
// (인증완료 → rewards → 레벨업 순서). 응답에 previousLevel 이 빠진
// 레거시 케이스는 maybeRevealLevelUp 에서 조용히 스킵.
const LEVELUP_REVEAL_DELAY_MS = 400;
const levelUpOpen = ref(false);
let levelUpRevealTimer: ReturnType<typeof setTimeout> | null = null;
function clearLevelUpTimer(): void {
  if (levelUpRevealTimer !== null) {
    clearTimeout(levelUpRevealTimer);
    levelUpRevealTimer = null;
  }
}

const fileInput = ref<HTMLInputElement | null>(null);

// 고급 설정(스탬프북 / 공개 범위)은 기본 접힘. 사용자가 매번 바꾸지 않는
// 옵션이라 caption 작성 흐름을 끊지 않게 한다. 페이지 단위 단순 ref —
// 업로드 후 새 글 작성 시에는 다시 접힘으로 복귀.
const advancedOpen = ref(false);


// "공유하기" needs both a place and at least one photo. The button text/state
// reflects what's missing so the user isn't left guessing. Offline browsers
// get the same disabled treatment — submit would bail with a clearer error
// anyway, but showing "공유하기" as tappable when there's no network feels
// dishonest.
const canShare = computed(
  () =>
    !loading.value &&
    targetPlace.value !== null &&
    photos.value.length > 0 &&
    photos.value.length <= MAX_PHOTOS_PER_POST &&
    online.value,
);

const canAddMore = computed(() => photos.value.length < MAX_PHOTOS_PER_POST);

// ---------- Place picker ----------
// 인증샷은 그 곳에 가서 찍어야 하므로 picker 는 거리순 정렬을 우선한다.
// 별도의 nearby fetch 결과를 `pickerNearby` 에 보관해 home tab 의 sort(NEAR/
// TRENDING) 와 분리. 위치 권한 거부 / 실패 시 homeStore.places 로 폴백.
const pickerOpen = ref(false);
const pickerQuery = ref('');
const pickerNearby = ref<PlaceSummary[] | null>(null);

const pickerResults = computed<PlaceSummary[]>(() => {
  const q = pickerQuery.value.trim().toLowerCase();
  // nearby 가 잡혀 있으면 그걸 우선 — 백엔드가 이미 거리순 정렬해서 내려줌.
  const source = pickerNearby.value ?? homeStore.places;
  if (!q) return source;
  return source.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.contentTitle.toLowerCase().includes(q) ||
      p.regionLabel.toLowerCase().includes(q)
    );
  });
});

async function onOpenPicker(): Promise<void> {
  pickerQuery.value = '';
  pickerOpen.value = true;
  // 거리순 nearby 시도 — 권한 받아 좌표 잡으면 NEAR scope 로 직접 호출.
  // 실패/거부 시 homeStore fallback.
  const geo = await requestLocation();
  if (geo.ok) {
    try {
      const { data } = await api.get<{ places: PlaceSummary[] }>('/api/home', {
        params: { scope: 'NEAR', lat: geo.coords.lat, lng: geo.coords.lng, radiusKm: 100 },
      });
      pickerNearby.value = data.places ?? [];
      return;
    } catch {
      // 네트워크 실패 — 아래 home fallback 으로 흐른다.
    }
  }
  pickerNearby.value = null;
  if (homeStore.places.length === 0 && !homeStore.loading) {
    await homeStore.fetchHome();
  }
}

function onClosePicker(): void {
  pickerOpen.value = false;
}

function onPickPlace(p: PlaceSummary): void {
  uploadStore.setTargetPlace({
    placeId: p.id,
    contentId: p.contentId,
    contentTitle: p.contentTitle,
    contentEpisode: null,
    placeName: p.name,
    // Home summary doesn't carry a scene reference — leave null so the
    // upload preview hides the "장면 비교 ON" sticker until the user
    // re-enters via PlaceDetail for that spot.
    sceneImageUrl: null,
  });
  pickerOpen.value = false;
}

function onCaptionInput(e: Event): void {
  const target = e.target as HTMLTextAreaElement;
  uploadStore.setCaption(target.value);
}

// ---------- Tag chip input ----------
// 백엔드는 이미 PhotoUploadRequest.tags(CSV) → tags_csv 컬럼 → PhotoDetailResponse.tags
// 까지 깔려 있어, 프론트는 입력 UI 만 채우면 ShotDetail 에 즉시 표시된다.
// 사양: 최대 10개, 각 20자, 한글/영문/숫자/언더스코어만. 중복은 무시.
const MAX_TAGS = 10;
const MAX_TAG_LEN = 20;
const TAG_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;
const tagDraft = ref('');

function commitTag(): void {
  // 사용자가 '#' 을 같이 쳤다면 잘라낸다 (보일 때 어차피 '#' 이 prepend 되므로).
  const raw = tagDraft.value.trim().replace(/^#+/, '');
  if (raw.length === 0) {
    tagDraft.value = '';
    return;
  }
  if (raw.length > MAX_TAG_LEN || !TAG_PATTERN.test(raw)) {
    // 형식 위반 — 입력만 비우고 조용히 드롭. 안내 토스트는 빈도가 잦아질 수
    // 있어 우선 생략 (추후 필요시 추가).
    tagDraft.value = '';
    return;
  }
  if (tags.value.includes(raw)) {
    tagDraft.value = '';
    return;
  }
  if (tags.value.length >= MAX_TAGS) return;
  uploadStore.setTags([...tags.value, raw]);
  tagDraft.value = '';
}

function onTagKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
    e.preventDefault();
    commitTag();
    return;
  }
  // 빈 입력에서 backspace → 마지막 chip 제거. 흔한 chip-input 패턴.
  if (e.key === 'Backspace' && tagDraft.value.length === 0 && tags.value.length > 0) {
    e.preventDefault();
    uploadStore.setTags(tags.value.slice(0, -1));
  }
}

function onTagBlur(): void {
  // 사용자가 chip 확정 없이 다른 곳을 탭했을 때 입력값을 잃지 않도록 commit.
  if (tagDraft.value.trim().length > 0) commitTag();
}

function onRemoveTag(index: number): void {
  const next = tags.value.slice();
  next.splice(index, 1);
  uploadStore.setTags(next);
}

function onSelectThumb(idx: number): void {
  uploadStore.selectPhoto(idx);
}

function onToggleStampbook(): void {
  uploadStore.toggleStampbook();
}

function onSetVisibility(v: 'PUBLIC' | 'PRIVATE'): void {
  if (visibility.value === v) return;
  uploadStore.setVisibility(v);
}

async function onFilePick(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (files.length === 0) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  for (const file of files) {
    if (photos.value.length >= MAX_PHOTOS_PER_POST) {
      await showError(`최대 ${MAX_PHOTOS_PER_POST}장까지 올릴 수 있어요`);
      return;
    }
    if (!allowed.includes(file.type)) {
      await showError('jpg, png, webp 형식만 올릴 수 있어요');
      continue;
    }
    const dataUrl = await fileToDataUrl(file);
    uploadStore.addPhoto(dataUrl);
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function onCancel(): Promise<void> {
  uploadStore.reset();
  await router.replace('/home');
}

// ---------- Submit / score / completion (task #8) ----------
// onShare drives the whole compose → scoring → authenticated trip without
// leaving /upload. submit() flips the page into 'scoring' stage with a
// "채점 중" placeholder, then the inline ScoreRevealOverlay count-up takes
// over once a response is in. count-up-complete → 700ms beat → 'authenticated'.

function applyScoreFromResponse(res: { placeId: number; totalScore?: number | null; similarityScore?: number | null; gpsScore?: number | null }): void {
  scoreTotal.value = res.totalScore ?? null;
  scoreSimilarity.value = res.similarityScore ?? null;
  scoreGps.value = res.gpsScore ?? null;
  scoreLoading.value = false;
}

function resetCompletionState(): void {
  scoreLoading.value = false;
  scoreTotal.value = null;
  scoreSimilarity.value = null;
  scoreGps.value = null;
  clearStageTimer();
  clearExtrasTimer();
  extrasVisible.value = false;
  clearLevelUpTimer();
  levelUpOpen.value = false;
}

/**
 * "공유하기" 버튼 디스패처. canShare 면 곧장 onShare(), 아니면 누락 항목별
 * 토스트 + 가능하면 후속 액션(예: 장소 picker 자동 오픈)으로 다음 단계 안내.
 * 우선순위: 진행 중(무시) → 사진 → 장소 → 오프라인. 한 번에 한 가지만 안내.
 */
async function onShareClick(): Promise<void> {
  if (canShare.value) {
    await onShare();
    return;
  }
  if (loading.value) return; // 이미 진행 표시 중
  if (photos.value.length === 0) {
    await showError('사진을 한 장 이상 추가해 주세요');
    return;
  }
  if (photos.value.length > MAX_PHOTOS_PER_POST) {
    await showError(`사진은 최대 ${MAX_PHOTOS_PER_POST}장까지 올릴 수 있어요`);
    return;
  }
  if (targetPlace.value === null) {
    await showError('장소를 선택해 주세요');
    // 사용자가 한 번 더 누르는 수고를 줄이도록 picker 곧장 오픈.
    void onOpenPicker();
    return;
  }
  if (!online.value) {
    await showError('인터넷 연결을 확인해 주세요');
    return;
  }
}

async function onShare(): Promise<void> {
  resetCompletionState();
  scoreLoading.value = true;
  stage.value = 'scoring';

  const res = await uploadStore.submit();
  if (!res) {
    // Upload failed — fall back to the compose form so the inline error
    // banner / retry affordance is visible again.
    stage.value = 'compose';
    scoreLoading.value = false;
    if (uploadStore.error) await showError(uploadStore.error);
    return;
  }
  applyScoreFromResponse(res);
}

// Re-attempt a failed upload. Uses the same state as onShare — photos,
// caption, tags, visibility are all still populated. On success, behaves
// identically to the first attempt (scoring → authenticated stage flow).
async function onRetry(): Promise<void> {
  resetCompletionState();
  scoreLoading.value = true;
  stage.value = 'scoring';

  const res = await uploadStore.retry();
  if (!res) {
    stage.value = 'compose';
    scoreLoading.value = false;
    if (uploadStore.error) await showError(uploadStore.error);
    return;
  }
  applyScoreFromResponse(res);
}

// 600~800ms hold so the bounced final score has presence before the screen
// hands off to the 인증 완료 view. Anything shorter feels jumpy; anything
// longer feels like it stalled.
const STAGE_BEAT_MS = 700;

function onCountUpComplete(): void {
  if (stage.value !== 'scoring') return;
  clearStageTimer();
  pendingStageTimer = setTimeout(() => {
    pendingStageTimer = null;
    stage.value = 'authenticated';
    scheduleExtrasReveal();
  }, STAGE_BEAT_MS);
}

// "인증 완료!" 헤더가 자리 잡고 나면 stamp-card / rewards 를 fade-up 으로
// 띄운다. 다 자리 잡은 뒤에 레벨업 모달이 따라 들어옴 (해당하는 경우).
function scheduleExtrasReveal(): void {
  clearExtrasTimer();
  extrasRevealTimer = setTimeout(() => {
    extrasRevealTimer = null;
    extrasVisible.value = true;
    maybeRevealLevelUp();
    maybeRevealTrophy();
  }, EXTRAS_REVEAL_DELAY_MS);
}

function maybeRevealLevelUp(): void {
  clearLevelUpTimer();
  const reward = lastResult.value?.reward;
  if (!reward) return;
  if (reward.level <= reward.previousLevel) return;
  levelUpRevealTimer = setTimeout(() => {
    levelUpRevealTimer = null;
    levelUpOpen.value = true;
  }, LEVELUP_REVEAL_DELAY_MS);
}

// 작품 트로피 알림 — 새 마일스톤(25/50/75/100%) 진입 시 백엔드가 newTrophyTier 를
// 채워준다. MASTER 는 강한 톤(🏆), 그 외는 가벼운 톤(🎉)으로 차이를 둔다.
// 같은 작품 같은 tier 는 한번만 발급되므로 중복 노출 걱정 없음.
function maybeRevealTrophy(): void {
  const reward = lastResult.value?.reward;
  if (!reward || !reward.newTrophyTier) return;
  const title = reward.newTrophyContentTitle ?? '작품';
  if (reward.newTrophyTier === 'MASTER') {
    void showInfo(`🏆 ${title} 마스터 달성!`);
  } else {
    const pct = reward.newTrophyTier === 'THREE_Q' ? 75 : reward.newTrophyTier === 'HALF' ? 50 : 25;
    void showInfo(`🎉 ${title} ${pct}% 도달`);
  }
}

function onLevelUpClose(): void {
  levelUpOpen.value = false;
}

// ---------- Stage B (인증 완료) reads ----------
const completionStamp = computed(() => lastResult.value?.stamp ?? null);
const completionReward = computed(() => lastResult.value?.reward ?? null);
const completionPlaceName = computed(() =>
  completionStamp.value?.placeName ?? targetPlace.value?.placeName ?? '성지',
);
const nextMilestoneCount = computed(() => {
  const s = completionStamp.value;
  if (!s) return 0;
  return Math.max(0, s.totalCount - s.collectedCount);
});

// stamp-card / rewards 는 "인증 완료!" 헤더가 들어오고 EXTRAS_REVEAL_DELAY_MS
// 뒤에 fade-up 으로 따라 들어온다. scoring 단계에서는 노출하지 않는다 —
// 사용자가 점수 카운트업에 집중하도록 두고, authenticated 후에 보상이
// 차례로 보이는 흐름이 더 자연스러움.
const showCompletionExtras = computed<boolean>(() => {
  return stage.value === 'authenticated' && extrasVisible.value;
});

interface ConfettiDot {
  key: string;
  style: Record<string, string>;
}
const CONFETTI_COLORS = ['#14BCED', '#7c3aed', '#f5a524', '#10b981', '#14BCED', '#ff5a5f'];
const CONFETTI_POSITIONS: Array<{ left: string; top: string; rotate: number }> = [
  { left: '10%', top: '12%', rotate: 0 },
  { left: '85%', top: '18%', rotate: 20 },
  { left: '20%', top: '28%', rotate: 0 },
  { left: '78%', top: '40%', rotate: -20 },
  { left: '12%', top: '55%', rotate: 0 },
  { left: '88%', top: '60%', rotate: 0 },
];
const confettiDots = computed<ConfettiDot[]>(() =>
  CONFETTI_POSITIONS.map((p, i) => ({
    key: `c-${i}`,
    style: {
      background: CONFETTI_COLORS[i],
      left: p.left,
      top: p.top,
      transform: `rotate(${p.rotate}deg)`,
    },
  })),
);

function onBoast(): void {
  if (!lastResult.value) return;
  uiStore.openShareSheet(
    buildBoastShareData(lastResult.value, targetPlace.value?.placeName),
  );
}

async function onGoHome(): Promise<void> {
  // 인증샷 업로드 직후엔 사용자가 방금 다녀온 성지의 갤러리(=다른 사람들의
  // 인증샷 + 자기 사진이 같이 보이는 화면)로 이동하는 게 흐름상 자연스럽다.
  // lastResult.placeId 가 있으면 거기로, 없는 비정상 경로(에러 직후 등)는
  // /home 으로 폴백해 사용자를 어디로도 못 보내는 막다른 길은 만들지 않는다.
  const placeId = uploadStore.lastResult?.placeId;
  uploadStore.reset();
  stage.value = 'compose';
  await router.replace(placeId != null ? `/gallery/${placeId}` : '/home');
}

onMounted(async () => {
  // Only bounce when there's literally nothing to upload. A no-target entry
  // (bottom-nav camera CTA) lands here with photos already shot — the user
  // picks a place via the sheet below and shares from there.
  if (photos.value.length === 0) {
    await router.replace('/home');
  }
});

onBeforeUnmount(() => {
  clearStageTimer();
  clearExtrasTimer();
  clearLevelUpTimer();
});
</script>

<style scoped>
ion-content.up-content {
  --background: #ffffff;
}

.top {
  padding: calc(8px + env(safe-area-inset-top)) 16px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--fr-line);
  background: #ffffff;
}
.top h1 {
  margin: 0;
  font-size: 17px; font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.cancel {
  color: var(--fr-ink-3);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}
.post {
  background: var(--fr-primary);
  color: #ffffff;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
}
/* aria-disabled 만 사용 — 클릭은 onShareClick 가 받아 누락 항목 토스트 + picker
   자동 오픈을 처리하므로 native disabled 속성은 떼고 시각만 흐리게. */
.post.post-disabled { opacity: 0.6; cursor: pointer; }

.upload-progress {
  height: 3px;
  background: var(--fr-line-soft);
  overflow: hidden;
}
.upload-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--fr-primary), #7c3aed);
  transition: width 0.15s ease-out;
}

/* Offline banner — stays visible until the connection returns (reactive
   via useOnline composable on window online/offline events). */
.upload-offline {
  margin: 10px 16px 0;
  padding: 10px 12px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: #92400e;
}

/* Inline error banner with retry button — stays visible until the user
   acts, so flaky-network retries aren't gated on catching the toast. */
.upload-error {
  margin: 10px 16px 0;
  padding: 10px 12px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #be123c;
}
.upload-error .err-text {
  flex: 1;
  line-height: 1.35;
}
.upload-error .err-retry {
  background: #be123c;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.up-scroll {
  overflow-y: auto;
}

.preview-wrap {
  padding: 16px 16px 0;
  position: relative;
}
.preview {
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: 18px;
  overflow: hidden;
  background: #000;
  position: relative;
}
.preview img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.sticker-label {
  position: absolute;
  top: 14px; right: 14px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  display: flex; align-items: center; gap: 5px;
  backdrop-filter: blur(8px);
}
.frame-sticker {
  position: absolute;
  left: 14px; bottom: 14px;
  background: linear-gradient(135deg, rgba(20, 188, 237, 0.95), rgba(14, 165, 212, 0.95));
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 12px;
  display: flex; align-items: center; gap: 8px;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.4);
}
.frame-sticker .ico {
  width: 24px; height: 24px;
  border-radius: 7px;
  background: #ffffff;
  color: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
}
.frame-sticker .t { font-size: 11.5px; font-weight: 800; line-height: 1.1; }
.frame-sticker .s { font-size: 9px; opacity: 0.9; line-height: 1.1; margin-top: 2px; }

.thumbs {
  display: flex; gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
}
.thumbs .t {
  width: 60px; height: 60px;
  border-radius: 12px;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  border: 2px solid transparent;
  cursor: pointer;
}
.thumbs .t.sel { border-color: var(--fr-primary); }
.thumbs .t img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumbs .plus {
  width: 60px; height: 60px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  display: flex; align-items: center; justify-content: center;
  color: var(--fr-ink-3);
  border: 1.5px dashed var(--fr-line);
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
}
.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.fields {
  padding: 4px 16px calc(100px + env(safe-area-inset-bottom));
}
.field {
  padding: 16px 0;
  border-bottom: 1px solid var(--fr-line);
}
.caption {
  width: 100%;
  border: none;
  font-size: 14.5px;
  resize: none;
  outline: none;
  min-height: 76px;
  font-family: inherit;
  letter-spacing: -0.01em;
  color: var(--fr-ink);
  background: transparent;
}
.caption::placeholder { color: var(--fr-ink-4); }

.row-field {
  display: flex;
  align-items: center;
  gap: 12px;
}
.row-field .ico {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.row-field .ico.stampbook { background: #fff1f2; color: var(--fr-coral); }
.row-field .ico.visibility { background: #eff6ff; color: #2563eb; }
.row-field .k { font-size: 12px; color: var(--fr-ink-3); }
.row-field .v {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 1px;
}
.row-field .grow { flex: 1; }
.row-field .chev { color: var(--fr-ink-4); margin-left: auto; }

/* 공개 범위 segmented control — 두 옵션이 항상 보이게. row 에 들어가지만
   세로 레이아웃(라벨 위 / 컨트롤 아래)으로 두 pill 이 각자 충분한 폭 확보.
   on 상태는 brand primary, off 는 muted bg + ink-3. */
.vis-field .grow { display: flex; flex-direction: column; gap: 6px; }
.vis-segmented {
  display: flex;
  gap: 6px;
  background: var(--fr-bg-muted);
  border-radius: 10px;
  padding: 3px;
}
.vis-seg {
  flex: 1;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--fr-ink-3);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}
.vis-seg.on {
  background: #ffffff;
  color: var(--fr-primary);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

/* 고급 설정 토글 — data row 보다 가벼운 무게(아이콘 박스 없음, 패딩 작게)로
   "이건 메타 정보가 아니라 컨트롤이다"는 신호. 평면 행 사이에 끼면 시각
   리듬이 깨져서 좌측 인덴트 약간 + 작은 폰트로 분리. */
.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 6px;
  margin-top: 2px;
  background: transparent;
  border: none;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}
.advanced-toggle:active { color: var(--fr-ink-2); }
.advanced-toggle ion-icon { color: var(--fr-ink-4); }

.tags {
  display: flex; gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
  align-items: center;
}
.tag {
  font-size: 12px;
  color: var(--fr-primary);
  background: var(--fr-primary-soft);
  padding: 5px 11px;
  border-radius: 999px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tag-x {
  border: none;
  background: transparent;
  color: var(--fr-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  padding: 0 2px;
  cursor: pointer;
  font-family: inherit;
  opacity: 0.7;
}
.tag-x:hover { opacity: 1; }
.tag-input {
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  color: var(--fr-ink-2);
  background: var(--fr-bg-muted);
  padding: 5px 11px;
  border-radius: 999px;
  border: none;
  outline: none;
  min-width: 96px;
  flex: 1;
  letter-spacing: -0.01em;
}
.tag-input::placeholder { color: var(--fr-ink-3); }

.toggle {
  width: 42px; height: 24px;
  background: var(--fr-primary);
  border-radius: 999px;
  position: relative;
  border: none;
  cursor: pointer;
}
.toggle::after {
  content: '';
  position: absolute;
  right: 3px; top: 3px;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: #ffffff;
}
.toggle.off { background: #cbd5e1; }
.toggle.off::after { left: 3px; right: auto; }

/* "장소 선택" CTA — shown when no targetPlace yet (camera-first flow). */
.place-cta {
  background: transparent;
  width: 100%;
  border: none;
  padding: 16px 0;
  border-bottom: 1px solid var(--fr-line);
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.place-cta .missing {
  color: var(--fr-primary);
}
.change-link {
  font-size: 12px;
  color: var(--fr-primary);
  font-weight: 700;
  padding: 4px 10px;
  background: var(--fr-primary-soft);
  border-radius: 999px;
  margin-left: auto;
}

/* Place picker sheet. Backdrop + bottom sheet — minimal Ionic-free modal
   so the unit tests can drive it without stubbing ion-modal internals. */
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.picker-sheet {
  width: 100%;
  max-width: 480px;
  max-height: 82vh;
  background: #ffffff;
  border-radius: 22px 22px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.24);
}
.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 8px;
}
.picker-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.picker-close {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.picker-search {
  position: relative;
  margin: 4px 20px 10px;
  padding: 0 14px 0 42px;
  height: 44px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
}
.picker-search .search-ic {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fr-ink-4);
}
.picker-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font: inherit;
  font-size: 14px;
  color: var(--fr-ink);
}
.picker-search input::placeholder {
  color: var(--fr-ink-4);
}
.picker-list {
  overflow-y: auto;
  padding: 4px 8px 16px;
  flex: 1;
}
.picker-item {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.picker-item:hover {
  background: var(--fr-bg-muted);
}
.picker-item .thumb {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: #eef2f6;
  overflow: hidden;
  flex-shrink: 0;
}
.picker-item .thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.picker-item .meta {
  flex: 1;
  min-width: 0;
}
.picker-item .meta .t {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-item .meta .s {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-empty {
  padding: 32px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--fr-ink-3);
}

/* ====================================================================
   Stage A (scoring) + Stage B (authenticated) — design/pages/06-reward.html
   ==================================================================== */

ion-content.up-content.up-stage-scoring,
ion-content.up-content.up-stage-authenticated {
  --background: #fafbfd;
}

.rw-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background:
    radial-gradient(circle at 20% 10%, rgba(20, 188, 237, 0.15), transparent 40%),
    radial-gradient(circle at 85% 80%, rgba(124, 58, 237, 0.1), transparent 40%),
    #fafbfd;
}
.confetti {
  position: absolute;
  width: 8px; height: 8px;
  border-radius: 2px;
}

.rw-page-content {
  position: relative;
  z-index: 1;
  padding: calc(60px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-height: 100%;
  overflow-y: auto;
}

.check-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 30px 0 20px;
}
.check-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--fr-primary);
  box-shadow: 0 20px 50px rgba(20, 188, 237, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}
.check-ring::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(20, 188, 237, 0.3);
}
.check-ic {
  width: 56px;
  height: 56px;
  font-size: 56px;
}

/* Stage A — the count-up reveal does NOT live inside the small primary
   ring (the 64px score number wouldn't fit). Instead the wrap is the
   card itself: light card with a subtle ring shadow. The 인증 완료 ring
   takes back over in stage B. */
.scoring-wrap {
  width: auto;
  height: auto;
  min-width: 220px;
  margin: 30px 0 20px;
  padding: 20px 24px;
  border-radius: 24px;
}

.rw-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin: 8px 0;
  color: var(--fr-ink);
}
.rw-sub {
  font-size: 14px;
  color: var(--fr-ink-3);
  line-height: 1.5;
  margin: 0;
}
.bold-k {
  color: var(--fr-primary);
  font-weight: 800;
}

/* "인증 완료!" 헤더가 자리잡은 뒤 stamp-card / rewards 가 차례로 들어오는
   진입 애니메이션. v-if 토글로 mount 되는 순간 자동 재생. .rewards 에 미세한
   stagger 를 줘서 두 섹션이 같이 튀어 나오지 않게 한다. */
@keyframes extras-fade-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ----- 06-reward stamp + reward + badges + actions (verbatim, 1:1) ----- */
.stamp-card {
  margin-top: 26px;
  width: 100%;
  background: #ffffff;
  border-radius: 22px;
  padding: 20px 18px;
  border: 1px solid var(--fr-line);
  position: relative;
  animation: extras-fade-up 380ms cubic-bezier(0.34, 1.2, 0.64, 1) both;
}
.stamp-card::before,
.stamp-card::after {
  content: '';
  position: absolute;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #fafbfd;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid var(--fr-line);
}
.stamp-card::before { left: -8px; }
.stamp-card::after { right: -8px; }

.stamp-top {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--fr-line);
}
.stamp-badge {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  position: relative;
  flex-shrink: 0;
}
.stamp-badge .num {
  position: absolute;
  right: -4px; top: -4px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--fr-coral);
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
}
.stamp-info { flex: 1; }
.stamp-info .t {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.stamp-info .s {
  font-size: 12px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

.progress {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}
.progress .p-t {
  font-weight: 700;
  color: var(--fr-ink);
}
.progress .p-v {
  color: var(--fr-ink-3);
}
.bar {
  height: 8px;
  background: var(--fr-bg-muted);
  border-radius: 999px;
  overflow: hidden;
}
.bar .fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #14BCED, #7c3aed);
}
.next-milestone {
  font-size: 11px;
  color: var(--fr-ink-3);
  margin-top: 10px;
  text-align: left;
}
.next-milestone b {
  color: var(--fr-primary);
  font-weight: 700;
}

.rewards {
  display: flex;
  gap: 8px;
  width: 100%;
  margin-top: 20px;
  animation: extras-fade-up 380ms cubic-bezier(0.34, 1.2, 0.64, 1) 120ms both;
}
.reward {
  flex: 1;
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 16px;
  padding: 14px 10px;
  text-align: center;
}
.reward .ico {
  width: 36px; height: 36px;
  border-radius: 10px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ico-amber { background: #fff7e6; color: #f5a524; }
.ico-primary { background: #e6f8fd; color: var(--fr-primary); }
.ico-mint { background: #ecfdf5; color: var(--fr-mint); }
.ico-violet { background: #f3eefe; color: #7c3aed; }
.reward .n {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.reward .l {
  font-size: 10.5px;
  color: var(--fr-ink-3);
  margin-top: 1px;
}

.new-badges {
  width: 100%;
  margin-top: 18px;
  text-align: left;
}
.new-badges h3 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 800;
  color: var(--fr-ink);
}
.nb-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
}
.nb-card {
  flex-shrink: 0;
  width: 120px;
  background: #ffffff;
  border: 1px solid var(--fr-line);
  border-radius: 14px;
  padding: 10px;
  text-align: center;
}
.nb-circle {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14BCED, #7c3aed);
  color: #ffffff;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nb-t {
  font-size: 11.5px;
  font-weight: 800;
  color: var(--fr-ink);
}
.nb-s {
  font-size: 10px;
  color: var(--fr-ink-3);
  margin-top: 2px;
}

.rw-actions {
  margin-top: auto;
  padding-top: 28px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fr-btn {
  height: 52px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  cursor: pointer;
  width: 100%;
}
.fr-btn.primary {
  background: var(--fr-primary);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.35);
}
.link {
  color: var(--fr-ink-3);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  padding: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
}
</style>
