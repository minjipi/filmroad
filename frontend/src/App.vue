<template>
  <ion-app>
    <ion-router-outlet />
    <LoginPromptModal />
    <CollectionPicker ref="pickerRef" />
    <NewCollectionModal @created="onCollectionCreated" />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';
import { useSavedStore, type SavedCollection } from '@/stores/saved';
import { useUiStore } from '@/stores/ui';
import { markOnboarded } from '@/composables/useOnboarding';
import LoginPromptModal from '@/components/auth/LoginPromptModal.vue';
import CollectionPicker from '@/components/saved/CollectionPicker.vue';
import NewCollectionModal from '@/components/saved/NewCollectionModal.vue';

// Bridge between the two globally-mounted modals: when the user creates a
// collection *from inside the picker* we auto-select it for the pending
// place so they don't have to tap the new row. Creation from SavedPage
// doesn't hit this path (picker isn't open there — uiStore guards it).
const pickerRef = ref<{
  onCollectionCreated: (c: SavedCollection) => Promise<void>;
} | null>(null);
const uiStore = useUiStore();
function onCollectionCreated(c: SavedCollection): void {
  if (uiStore.collectionPickerPlaceId != null && pickerRef.value) {
    void pickerRef.value.onCollectionCreated(c);
  }
}

const authStore = useAuthStore();
const savedStore = useSavedStore();

onMounted(async () => {
  // Share the memoized promise with router.beforeEach — whichever wins the
  // race kicks off fetchMe, the other just awaits the same Promise. Without
  // this, hard refresh on a requiresAuth route flashed /onboarding before
  // the session rehydrated.
  await authStore.ensureSessionReady();
  if (authStore.isAuthenticated) {
    markOnboarded();
    // Hydrate the saved-place index so bookmark buttons across Feed /
    // Gallery / PlaceDetail / Map render the correct on/off state before
    // the user opens the Saved tab. Non-blocking on errors — the button
    // handlers still toggle the server regardless.
    void savedStore.fetch();
  }
});
</script>
