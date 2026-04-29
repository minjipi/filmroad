<template>
  <ion-page>
    <ion-content :fullscreen="true" class="sd-content">
      <!-- task #16: .sd-top is now inside the scroll container so its
           `position: sticky` actually sticks. The wrapper is always rendered
           (loading/error/loaded) so the back/more buttons work even when the
           fetch fails. The `data-testid="sd-loaded"` slot moved one level
           inward to a dedicated wrapper that's still gated on `shot`. -->
      <div class="sd-scroll no-scrollbar">
        <header class="sd-top">
          <button type="button" class="ic-btn" aria-label="back" @click="onBack">
            <ion-icon :icon="chevronBack" class="ic-22" />
          </button>
          <!-- task #26: 우측 more 버튼 제거 — 카드별 .card-more 가 자리 대체.
               중복된 진입점 회피. 헤더는 back 만 남는 minimal 형태. -->
        </header>

        <!-- Loading placeholder — shown while the first /api/photos/:id fetch
             is in flight. Error placeholder handles 404/network failure. -->
        <div
          v-if="loading && !shot"
          class="sd-placeholder"
          data-testid="sd-loading"
        >
          불러오는 중…
        </div>
        <div
          v-else-if="!shot && error"
          class="sd-placeholder error"
          data-testid="sd-error"
        >
          {{ error }}
        </div>

        <div v-else-if="shot" class="sd-loaded" data-testid="sd-loaded">
        <!-- Multi-image post (task #44): horizontal carousel of all photos
             in the upload group. Scene-compare overlay lives only on the
             first slide; follow-up photos render as plain images. -->
        <section
          v-if="images.length > 1"
          class="sd-carousel"
          data-testid="sd-carousel"
        >
          <div
            ref="carouselEl"
            class="carousel-track no-scrollbar"
            @scroll="onCarouselScroll"
          >
            <div class="carousel-slide" data-testid="sd-slide">
              <div class="compare" :data-mode="compareMode">
                <img
                  v-if="shot.sceneImageUrl"
                  :src="shot.sceneImageUrl"
                  class="compare-img is-guide"
                  alt="드라마 원본 장면"
                />
                <img
                  :src="images[0].imageUrl"
                  class="compare-img is-shot"
                  :alt="shot.place.name"
                />
                <span v-if="shot.sceneImageUrl" class="lbl-chip l">드라마 원본</span>
                <!-- task #26: 우상단 "내 인증샷" 라벨 → 카드별 more 버튼 -->
                <button
                  type="button"
                  class="card-more"
                  data-testid="sd-card-more"
                  aria-label="더보기"
                  @click="onCardMore"
                >
                  <ion-icon :icon="ellipsisHorizontal" class="ic-18" />
                </button>
                <div class="scene-meta">
                  <ion-icon :icon="filmOutline" class="ic-16" />{{ shot.work.title }}
                  <template v-if="shot.work.episode"> · {{ shot.work.episode }}</template>
                  <template v-if="shot.work.sceneTimestamp">
                    <span class="sep" />
                    <ion-icon :icon="timeOutline" class="ic-16" />{{ shot.work.sceneTimestamp }}
                  </template>
                </div>
                <button
                  v-if="shot.sceneImageUrl"
                  type="button"
                  class="compare-toggle"
                  :aria-pressed="compareMode === 'guide'"
                  data-testid="sd-compare-toggle"
                  @click="onToggleCompare"
                >
                  <ion-icon :icon="eyeOutline" class="ic-16" />
                  <span class="compare-toggle-lbl">{{ compareMode === 'guide' ? '원본으로' : '가이드 보기' }}</span>
                </button>
              </div>
            </div>
            <div
              v-for="p in images.slice(1)"
              :key="p.id"
              class="carousel-slide"
              data-testid="sd-slide"
            >
              <img :src="p.imageUrl" :alt="shot.place.name" />
            </div>
          </div>
          <div class="carousel-dots" data-testid="sd-dots">
            <span
              v-for="(_, i) in images"
              :key="i"
              :class="['dot', i === currentSlide ? 'active' : '']"
            />
          </div>
          <span class="carousel-count" data-testid="sd-count">
            {{ currentSlide + 1 }} / {{ images.length }}
          </span>
        </section>

        <!-- Single-image post — task #12: clip-path split → toggle.
             Two stacked images opacity-swap on data-mode; "가이드 보기"
             button flips between drama-scene and user-shot. Mirrors the
             pattern from design/pages/13-feed-detail.html. -->
        <section v-else class="compare" :data-mode="compareMode">
          <img
            v-if="shot.sceneImageUrl"
            :src="shot.sceneImageUrl"
            class="compare-img is-guide"
            alt="드라마 원본 장면"
          />
          <img
            :src="shot.imageUrl"
            class="compare-img is-shot"
            :alt="shot.place.name"
          />
          <span v-if="shot.sceneImageUrl" class="lbl-chip l">드라마 원본</span>
          <!-- task #26: 우상단 "내 인증샷" 라벨 → 카드별 more 버튼 -->
          <button
            type="button"
            class="card-more"
            data-testid="sd-card-more"
            aria-label="더보기"
            @click="onCardMore"
          >
            <ion-icon :icon="ellipsisHorizontal" class="ic-18" />
          </button>
          <div class="scene-meta">
            <ion-icon :icon="filmOutline" class="ic-16" />{{ shot.work.title }}
            <template v-if="shot.work.episode"> · {{ shot.work.episode }}</template>
            <template v-if="shot.work.sceneTimestamp">
              <span class="sep" />
              <ion-icon :icon="timeOutline" class="ic-16" />{{ shot.work.sceneTimestamp }}
            </template>
          </div>
          <button
            v-if="shot.sceneImageUrl"
            type="button"
            class="compare-toggle"
            :aria-pressed="compareMode === 'guide'"
            data-testid="sd-compare-toggle"
            @click="onToggleCompare"
          >
            <ion-icon :icon="eyeOutline" class="ic-16" />
            <span class="compare-toggle-lbl">{{ compareMode === 'guide' ? '원본으로' : '가이드 보기' }}</span>
          </button>
        </section>

        <section class="sd-user">
          <button
            type="button"
            class="avatar"
            data-testid="sd-avatar"
            :disabled="shot.author.id == null"
            :aria-label="`${shot.author.nickname} 프로필 보기`"
            @click="onOpenAuthor"
          >
            <img
              v-if="shot.author.avatarUrl"
              :src="shot.author.avatarUrl"
              :alt="shot.author.nickname"
            />
          </button>
          <div class="meta">
            <button
              type="button"
              class="nm"
              data-testid="sd-author-nickname"
              :disabled="shot.author.id == null"
              @click="onOpenAuthor"
            >
              {{ shot.author.nickname }}
              <ion-icon v-if="shot.author.verified" :icon="checkmarkCircle" class="verified" />
            </button>
            <button
              type="button"
              class="sub"
              data-testid="sd-place-link"
              :aria-label="`${shot.place.name} 지도에서 보기`"
              @click="onOpenPlaceMap"
            >
              <ion-icon :icon="locationOutline" class="ic-16" />
              {{ shot.place.name }} · {{ takenAtLabel }}
            </button>
          </div>
          <!-- 작성자가 본인이면 팔로우 버튼은 의미 없으므로 숨김. 별도 "내 기록"
               CTA 도 두지 않음 — /profile 이 사실상 그 역할을 대체한다. -->
          <button
            v-if="!shot.author.isMe"
            type="button"
            :class="['follow', shot.author.following ? 'on' : '']"
            data-testid="sd-author-action"
            @click="onAuthorAction"
          >
            {{ authorActionLabel }}
          </button>
        </section>

        <section class="sd-stats">
          <button
            type="button"
            :class="['sd-stat-btn', shot.liked ? 'liked' : '']"
            data-testid="sd-like-btn"
            @click="onToggleLike"
          >
            <span class="stat-inner">
              <ion-icon :icon="shot.liked ? heart : heartOutline" class="ic-22" />
              <span class="n">{{ formatCount(shot.likeCount) }}</span>
              <span class="l">좋아요</span>
            </span>
          </button>
          <button type="button" class="sd-stat-btn" @click="onOpenComments">
            <span class="stat-inner">
              <ion-icon :icon="chatbubbleOutline" class="ic-22" />
              <span class="n">{{ formatCount(shot.commentCount) }}</span>
              <span class="l">댓글</span>
            </span>
          </button>
          <button
            type="button"
            :class="['sd-stat-btn', placeSaved ? 'saved' : '']"
            data-testid="sd-save-btn"
            @click="onToggleBookmark"
          >
            <span class="stat-inner">
              <ion-icon :icon="placeSaved ? bookmark : bookmarkOutline" class="ic-22" />
              <span class="l">저장</span>
            </span>
          </button>
          <button type="button" class="sd-stat-btn" @click="onShare">
            <span class="stat-inner">
              <ion-icon :icon="paperPlaneOutline" class="ic-22" />
              <span class="l">공유</span>
            </span>
          </button>
        </section>

        <section class="sd-caption">
          <p v-if="shot.caption" class="body">{{ shot.caption }}</p>
          <div v-if="shot.tags.length > 0" class="tags">
            <span v-for="t in shot.tags" :key="t" class="tag">#{{ t }}</span>
          </div>
          <div class="date">{{ takenAtFullLabel }}</div>
        </section>

        <!--
          댓글 미리보기 — Instagram 패턴. caption 직후, cmt-input 직전에 위치해
          사용자가 페이지를 스크롤하면서도 최근 댓글을 시야 안에 두게 한다.
          backend 가 이미 topComments(상위 N개) + moreCommentsCount 로 자른
          상태로 내려주므로 여기서는 그대로 렌더만 하고, "모두 보기" 또는
          전체 영역 클릭으로 CommentSheet 모달을 열어 본격적인 리스트로 넘긴다.
          댓글이 0개면 cmt-input 의 placeholder("댓글을 남겨보세요...") 가
          진입을 유도하니 이 섹션은 통째로 숨김.
        -->
        <section
          v-if="shot.commentCount > 0 || shot.topComments.length > 0"
          class="comments inline"
          ref="commentsRef"
          data-testid="sd-comments-preview"
        >
          <h4>
            댓글 <span class="cnt">{{ formatCount(shot.commentCount) }}개</span>
          </h4>
          <!-- inline preview 는 최대 1건만. 나머지는 "모두 보기" 로 모달 진입. -->
          <div
            v-for="c in shot.topComments.slice(0, 1)"
            :key="c.id"
            :class="['cmt', c.isReply ? 'is-reply' : '']"
            data-testid="sd-comment"
          >
            <div class="av">
              <img
                v-if="c.authorAvatarUrl"
                :src="c.authorAvatarUrl"
                :alt="c.authorHandle ?? ''"
              />
            </div>
            <div class="body">
              <div class="top">
                <span class="nm">{{ c.authorHandle }}</span>
                <span class="dt">· {{ formatRelativeTime(c.createdAt) }}</span>
              </div>
              <div class="txt">{{ c.content }}</div>
            </div>
          </div>
          <!-- inline 에는 1건만 보이므로 commentCount 가 그 이상이면 항상
               "모두 보기" 링크 노출. 0~1 인 케이스는 스킵. -->
          <button
            v-if="shot.commentCount > 1 || shot.topComments.length === 0"
            type="button"
            class="see-more"
            data-testid="sd-comments-open"
            @click="onOpenComments"
          >댓글 {{ formatCount(shot.commentCount) }}개 모두 보기 ›</button>
        </section>

        <button
          type="button"
          class="cmt-input-wrap"
          data-testid="sd-cmt-trigger"
          aria-label="댓글 작성"
          @click="onOpenComments"
        >
          <span class="me-av">
            <img
              v-if="meAvatarUrl"
              :src="meAvatarUrl"
              alt="me"
            />
          </span>
          <span class="box">댓글을 남겨보세요…</span>
          <span class="send" aria-hidden="true">
            <ion-icon :icon="paperPlaneOutline" class="ic-18" />
          </span>
        </button>

        <!-- task #13: loc-card / scene-card 두 섹션은 사용자 결정으로 제거.
             장소 진입은 헤더의 sd-user 닉네임 / 추후 별도 진입점에서, 원본 장면
             재생도 별도 기능으로 분리될 예정. compare 영역의 토글로 가이드
             이미지를 즉석 확인할 수 있어 페이지 하단의 추가 카드는 잉여. -->

        <!-- task #17: 무한 스크롤 피드 — 추가 카드는 primary shot 과 동일한
             5-section 구조 (compare → sd-user → sd-stats → sd-caption →
             cmt-input). primary 와 같은 CSS 클래스를 그대로 사용해 시각 일관.
             데이터는 FeedPost (필드 이름이 ShotDetail 과 살짝 다르므로 카드별
             바인딩 조정). 좋아요/저장/팔로우/댓글 버튼은 read-only 표시
             (disabled) — primary 만 인터랙티브 (task #17 재량 결정).
             내부 testid 는 primary 와 충돌하지 않도록 외곽 sd-feed-card 만
             부여, 셀렉터 스코프는 querySelectorAll 또는 카드별 .find 로. -->
        <section
          v-if="appendedShots.length > 0"
          class="sd-feed"
          data-testid="sd-feed"
        >
          <article
            v-for="s in appendedShots"
            :key="s.id"
            class="sd-feed-card"
            data-testid="sd-feed-card"
          >
            <!-- 1. compare hero (single-image only — feed posts 는 multi-image carousel 없음) -->
            <section class="compare" :data-mode="feedCardMode(s.id)">
              <img
                v-if="s.dramaSceneImageUrl"
                :src="s.dramaSceneImageUrl"
                class="compare-img is-guide"
                alt="드라마 원본 장면"
              />
              <img
                :src="s.imageUrl"
                class="compare-img is-shot"
                :alt="s.place.name"
              />
              <span v-if="s.dramaSceneImageUrl" class="lbl-chip l">드라마 원본</span>
              <!-- task #26: 우상단 "내 인증샷" 라벨 → 카드별 more 버튼 (appended) -->
              <button
                type="button"
                class="card-more"
                aria-label="더보기"
                @click="onAppendedCardMore"
              >
                <ion-icon :icon="ellipsisHorizontal" class="ic-18" />
              </button>
              <div class="scene-meta">
                <ion-icon :icon="filmOutline" class="ic-16" />{{ s.work.title }}
                <template v-if="s.work.workEpisode"> · {{ s.work.workEpisode }}</template>
                <template v-if="s.work.sceneTimestamp">
                  <span class="sep" />
                  <ion-icon :icon="timeOutline" class="ic-16" />{{ s.work.sceneTimestamp }}
                </template>
              </div>
              <button
                v-if="s.dramaSceneImageUrl"
                type="button"
                class="compare-toggle"
                :aria-pressed="feedCardMode(s.id) === 'guide'"
                @click="onToggleFeedCard(s.id)"
              >
                <ion-icon :icon="eyeOutline" class="ic-16" />
                <span class="compare-toggle-lbl">{{ feedCardMode(s.id) === 'guide' ? '원본으로' : '가이드 보기' }}</span>
              </button>
            </section>

            <!-- 2. sd-user (task #18: 닉네임/팔로우, #21: avatar/sub 클릭) -->
            <section class="sd-user">
              <button
                type="button"
                class="avatar"
                :aria-label="`${s.author.nickname} 프로필 보기`"
                @click="onOpenAppendedAuthor(s)"
              >
                <img
                  v-if="s.author.avatarUrl"
                  :src="s.author.avatarUrl"
                  :alt="s.author.nickname"
                />
              </button>
              <div class="meta">
                <button
                  type="button"
                  class="nm"
                  @click="onOpenAppendedAuthor(s)"
                >
                  {{ s.author.nickname }}
                  <ion-icon v-if="s.author.verified" :icon="checkmarkCircle" class="verified" />
                </button>
                <button
                  type="button"
                  class="sub"
                  :aria-label="`${s.place.name} 지도에서 보기`"
                  @click="onOpenAppendedPlaceMap(s)"
                >
                  <ion-icon :icon="locationOutline" class="ic-16" />
                  {{ s.place.name }} · {{ formatVisitDate(s.createdAt) }}
                </button>
              </div>
              <button
                type="button"
                :class="['follow', s.author.following ? 'on' : '']"
                @click="onToggleAppendedFollow(s)"
              >
                {{ s.author.following ? '팔로잉' : '팔로우' }}
              </button>
            </section>

            <!-- 3. sd-stats (task #18: 좋아요/댓글/저장 인터랙티브) -->
            <section class="sd-stats">
              <button
                type="button"
                :class="['sd-stat-btn', s.liked ? 'liked' : '']"
                @click="onToggleAppendedLike(s)"
              >
                <span class="stat-inner">
                  <ion-icon :icon="s.liked ? heart : heartOutline" class="ic-22" />
                  <span class="n">{{ formatCount(s.likeCount) }}</span>
                  <span class="l">좋아요</span>
                </span>
              </button>
              <button
                type="button"
                class="sd-stat-btn"
                @click="onOpenAppendedComments(s)"
              >
                <span class="stat-inner">
                  <ion-icon :icon="chatbubbleOutline" class="ic-22" />
                  <span class="n">{{ formatCount(s.commentCount) }}</span>
                  <span class="l">댓글</span>
                </span>
              </button>
              <button
                type="button"
                :class="['sd-stat-btn', feedCardSaved(s) ? 'saved' : '']"
                @click="onToggleAppendedSave(s)"
              >
                <span class="stat-inner">
                  <ion-icon :icon="feedCardSaved(s) ? bookmark : bookmarkOutline" class="ic-22" />
                  <span class="l">저장</span>
                </span>
              </button>
              <button type="button" class="sd-stat-btn" disabled>
                <span class="stat-inner">
                  <ion-icon :icon="paperPlaneOutline" class="ic-22" />
                  <span class="l">공유</span>
                </span>
              </button>
            </section>

            <!-- 4. sd-caption (FeedPost 는 tags 미포함 — caption + date 만) -->
            <section class="sd-caption">
              <p v-if="s.caption" class="body">{{ s.caption }}</p>
              <div class="date">{{ formatRelativeTime(s.createdAt) }}</div>
            </section>

            <!-- 5. cmt-input-wrap (task #18: 클릭 시 그 카드의 댓글 시트 열기) -->
            <button
              type="button"
              class="cmt-input-wrap"
              aria-label="댓글 작성"
              @click="onOpenAppendedComments(s)"
            >
              <span class="me-av">
                <img v-if="meAvatarUrl" :src="meAvatarUrl" alt="me" />
              </span>
              <span class="box">댓글을 남겨보세요…</span>
              <span class="send" aria-hidden="true">
                <ion-icon :icon="paperPlaneOutline" class="ic-18" />
              </span>
            </button>
          </article>
        </section>

        <!-- IntersectionObserver sentinel + 상태 안내. nextEndReached 가 true 면
             observer 가 disconnect 되어 더 이상 fetch 가 일어나지 않음. -->
        <div
          ref="sentinelEl"
          class="sd-infinite-sentinel"
          data-testid="sd-infinite-sentinel"
          aria-hidden="true"
        />
        <div
          v-if="nextLoading"
          class="sd-infinite-status"
          data-testid="sd-infinite-loading"
        >
          더 불러오는 중…
        </div>
        <div
          v-else-if="nextEndReached && appendedShots.length > 0"
          class="sd-infinite-status muted"
          data-testid="sd-infinite-end"
        >
          마지막 인증샷이에요
        </div>
        </div><!-- /.sd-loaded -->
      </div><!-- /.sd-scroll (task #16) -->
    </ion-content>
    <CommentSheet
      :photo-id="commentSheetOpen ? commentSheetPhotoId : null"
      :open="commentSheetOpen"
      @close="commentSheetOpen = false"
      @created="onCommentCreated"
    />

    <!-- 인증샷 수정 모달 — Teleport 로 body 에 띄워 ion-page 레이아웃 영향 없이
         iOS 시트 톤. 닫기 X 는 헤더 우상단, 저장은 footer primary. -->
    <Teleport to="body">
      <Transition name="sd-edit-backdrop-fade">
        <div
          v-if="editModalOpen"
          class="sd-edit-backdrop"
          data-testid="sd-edit-backdrop"
          @click="closeEditModal"
        />
      </Transition>
      <Transition name="sd-edit-sheet-slide">
        <div
          v-if="editModalOpen"
          class="sd-edit-sheet"
          role="dialog"
          aria-label="인증샷 수정"
          data-testid="sd-edit-sheet"
        >
          <header class="sd-edit-head">
            <h2>인증샷 수정</h2>
            <button
              type="button"
              class="sd-edit-close"
              aria-label="닫기"
              data-testid="sd-edit-close"
              @click="closeEditModal"
            >
              <ion-icon :icon="closeOutline" class="ic-22" />
            </button>
          </header>

          <div class="sd-edit-body">
            <label class="sd-edit-label">캡션</label>
            <textarea
              v-model="editCaption"
              class="sd-edit-textarea"
              data-testid="sd-edit-caption"
              maxlength="1000"
              rows="4"
              placeholder="이 사진에 대한 한 줄을 적어보세요"
            />

            <label class="sd-edit-label">공개범위</label>
            <div class="sd-edit-radios">
              <label
                v-for="opt in visibilityOptions"
                :key="opt.value"
                class="sd-edit-radio"
              >
                <input
                  type="radio"
                  :value="opt.value"
                  v-model="editVisibility"
                  :data-testid="`sd-edit-visibility-${opt.value}`"
                />
                <div class="sd-edit-radio-text">
                  <span class="lbl">{{ opt.label }}</span>
                  <span class="hint">{{ opt.hint }}</span>
                </div>
              </label>
            </div>
          </div>

          <footer class="sd-edit-foot">
            <button
              type="button"
              class="sd-edit-save"
              data-testid="sd-edit-save"
              :disabled="editSaving"
              @click="onSaveEdit"
            >
              {{ editSaving ? '저장 중…' : '저장' }}
            </button>
          </footer>
        </div>
      </Transition>
    </Teleport>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  IonPage,
  IonContent,
  IonIcon,
  actionSheetController,
  alertController,
} from '@ionic/vue';
import {
  chevronBack,
  ellipsisHorizontal,
  checkmarkCircle,
  filmOutline,
  timeOutline,
  locationOutline,
  heart,
  heartOutline,
  chatbubbleOutline,
  bookmark,
  bookmarkOutline,
  paperPlaneOutline,
  eyeOutline,
  closeOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useShotDetailStore, type PhotoVisibility } from '@/stores/shotDetail';
import { useSavedStore } from '@/stores/saved';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import CommentSheet from '@/components/comment/CommentSheet.vue';
import {
  formatRelativeTime,
  formatVisitDate,
} from '@/utils/formatRelativeTime';

const props = defineProps<{ id: string | number }>();

const router = useRouter();
const { showInfo, showError } = useToast();
const shotStore = useShotDetailStore();
const savedStore = useSavedStore();
const uiStore = useUiStore();
const authStore = useAuthStore();
const { shot, loading, error, appendedShots, nextLoading, nextEndReached } = storeToRefs(shotStore);

const commentsRef = ref<HTMLElement | null>(null);
const carouselEl = ref<HTMLElement | null>(null);
const currentSlide = ref(0);
const commentSheetOpen = ref(false);
// task #18: 댓글 시트가 어떤 post 의 댓글을 보여주는지 트래킹. primary 의
// shot.id 또는 appendedShots 의 한 항목 id. null = 미오픈 / 미선택.
const commentSheetPhotoId = ref<number | null>(null);

// task #11/#12: compare hero swapped from a clip-path split view to a toggle.
// Default = "shot" (user's photo). Tapping the floating "가이드 보기" button
// flips to "guide" (drama scene). aria-pressed mirrors the boolean for SR.
type CompareMode = 'shot' | 'guide';
const compareMode = ref<CompareMode>('shot');
function onToggleCompare(): void {
  compareMode.value = compareMode.value === 'guide' ? 'shot' : 'guide';
}

// task #15: per-card compare mode for the infinite-scroll feed below the
// primary shot. Keyed by shot id. Default 'shot' (user's photo). Reactive
// via a Map exposed through a getter/setter so template lookups don't
// trigger reactivity issues on the Map itself.
const feedCardModes = ref<Record<number, CompareMode>>({});
function feedCardMode(id: number): CompareMode {
  return feedCardModes.value[id] ?? 'shot';
}
function onToggleFeedCard(id: number): void {
  feedCardModes.value = {
    ...feedCardModes.value,
    [id]: feedCardMode(id) === 'guide' ? 'shot' : 'guide',
  };
}

// IntersectionObserver-driven infinite scroll. The sentinel sits below
// the comment input; when it scrolls into view, ask the store for the
// next page. Observer is set up after the primary shot lands and
// disconnected on unmount / on `nextEndReached`.
const sentinelEl = ref<HTMLElement | null>(null);
let infiniteObserver: IntersectionObserver | null = null;

function teardownInfiniteObserver(): void {
  if (infiniteObserver) {
    infiniteObserver.disconnect();
    infiniteObserver = null;
  }
}

function setupInfiniteObserver(): void {
  teardownInfiniteObserver();
  if (typeof window === 'undefined' || typeof window.IntersectionObserver === 'undefined') {
    // jsdom 환경 또는 매우 오래된 브라우저 — observer 없이 조용히 스킵.
    return;
  }
  if (!sentinelEl.value) return;
  infiniteObserver = new window.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (shotStore.nextEndReached || shotStore.nextLoading) continue;
        void shotStore.loadNext();
      }
    },
    { rootMargin: '300px 0px' },
  );
  infiniteObserver.observe(sentinelEl.value);
}

// 첫 shot 이 도착한 다음 sentinel DOM 이 마운트되므로, shot 변화에 맞춰
// observer 재설정. shot.id 가 바뀌면 (예: route 파라미터 변경) 새 시드로
// 다시 시작. immediate=true 로 두어, store 가 prepopulated (테스트 / 캐시
// 시드) 상태로 마운트되는 케이스에서도 첫 렌더 직후 observer 가 설치되게.
watch(
  () => shot.value?.id,
  async (id) => {
    if (id == null) return;
    // DOM mount 까지 한 tick 기다림 — sentinel ref 가 아직 null 일 수 있음.
    await nextTick();
    setupInfiniteObserver();
  },
  { immediate: true },
);

// 끝 도달 시 observer 더 이상 필요 없음 — 즉시 disconnect.
watch(
  () => shotStore.nextEndReached,
  (done) => {
    if (done) teardownInfiniteObserver();
  },
);

// Always fall back to the lead frame as a length-1 list so the template can
// treat `images` as non-empty regardless of how old the backend response is.
// Pre-task-#44 responses (single PlacePhoto, no PlacePhotoImage rows yet)
// still render as a single-image post via the fallback.
const images = computed(() => {
  if (!shot.value) return [] as { id: number; imageUrl: string; imageOrderIndex: number }[];
  if (shot.value.images && shot.value.images.length > 0) {
    return shot.value.images;
  }
  return [{ id: shot.value.id, imageUrl: shot.value.imageUrl, imageOrderIndex: 0 }];
});

function onCarouselScroll(e: Event): void {
  const el = e.target as HTMLElement;
  if (el.clientWidth === 0) return;
  const idx = Math.round(el.scrollLeft / el.clientWidth);
  if (idx !== currentSlide.value) currentSlide.value = idx;
}

// Place-level save reuses the global savedStore contract so the bookmark
// state stays in sync with every other bookmark site (Feed / Place detail /
// Map / Saved). No dedicated "photo bookmark" concept.
const placeSaved = computed(() =>
  shot.value ? savedStore.isSaved(shot.value.place.id) : false,
);

const meAvatarUrl = computed(() => authStore.user?.avatarUrl ?? null);

// 본인 사진일 땐 버튼 자체가 v-if 로 숨겨지므로 isMe 분기를 두지 않는다.
const authorActionLabel = computed(() => {
  const a = shot.value?.author;
  if (!a) return '';
  return a.following ? '팔로잉' : '팔로우';
});

// Short "YYYY.MM.DD" for the user-meta line + a longer label for the caption
// footer. Backend only ships `createdAt` (ISO); the design's "오후 6시 24분"
// long form is dropped — showing the relative-time marker instead keeps the
// copy short and consistent with FeedPage.
const takenAtLabel = computed(() =>
  shot.value ? formatVisitDate(shot.value.createdAt) : '',
);
const takenAtFullLabel = computed(() =>
  shot.value ? formatRelativeTime(shot.value.createdAt) : '',
);

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return n.toLocaleString('ko-KR');
  return String(n);
}

function onBack(): void {
  router.back();
}

function onShare(): void {
  const s = shot.value;
  if (!s) return;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  uiStore.openShareSheet({
    title: `${s.author.nickname}의 인증샷`,
    description: `${s.work.title} · ${s.place.name}`,
    imageUrl: s.imageUrl,
    url: `${origin}/shot/${s.id}`,
  });
}

// 인증샷 수정 모달 — primary shot 더보기 → 수정 행을 누르면 열린다. caption /
// 공개범위 두 필드만 작성자 본인이 변경 가능. 모달 닫힘 시 working 값을 그대로
// 두어 사용자가 실수로 닫아도 다시 열면 입력이 살아 있음 — 명시적 저장이나
// 갱신 후에만 reset.
const editModalOpen = ref(false);
const editCaption = ref('');
const editVisibility = ref<PhotoVisibility>('PUBLIC');
const editSaving = ref(false);

const visibilityOptions: Array<{ value: PhotoVisibility; label: string; hint: string }> = [
  { value: 'PUBLIC', label: '전체 공개', hint: '누구나 볼 수 있어요' },
  { value: 'FOLLOWERS', label: '팔로워만', hint: '내 팔로워에게만 보여요' },
  { value: 'PRIVATE', label: '나만 보기', hint: '나만 볼 수 있어요' },
];

function openEditModal(): void {
  const s = shot.value;
  if (!s) return;
  editCaption.value = s.caption ?? '';
  editVisibility.value = s.visibility;
  editModalOpen.value = true;
}

function closeEditModal(): void {
  editModalOpen.value = false;
}

async function onSaveEdit(): Promise<void> {
  if (editSaving.value) return;
  editSaving.value = true;
  try {
    const ok = await shotStore.updateContent({
      caption: editCaption.value.trim().length > 0 ? editCaption.value : null,
      visibility: editVisibility.value,
    });
    if (ok) {
      closeEditModal();
      await showInfo('인증샷이 수정됐어요');
    } else if (error.value) {
      await showError(error.value);
    }
  } finally {
    editSaving.value = false;
  }
}

// 작성자 더보기 메뉴: 본인 인증샷에는 수정 / 삭제 행 노출, 남 인증샷에는
// 아직 부여할 메뉴가 없어 placeholder 토스트 유지(추후 신고 등이 들어갈 자리).
async function onCardMore(): Promise<void> {
  const s = shot.value;
  if (!s) return;
  if (!s.author.isMe) {
    await showInfo('더보기 메뉴는 곧 공개됩니다');
    return;
  }
  const sheet = await actionSheetController.create({
    header: '인증샷',
    buttons: [
      {
        text: '수정',
        icon: createOutline,
        handler: () => {
          openEditModal();
        },
      },
      {
        text: '삭제',
        role: 'destructive',
        icon: trashOutline,
        handler: () => {
          void confirmDelete();
        },
      },
      { text: '취소', role: 'cancel' },
    ],
  });
  await sheet.present();
}

// 삭제 확인 → API 호출 → 성공 시 ShotDetail 자체가 의미 없으므로 router.back.
// 백엔드가 자식 행(좋아요/댓글) cascade 정리, 프런트는 별도 invalidation
// 필요 없음 (다른 페이지가 재진입할 때 어차피 fetch 다시 함).
async function confirmDelete(): Promise<void> {
  const alert = await alertController.create({
    header: '인증샷을 삭제할까요?',
    message: '삭제한 인증샷은 다시 복구할 수 없어요.',
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: () => {
          void performDelete();
        },
      },
    ],
  });
  await alert.present();
}

