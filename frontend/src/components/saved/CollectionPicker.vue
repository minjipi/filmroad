<template>
  <Teleport to="body">
    <Transition name="backdrop-fade">
      <div
        v-if="open"
        class="cp-backdrop"
        data-testid="collection-picker-backdrop"
        @click="onClose"
      />
    </Transition>
    <Transition name="dialog-pop">
      <div
        v-if="open"
        class="cp-sheet"
        role="dialog"
        aria-label="컬렉션 선택"
        data-testid="collection-picker"
      >
        <header class="cp-head">
          <h2>어느 컬렉션에 저장할까요?</h2>
          <button
            type="button"
            class="cp-close"
            aria-label="닫기"
            @click="onClose"
          >
            <ion-icon :icon="closeOutline" class="ic-20" />
          </button>
        </header>

        <ul class="cp-list">
          <!-- "기본" row — stores the place without assigning a collection.
               collectionId is null on the wire. -->
          <li
            class="cp-row"
            data-testid="cp-row-default"
            @click="pick(null)"
          >
            <span class="cp-ico default">
              <ion-icon :icon="bookmarkOutline" class="ic-20" />
            </span>
            <span class="cp-meta">
              <span class="n">기본</span>
              <span class="s">컬렉션 없이 저장</span>
            </span>
            <ion-icon :icon="chevronForwardOutline" class="ic-16 cp-chev" />
          </li>

          <li
            v-for="c in collections"
            :key="c.id"
            class="cp-row"
            data-testid="cp-row-collection"
            :data-collection-id="c.id"
            @click="pick(c.id)"
          >
            <span class="cp-ico">
              <img v-if="c.coverImageUrl" :src="c.coverImageUrl" :alt="c.name" />
              <ion-icon v-else :icon="locationOutline" class="ic-20" />
            </span>
            <span class="cp-meta">
              <span class="n">{{ c.name }}</span>
              <span class="s">{{ c.count }}곳</span>
            </span>
            <ion-icon :icon="chevronForwardOutline" class="ic-16 cp-chev" />
          </li>
        </ul>

        <button
          type="button"
          class="cp-new"
          data-testid="cp-new-collection"
          @click="onOpenNewCollection"
        >
          <ion-icon :icon="addOutline" class="ic-18" />
          새 컬렉션 만들기
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon, toastController } from '@ionic/vue';
import {
  closeOutline,
  bookmarkOutline,
  locationOutline,
  addOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';
import { useSavedStore, type SavedCollection } from '@/stores/saved';

const uiStore = useUiStore();
const savedStore = useSavedStore();
const { collectionPickerOpen, collectionPickerPlaceId } = storeToRefs(uiStore);
const { collections } = storeToRefs(savedStore);

const open = computed(() => collectionPickerOpen.value);

async function pick(collectionId: number | null): Promise<void> {
  const placeId = collectionPickerPlaceId.value;
  if (placeId == null) return;
  uiStore.closeCollectionPicker();
  await savedStore.toggleSave(placeId, collectionId);
  if (savedStore.error) {
    const t = await toastController.create({
      message: savedStore.error,
      color: 'danger',
      duration: 1600,
    });
    await t.present();
    return;
  }
  const t = await toastController.create({
    message: '컬렉션에 저장했어요',
    duration: 1400,
  });
  await t.present();
}

function onClose(): void {
  uiStore.closeCollectionPicker();
}

// Chain into the shared new-collection modal. On successful creation the
// modal emits at App.vue level — here we keep the picker open so the new
// collection appears in the list and the user can tap it. (The ordering is:
// modal submits → savedStore.collections.unshift(new) → picker re-renders.)
function onOpenNewCollection(): void {
  uiStore.openNewCollectionModal();
}

// Exposed for the App.vue host to react when a fresh collection lands. We
// auto-select it (toggleSave with the new id) so the user doesn't have to
// tap twice.
async function onCollectionCreated(c: SavedCollection): Promise<void> {
  await pick(c.id);
}
defineExpose({ onCollectionCreated });
</script>

<style scoped>
.cp-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: calc(84px + env(safe-area-inset-bottom, 0px));
  z-index: 40;
  background: rgba(15, 23, 42, 0.5);
}
.cp-sheet {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(360px, calc(100vw - 40px));
  max-height: calc(100vh - 200px - 84px);
  overflow-y: auto;
  z-index: 50;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.28);
  padding: 18px 18px 16px;
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

.cp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 10px;
}
.cp-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
}
.cp-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.cp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 6px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.cp-row:hover,
.cp-row:active {
  background: var(--fr-bg-muted);
}
.cp-ico {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--fr-bg-muted);
  color: var(--fr-ink-2);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.cp-ico.default {
  background: linear-gradient(135deg, #475569, #1e293b);
  color: #ffffff;
}
.cp-ico img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cp-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cp-meta .n {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fr-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-meta .s {
  font-size: 11.5px;
  color: var(--fr-ink-3);
  margin-top: 1px;
}
.cp-chev {
  color: var(--fr-ink-4);
  flex-shrink: 0;
}

.cp-new {
  margin-top: 10px;
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1.5px dashed var(--fr-line);
  background: transparent;
  color: var(--fr-primary);
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}
.cp-new:hover {
  background: var(--fr-bg-muted);
}
</style>
