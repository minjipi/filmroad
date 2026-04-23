import { defineStore } from 'pinia';

interface State {
  loginPromptOpen: boolean;
  loginPromptReason: string | null;
}

export const useUiStore = defineStore('ui', {
  state: (): State => ({
    loginPromptOpen: false,
    loginPromptReason: null,
  }),
  actions: {
    showLoginPrompt(reason?: string): void {
      this.loginPromptReason = reason ?? null;
      this.loginPromptOpen = true;
    },
    closeLoginPrompt(): void {
      this.loginPromptOpen = false;
      this.loginPromptReason = null;
    },
  },
});