async function performDelete(): Promise<void> {
  const ok = await shotStore.deleteShot();
  if (!ok) {
    if (error.value) await showError(error.value);
    return;
  }
  await showInfo('인증샷이 삭제됐어요');
  router.back();
}

// 추가 카드(appendedShots) 의 더보기는 작성자 컨텍스트가 primary 와 다른
// 다른 사람 인증샷이라 수정/삭제 메뉴를 띄우면 안 됨. 추후 신고/숨기기
// 같은 viewer-side 액션이 들어올 자리라 일단 placeholder 유지.
async function onAppendedCardMore(): Promise<void> {
  await showInfo('더보기 메뉴는 곧 공개됩니다');
}

async function onOpenAuthor(): Promise<void> {
  const a = shot.value?.author;
  if (!a || a.id == null) return;
  // /user/:id 페이지가 isMe 인 경우 내부에서 /profile 로 리다이렉트하므로
  // 여기서 별도 분기 없이 같은 라우트로 보낸다.
  await router.push(`/user/${a.id}`);
}

async function onAuthorAction(): Promise<void> {
  // 본인 사진은 v-if 로 버튼 자체가 안 보여 호출되지 않는 경로지만, 안전망으로
  // shot 미로드 가드만 두고 팔로우 토글로 직진.
  if (!shot.value?.author) return;
  await shotStore.toggleAuthorFollow();
  if (error.value) await showError(error.value);
}

