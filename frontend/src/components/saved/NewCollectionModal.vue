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
        aria-label="새 컬렉션 만들기"
      >
        <header class="nc-head">
          <h2>새 컬렉션</h2>
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
            maxlength="40"
            enterkeyhint="done"
            data-testid="new-coll-input"
            @keydown.enter.prevent="onSubmit"
          />
          <p class="nc-hint">저장한 장소를 이 컬렉션으로 분류할 수 있어요.</p>
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
            :disabled="!canSubmit || creating"
            data-testid="new-coll-submit"
            @click="onSubmit"
          >
            {{ creating ? '만드는 중…' : '만들기' }}
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
// to a fresh collection — typically by auto-selecting it.
const emit = defineEmits<{ created: [collection: SavedCollection] }>();

const uiStore = useUiStore();
const savedStore = useSavedStore();
const { newCollectionModalOpen: open } = storeToRefs(uiStore);
const { showError, showInfo } = useToast();

const name = ref('');
const creating = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const canSubmit = computed(() => name.value.trim().length > 0);

// Autofocus when the modal opens; also reset state on close so the next open
// starts clean regardless of the previous outcome.
watch(open, async (v) => {
  if (v) {
    name.value = '';
    creating.value = false;
    await nextTick();
    inputRef.value?.focus();
  }
});

function onClose(): void {
  if (creating.value) return; // lock while POST is in flight
  uiStore.closeNewCollectionModal();
}

async function onSubmit(): Promise<void> {
  if (!canSubmit.value || creating.value) return;
  creating.value = true;
  try {
    const created = await savedStore.createCollection(name.value);
    if (!created) {
      if (savedStore.error) await showError(savedStore.error);
      return;
    }
    await showInfo('컬렉션이 추가되었어요');
    uiStore.closeNewCollectionModal();
    emit('created', created);
  } finally {
    creating.value = false;
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
