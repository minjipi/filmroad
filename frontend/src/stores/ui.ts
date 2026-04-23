import { defineStore } from 'pinia';

interface State {
  loginPromptOpen: boolean;
  loginPromptReason: string | null;
  // Collection picker — shown whenever the user taps a bookmark button on a
  // place they haven't saved yet. Hosts the "pick a collection" dialog.
  // Saved-state bookmarks bypass this (unsave is one-shot).
  collectionPickerOpen: boolean;
  collectionPickerPlaceId: number | null;
  // New-collection modal — shared between SavedPage ("새 컬렉션" card) and
  // CollectionPicker ("새 컬렉션 만들기" button). Lives in ui store so both
  // entry points can trigger the same globally-mounted modal component.
  newCollectionModalOpen: boolean;
}

export const useUiStore = defineStore('ui', {
  state: (): State => ({
    loginPromptOpen: false,
    loginPromptReason: null,
    collectionPickerOpen: false,
    collectionPickerPlaceId: null,
    newCollectionModalOpen: false,
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
    openCollectionPicker(placeId: number): void {
      this.collectionPickerPlaceId = placeId;
      this.collectionPickerOpen = true;
    },
    closeCollectionPicker(): void {
      this.collectionPickerOpen = false;
      this.collectionPickerPlaceId = null;
    },
    openNewCollectionModal(): void {
      this.newCollectionModalOpen = true;
    },
    closeNewCollectionModal(): void {
      this.newCollectionModalOpen = false;
    },
  },
});