async function onToggleLike(): Promise<void> {
  await shotStore.toggleLike();
}

async function onToggleBookmark(): Promise<void> {
  if (!shot.value) return;
  const placeId = shot.value.place.id;
  // Save flow mirrors Feed/Place/Map: unsaved → collection picker; already
  // saved → one-shot unsave via savedStore.
  if (savedStore.isSaved(placeId)) {
    await savedStore.toggleSave(placeId);
    return;
  }
  uiStore.openCollectionPicker(placeId);
}

function onOpenComments(): void {
  if (!shot.value) return;
  commentSheetPhotoId.value = shot.value.id;
  commentSheetOpen.value = true;
}

function onCommentCreated(): void {
  // task #18: 시트가 어떤 post 의 것인지에 따라 그 항목의 commentCount 만 +1.
  const id = commentSheetPhotoId.value;
  if (id == null) return;
  if (shot.value && shot.value.id === id) {
    shot.value.commentCount += 1;
    return;
  }
  const found = shotStore.appendedShots.find((p) => p.id === id);
  if (found) found.commentCount += 1;
}

// ---------- task #18: appended-card interaction handlers ----------
async function onToggleAppendedLike(post: { id: number }): Promise<void> {
  await shotStore.toggleAppendedLike(post.id);
}

async function onToggleAppendedSave(post: { place: { id: number } }): Promise<void> {
  // primary 와 동일 정책 — saved → toggleSave (즉시 unsave), unsaved →
  // collection picker 시트 열기. Place id 기반.
  const placeId = post.place.id;
  if (savedStore.isSaved(placeId)) {
    await savedStore.toggleSave(placeId);
    return;
  }
  uiStore.openCollectionPicker(placeId);
}

