<template>
  <!-- ProfilePage 의 메뉴 시트와 동일 패턴 — Ionic actionSheetController 는 header 에
       닫기 아이콘을 꽂을 슬롯이 없어 Teleport + 커스텀 시트로 구현. 취소 버튼은
       하단 별도 행이 아니라 헤더 우상단 X 아이콘으로 일원화. 백드롭 탭으로도 닫힘. -->
  <Teleport to="body">
    <Transition name="pms-backdrop-fade">
      <div
        v-if="open"
        class="pms-backdrop"
        data-testid="post-more-backdrop"
        @click="$emit('close')"
      />
    </Transition>
    <Transition name="pms-sheet-slide">
      <div
        v-if="open"
        class="pms-sheet"
        role="dialog"
        aria-label="인증샷 메뉴"
        data-testid="post-more-sheet"
      >
        <header class="pms-head">
          <h2>인증샷</h2>
          <button
            type="button"
            class="pms-close"
            aria-label="닫기"
            data-testid="post-more-close"
            @click="$emit('close')"
          >
            <ion-icon :icon="closeOutline" class="ic-22" />
          </button>
        </header>

        <div class="pms-body">
          <template v-if="isOwn">
            <button
              type="button"
              class="pms-row"
              data-testid="post-more-edit"
              @click="$emit('edit')"
            >
              <span class="pms-ico">
                <ion-icon :icon="createOutline" class="ic-20" />
              </span>
              <span class="pms-label">수정</span>
            </button>
            <button
              type="button"
              class="pms-row danger"
              data-testid="post-more-delete"
              @click="$emit('delete')"
            >
              <span class="pms-ico">
                <ion-icon :icon="trashOutline" class="ic-20" />
              </span>
              <span class="pms-label">삭제</span>
            </button>
          </template>
          <p v-else class="pms-empty" data-testid="post-more-empty">
            더보기 메뉴는 곧 공개됩니다
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { closeOutline, createOutline, trashOutline } from 'ionicons/icons';

defineProps<{
  open: boolean;
  /** 사용자가 이 인증샷의 작성자인지. true 면 수정/삭제 행 노출, false 면 placeholder. */
  isOwn: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
}>();
</script>

<style scoped>
.pms-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, 0.5);
}
.pms-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 61;
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  padding: 8px 0 calc(12px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgba(15, 23, 42, 0.18);
}
.pms-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 8px 20px;
}
.pms-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.pms-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: transparent;
  color: var(--fr-ink-3);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.pms-close:hover { background: var(--fr-bg-muted); color: var(--fr-ink-2); }

.pms-body {
  padding: 4px 12px 4px;
}
.pms-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px;
  background: transparent;
  border: none;
  border-radius: 12px;
  font: inherit;
  cursor: pointer;
  text-align: left;
  color: var(--fr-ink);
}
.pms-row:hover { background: var(--fr-bg-muted); }
.pms-row.danger { color: var(--fr-coral); }
.pms-ico {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.pms-label {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.pms-empty {
  margin: 0;
  padding: 22px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--fr-ink-3);
}

/* Animations — backdrop fade + sheet slide-up. */
.pms-backdrop-fade-enter-active,
.pms-backdrop-fade-leave-active {
  transition: opacity 200ms ease-out;
}
.pms-backdrop-fade-enter-from,
.pms-backdrop-fade-leave-to {
  opacity: 0;
}
.pms-sheet-slide-enter-active,
.pms-sheet-slide-leave-active {
  transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.pms-sheet-slide-enter-from,
.pms-sheet-slide-leave-to {
  transform: translateY(100%);
}
</style>
