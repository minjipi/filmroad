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
import { markOnboarded } from '@/composables/useOnboarding';
import LoginPromptModal from '@/components/auth/LoginPromptModal.vue';

const authStore = useAuthStore();

onMounted(async () => {
  await authStore.fetchMe();
  if (authStore.isAuthenticated) {
    markOnboarded();
  }
});
</script>