async function onToggleAppendedFollow(post: { author: { userId: number } }): Promise<void> {
  await shotStore.toggleAppendedFollow(post.author.userId);
}

function onOpenAppendedComments(post: { id: number }): void {
  commentSheetPhotoId.value = post.id;
  commentSheetOpen.value = true;
}

async function onOpenAppendedAuthor(post: { author: { userId: number } }): Promise<void> {
  await router.push(`/user/${post.author.userId}`);
}

// task #21: avatar / sub(place) 클릭 라우팅. avatar 는 기존 onOpenAuthor /
// onOpenAppendedAuthor 와 동일 핸들러 재사용. sub 는 신규 — place-id 를
// MapPage 의 selectedId query 로 보내 지도에서 해당 장소 자동 선택되도록.
async function onOpenPlaceMap(): Promise<void> {
  const placeId = shot.value?.place.id;
  if (placeId == null) return;
  await router.push({ path: '/map', query: { selectedId: String(placeId) } });
}

async function onOpenAppendedPlaceMap(post: { place: { id: number } }): Promise<void> {
  await router.push({ path: '/map', query: { selectedId: String(post.place.id) } });
}

// 카드별 saved 상태는 savedStore 가 single source — server snapshot(`s.saved`)
// 보다 client store 가 더 신뢰할 수 있음 (방금 저장/해제한 결과 반영).
function feedCardSaved(post: { place: { id: number } }): boolean {
  return savedStore.isSaved(post.place.id);
}

