<template>
  <ion-app>
    <ion-router-outlet />
    <LoginPromptModal />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';
import { useSavedStore } from '@/stores/saved';
import { markOnboarded } from '@/composables/useOnboarding';
import LoginPromptModal from '@/components/auth/LoginPromptModal.vue';

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
