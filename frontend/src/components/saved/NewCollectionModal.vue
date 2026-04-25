<template>
  <Teleport to="body">
    <Transition name="backdrop-fade">
      <div
        v-if="open"
        class="new-coll-backdrop"
        data-testid="new-coll-backdrop"
        @click="onClose"
      />
    </Transition>
    <Transition name="dialog-pop">
      <div
        v-if="open"
        class="new-coll-sheet"
        role="dialog"
        :aria-label="dialogLabel"
      >
        <header class="nc-head">
          <h2>{{ headingText }}</h2>
          <button
            type="button"
            class="nc-close"
            aria-label="닫기"
            @click="onClose"
          >
            <ion-icon :icon="closeOutline" class="ic-20" />
          </button>
        </header>
        <div class="nc-body">
          <label class="nc-label" for="new-coll-name">컬렉션 이름</label>
          <input
            id="new-coll-name"
            ref="inputRef"
            v-model="name"
            type="text"
            class="nc-input"
            placeholder="예: 다음 여행 · 강릉"
            maxlength="20"
            enterkeyhint="done"
            data-testid="new-coll-input"
            @keydown.enter.prevent="onSubmit"
          />
          <p class="nc-hint">{{ hintText }}</p>
        </div>
        <div class="nc-actions">
          <button
            type="button"
            class="nc-btn cancel"
            @click="onClose"
          >
            취소
          </button>
          <button
            type="button"
            class="nc-btn primary"
            :disabled="!canSubmit || submitting"
            data-testid="new-coll-submit"
            @click="onSubmit"
          >
            {{ submitText }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { IonIcon } from '@ionic/vue';
import { closeOutline } from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';
import { useSavedStore, type SavedCollection } from '@/stores/saved';
import { useToast } from '@/composables/useToast';

// Emits `created(collection)` so consumers (e.g. CollectionPicker) can react
// to a fresh collection — typically by auto-selecting it. `renamed` fires after
// a successful rename so consumers can refresh their local view if needed.
const emit = defineEmits<{
  created: [collection: SavedCollection];
  renamed: [collection: { id: number; name: string }];
}>();

const uiStore = useUiStore();
const savedStore = useSavedStore();
const {
  newCollectionModalOpen: open,
  newCollectionModalMode: mode,
  newCollectionModalRenameTarget: renameTarget,
} = storeToRefs(uiStore);
const { showError, showInfo } = useToast();

const name = ref('');
const submitting = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const isRename = computed(() => mode.value === 'rename');
const headingText = computed(() => (isRename.value ? '이름 변경' : '새 컬렉션'));
const dialogLabel = computed(() =>
  isRename.value ? '컬렉션 이름 변경' : '새 컬렉션 만들기',
);
const hintText = computed(() =>
  isRename.value
    ? '20자 이내로 변경할 수 있어요.'
    : '저장한 장소를 이 컬렉션으로 분류할 수 있어요.',
);
const submitText = computed(() => {
  if (submitting.value) return isRename.value ? '저장 중…' : '만드는 중…';
  return isRename.value ? '저장' : '만들기';
});

const canSubmit = computed(() => {
  const trimmed = name.value.trim();
  if (trimmed.length === 0) return false;
  // Rename 일 때, 동일 이름이면 의미 없으니 비활성화.
  if (isRename.value && renameTarget.value && trimmed === renameTarget.value.name) {
    return false;
  }
  return true;
});

// Autofocus when the modal opens; also reset state on close so the next open
// starts clean regardless of the previous outcome. rename 모드면 기존 이름을
// 미리 채워서 사용자가 일부만 수정할 수 있게 한다.
watch(open, async (v) => {
  if (v) {
    name.value = isRename.value && renameTarget.value ? renameTarget.value.name : '';
    submitting.value = false;
    await nextTick();
    inputRef.value?.focus();
    inputRef.value?.select();
  }
});

function onClose(): void {
  if (submitting.value) return; // lock while request is in flight
  uiStore.closeNewCollectionModal();
}

async function onSubmit(): Promise<void> {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    if (isRename.value) {
      const target = renameTarget.value;
      if (!target) return;
      const ok = await savedStore.renameCollection(target.id, name.value);
      if (!ok) {
        if (savedStore.error) await showError(savedStore.error);
        return;
      }
      await showInfo('이름이 변경되었어요');
      uiStore.closeNewCollectionModal();
      emit('renamed', { id: target.id, name: name.value.trim() });
      return;
    }
    const created = await savedStore.createCollection(name.value);
    if (!created) {
      if (savedStore.error) await showError(savedStore.error);
      return;
    }
    await showInfo('컬렉션이 추가되었어요');
    uiStore.closeNewCollectionModal();
    emit('created', created);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
/* Mirrors SavedPage's task #27 dialog-pop look. Kept identical so both entry
   points (SavedPage card + CollectionPicker CTA) render the same dialog. */
.new-coll-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: calc(84px + env(safe-area-inset-bottom, 0px));
  z-index: 60;
  background: rgba(15, 23, 42, 0.5);
}
.new-coll-sheet {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(340px, calc(100vw - 40px));
  max-height: calc(100vh - 200px - 84px);
  overflow-y: auto;
  z-index: 70;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.28);
}

.dialog-pop-enter-from,
.dialog-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.96);
}
.dialog-pop-enter-active,
.dialog-pop-leave-active {
  transition: opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.18s ease;
}

.nc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 8px;
}
.nc-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.nc-close {
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
.nc-body {
  padding: 6px 20px 10px;
}
.nc-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--fr-ink-3);
  margin-bottom: 6px;
}
.nc-input {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  border: 1.5px solid var(--fr-line);
  background: #ffffff;
  padding: 0 14px;
  font: inherit;
  font-size: 15px;
  color: var(--fr-ink);
  outline: none;
}
.nc-input:focus {
  border-color: var(--fr-primary);
}
.nc-hint {
  margin: 8px 2px 0;
  font-size: 11.5px;
  color: var(--fr-ink-3);
}
.nc-actions {
  display: flex;
  gap: 8px;
  padding: 14px 20px 20px;
}
.nc-btn {
  flex: 1;
  height: 46px;
  border-radius: 14px;
  border: none;
  font: inherit;
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: -0.01em;
  cursor: pointer;
}
.nc-btn.cancel {
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
}
.nc-btn.primary {
  background: var(--fr-primary);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(20, 188, 237, 0.3);
}
.nc-btn.primary:disabled {
  background: var(--fr-line);
  color: var(--fr-ink-4);
  box-shadow: none;
  cursor: not-allowed;
}
</style>