async function loadDetail(): Promise<void> {
  const id = Number(props.id);
  if (!Number.isFinite(id)) return;
  await shotStore.fetchShot(id);
}

onMounted(loadDetail);
onUnmounted(() => {
  teardownInfiniteObserver();
  shotStore.reset();
});

// Re-fetch on route-level param change — ion-router may reuse the same
// component instance when navigating between /shot/:id URLs.
watch(
  () => props.id,
  (newId, oldId) => {
    if (newId !== oldId) void loadDetail();
  },
);

// Reset the carousel to the first slide whenever a new shot lands, so
// navigating between posts doesn't keep the old index. Also reset the
// compare toggle to "shot" + clear any feed-card toggle states so each
// fresh primary post starts clean.
watch(
  () => shot.value?.id,
  () => {
    currentSlide.value = 0;
    compareMode.value = 'shot';
    feedCardModes.value = {};
    if (carouselEl.value) carouselEl.value.scrollLeft = 0;
  },
);
</script>

<style scoped>
ion-content.sd-content {
  --background: #ffffff;
}

/* task #16: .sd-scroll is the always-rendered scroll container. Bottom
   padding gives breathing room past the last appended shot / sentinel. */
.sd-scroll {
  overflow-y: auto;
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
  height: 100%;
}
.sd-loaded {
  /* No own padding/scroll — it's just a state wrapper inside .sd-scroll. */
}

/* Sticky top header — stays pinned while the user scrolls through the
   primary post + appended feed. Sits above all in-page content (z-index 30)
   but BELOW Ionic modals like CommentSheet (which Ionic places at 1000+). */
.sd-top {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  padding: calc(8px + env(safe-area-inset-top)) 16px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(14px) saturate(160%);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}
/* Feed-detail tone (rounded square neutral chip) instead of the previous
   floating-on-photo dark circle — sticky header reads against any content
   underneath without needing the dark contrast. */
.sd-top .ic-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
/* task #26: sticky header 우측 액션 영역 사라짐 — `.sd-top .right` 룰도 정리. */

/* Multi-image carousel hero */
.sd-carousel {
  position: relative;
  width: 100%;
}
.sd-carousel .carousel-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.sd-carousel .carousel-slide {
  flex: 0 0 100%;
  scroll-snap-align: start;
  aspect-ratio: 4 / 5;
  background: #000000;
  position: relative;
  overflow: hidden;
}
.sd-carousel .carousel-slide > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sd-carousel .carousel-slide .compare {
  width: 100%;
  height: 100%;
}
.sd-carousel .carousel-dots {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  pointer-events: none;
}
.sd-carousel .carousel-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
}
.sd-carousel .carousel-dots .dot.active {
  background: #ffffff;
  width: 18px;
  border-radius: 3px;
}
.sd-carousel .carousel-count {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 12px;
  pointer-events: none;
}

/* Compare hero — task #12: clip-path split → toggle (mirrors design/pages/
   13-feed-detail.html). Two stacked images opacity-swap on data-mode and
   the floating "가이드 보기" button flips the active layer. */
.compare {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  background: #000000;
  overflow: hidden;
}
.compare .compare-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 220ms ease-out;
}
.compare[data-mode="shot"] .compare-img.is-shot { opacity: 1; }
.compare[data-mode="guide"] .compare-img.is-guide { opacity: 1; }

.lbl-chip {
  position: absolute;
  z-index: 3;
  font-size: 10.5px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 999px;
  backdrop-filter: blur(8px);
  letter-spacing: -0.01em;
}
/* task #16: sticky header now takes layout space, so labels no longer
   need the safe-area + 60px offset — sit at the natural photo-top edge. */
.lbl-chip.l {
  top: 12px;
  left: 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
}
/* task #26: lbl-chip.r ("내 인증샷") 자리는 .card-more 버튼이 차지.
   .lbl-chip.l ("드라마 원본") 만 mode-bind 로 노출/숨김. */
.compare[data-mode="shot"] .lbl-chip.l { display: none; }

/* task #26: 카드별 더보기 버튼 — primary + 추가 카드 우상단 공통.
   primary blue chip 톤은 라벨에서 더이상 안 쓰므로 검정 반투명 ic-btn
   톤으로 통일 (compare-toggle 과 같은 visual 무게). */
.card-more {
  position: absolute;
  top: 12px;
  right: 14px;
  z-index: 4;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 160ms ease-out;
}
.card-more:hover { background: rgba(0, 0, 0, 0.72); }
.card-more:active { transform: translateY(1px); }

/* Floating "가이드 보기" / "원본으로" toggle — bottom-right above scene-meta. */
.compare-toggle {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  border: none;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background-color 160ms ease-out;
}
.compare-toggle:hover { background: rgba(0, 0, 0, 0.78); }
.compare-toggle:active { transform: translateY(1px); }
.compare-toggle[aria-pressed="true"] { background: rgba(20, 188, 237, 0.92); }

.scene-meta {
  position: absolute;
  left: 14px;
  bottom: 14px;
  z-index: 3;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 700;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 8px;
}
.scene-meta .sep {
  width: 1px;
  height: 10px;
  background: rgba(255, 255, 255, 0.3);
}

/* User header */
.sd-user {
  padding: 16px 20px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--fr-line-soft);
}
/* task #21: .avatar 는 이제 <button> — 클릭 시 작성자 프로필로 이동.
   button native 스타일 (border/padding/background) 을 모두 reset 하고
   기존 시각(원형 + 회색 placeholder) 유지. */
.avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  overflow: hidden;
  background: #eeeeee;
  flex-shrink: 0;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.avatar:disabled { cursor: default; }
.avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sd-user .meta { flex: 1; min-width: 0; }
.sd-user .nm {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--fr-ink);
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font-family: inherit;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}
.sd-user .nm:disabled { cursor: default; }
.sd-user .nm:hover:not(:disabled) { color: var(--fr-ink-2); }
.sd-user .verified {
  width: 14px;
  height: 14px;
  color: var(--fr-primary);
}
/* task #21: .sub 는 이제 <button> — 클릭 시 /map?selectedId 로 이동.
   button native 스타일 reset 하고 기존 시각(작은 회색 텍스트 + location icon) 유지. */
.sd-user .sub {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  padding: 0;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  -webkit-appearance: none;
  appearance: none;
}
.sd-user .sub:hover { color: var(--fr-ink-2); }
.sd-user .follow {
  height: 32px;
  padding: 0 14px;
  border-radius: 10px;
  background: var(--fr-primary-soft);
  color: var(--fr-primary);
  border: 1px solid transparent;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}
/* 팔로잉 상태 — Instagram 의 "Following" 버튼처럼 약하게 표현해
   언팔 가능한 토글임을 시각적으로 알림. 평상시(팔로우)는 강조 색. */
.sd-user .follow.on {
  background: #ffffff;
  border-color: var(--fr-line);
  color: var(--fr-ink-2);
}

/* Stats bar */
.sd-stats {
  display: flex;
  gap: 6px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--fr-line-soft);
}
.sd-stat-btn {
  flex: 1;
  min-width: 0;
  background: var(--fr-bg-muted);
  border: none;
  padding: 10px 4px;
  border-radius: 12px;
  color: var(--fr-ink);
  cursor: pointer;
  /* WebKit <button> elements can't reliably be flex containers, so the
     vertical stack lives on the inner <span>. */
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
}
.sd-stat-btn .stat-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  line-height: 1.2;
}
.sd-stat-btn .stat-inner ion-icon {
  display: block;
  flex-shrink: 0;
}
.sd-stat-btn .n {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.sd-stat-btn .l {
  font-size: 10.5px;
  color: var(--fr-ink-3);
  font-weight: 700;
}
.sd-stat-btn.liked {
  background: #fff1f2;
  color: var(--fr-coral);
}
.sd-stat-btn.liked .l { color: var(--fr-coral); }
.sd-stat-btn.saved {
  background: #fff7e6;
  color: #d97706;
}
.sd-stat-btn.saved .l { color: #d97706; }

/* Caption */
.sd-caption {
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fr-ink);
}
.sd-caption .body { margin: 0; }
.sd-caption .tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sd-caption .tag {
  color: var(--fr-primary);
  font-weight: 700;
}
.sd-caption .date {
  margin-top: 10px;
  font-size: 11px;
  color: var(--fr-ink-4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Comments */
.comments { padding: 0 20px 24px; }
.comments h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fr-ink);
}
.comments h4 .cnt {
  color: var(--fr-ink-4);
  font-weight: 700;
  font-size: 12px;
}
.cmt { display: flex; gap: 10px; padding: 10px 0; }
.cmt.is-reply { padding-left: 42px; }
.cmt .av {
  width: 32px; height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #eeeeee;
}
.cmt .av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cmt .body { flex: 1; min-width: 0; }
.cmt .top {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}
.cmt .nm { font-weight: 800; color: var(--fr-ink); }
.cmt .dt { color: var(--fr-ink-4); font-size: 10.5px; }
.cmt .txt {
  font-size: 13px;
  color: var(--fr-ink);
  margin-top: 3px;
  line-height: 1.5;
}
.cmt .act-row {
  margin-top: 6px;
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: var(--fr-ink-3);
  font-weight: 700;
}
.cmt .like-btn {
  display: flex;
  align-items: center;
  gap: 3px;
}
.cmt .like-btn.on { color: var(--fr-coral); }
.see-more {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 0 0;
  border: none;
  background: transparent;
  font-size: 12.5px;
  color: var(--fr-ink-3);
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
}
.see-more:hover { color: var(--fr-ink-2); }

/* Inline preview 모드 — caption 직후에 컴팩트하게 노출. h4 / 댓글 한 건의
   여백을 살짝 줄여서 페이지 흐름을 끊지 않고 1-2개만 슬쩍 보여줌. 본격
   리스트 + 답글은 CommentSheet 모달이 담당. */
.comments.inline { padding: 0 20px 8px; }
.comments.inline h4 { margin-bottom: 6px; }
.comments.inline .cmt { padding: 6px 0; }
.comments.inline .cmt .txt { -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }

/* Inline comment-compose row — sd-caption 과 loc-card 사이에 끼어
   사용자가 본문 읽은 직후 자연스럽게 댓글을 남기게. Instagram/Threads/YouTube
   처럼 외곽 라운드/보더 없이, 위쪽 구분선만으로 섹션 분리. 안쪽 input 만
   살짝 라운드(10px) 줘서 입력란임을 시각적으로 표시.
   바 전체가 트리거 — 탭하면 CommentSheet 모달이 열린다 (FeedDetail/Gallery
   와 동일 패턴). 그래서 <button> 으로 두고 button 기본 스타일은 reset. */
.cmt-input-wrap {
  width: 100%;
  margin: 8px 0 0;
  padding: 12px 16px;
  background: #ffffff;
  border: none;
  border-top: 1px solid var(--fr-line);
  border-bottom: 1px solid var(--fr-line);
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.cmt-input-wrap .me-av {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: #eeeeee;
  flex-shrink: 0;
}
.cmt-input-wrap .me-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cmt-input-wrap .box {
  flex: 1;
  background: var(--fr-bg-muted);
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 13px;
  color: var(--fr-ink-4);
}
.cmt-input-wrap .send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--fr-primary);
  color: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}

/* ====================================================================
   Infinite-scroll feed (task #15/#17) — appended shot cards below the
   primary post. task #17: cards now reuse primary's 5-section markup
   (.compare / .sd-user / .sd-stats / .sd-caption / .cmt-input-wrap),
   so the inner styles inherit from primary's rules. This block only
   adds the outer separator + the read-only disabled-state look.
   ==================================================================== */
.sd-feed {
  border-top: 8px solid var(--fr-line-soft);
}
.sd-feed-card {
  border-bottom: 8px solid var(--fr-line-soft);
}
.sd-feed-card:last-child { border-bottom: none; }

/* task #18 — appended card buttons are now interactive. Only 공유 stays
   disabled (matches primary which has no real share endpoint either). The
   disabled-state look stays identical to enabled (opacity:1) so the layout
   doesn't shift between cards. */
.sd-feed-card .sd-stat-btn:disabled {
  cursor: default;
  opacity: 1;
}

.sd-infinite-sentinel {
  width: 100%;
  height: 1px;
}
.sd-infinite-status {
  padding: 18px 20px;
  text-align: center;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--fr-ink-3);
  letter-spacing: -0.01em;
}
.sd-infinite-status.muted {
  color: var(--fr-ink-4);
  font-weight: 600;
}

/* Loading / error placeholders (task #39). Kept minimal — the design
   doesn't specify a skeleton shape, so plain centered copy keeps the
   page quiet while the fetch is in flight or fails. */
.sd-placeholder {
  padding: 120px 24px;
  text-align: center;
  color: var(--fr-ink-3);
  font-size: 14px;
}
.sd-placeholder.error {
  color: var(--fr-coral);
}

/* ---------- 인증샷 수정 모달 (Teleport) ---------- */
.sd-edit-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.5);
}
.sd-edit-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  background: #ffffff;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom));
  box-shadow: 0 -12px 32px rgba(15, 23, 42, 0.18);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.sd-edit-sheet-slide-enter-from,
.sd-edit-sheet-slide-leave-to { transform: translateY(100%); }
.sd-edit-sheet-slide-enter-active,
.sd-edit-sheet-slide-leave-active {
  transition: transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sd-edit-backdrop-fade-enter-from,
.sd-edit-backdrop-fade-leave-to { opacity: 0; }
.sd-edit-backdrop-fade-enter-active,
.sd-edit-backdrop-fade-leave-active { transition: opacity 0.2s ease; }

.sd-edit-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0 12px;
  border-bottom: 1px solid var(--fr-line);
}
.sd-edit-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--fr-ink);
}
.sd-edit-close {
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
.sd-edit-close:hover { background: var(--fr-bg-muted); color: var(--fr-ink); }

.sd-edit-body {
  padding: 14px 4px 4px;
  overflow-y: auto;
}
.sd-edit-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink-3);
  margin: 12px 0 6px;
}
.sd-edit-textarea {
  width: 100%;
  resize: none;
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--fr-ink);
  background: var(--fr-bg-muted, #f5f7fa);
}
.sd-edit-textarea:focus { outline: 2px solid var(--fr-primary); outline-offset: 1px; }

.sd-edit-radios {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sd-edit-radio {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--fr-line);
  border-radius: 12px;
  cursor: pointer;
}
.sd-edit-radio input[type='radio'] { accent-color: var(--fr-primary); }
.sd-edit-radio-text { display: flex; flex-direction: column; }
.sd-edit-radio-text .lbl { font-size: 14px; font-weight: 700; color: var(--fr-ink); }
.sd-edit-radio-text .hint { font-size: 12px; color: var(--fr-ink-3); }

.sd-edit-foot { padding: 12px 0 0; }
.sd-edit-save {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: 14px;
  background: var(--fr-primary);
  color: #ffffff;
  font: inherit;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}
.sd-edit-save:disabled { background: var(--fr-line); cursor: not-allowed; }
</style>
