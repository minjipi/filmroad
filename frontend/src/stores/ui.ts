import { defineStore } from 'pinia';

interface RenameTarget {
  id: number;
  name: string;
}

interface State {
  loginPromptOpen: boolean;
  loginPromptReason: string | null;
  // Collection picker — shown whenever the user taps a bookmark button on a
  // place they haven't saved yet. Hosts the "pick a collection" dialog.
  // Saved-state bookmarks bypass this (unsave is one-shot).
  collectionPickerOpen: boolean;
  collectionPickerPlaceId: number | null;
  // New/rename-collection modal — shared between SavedPage ("새 컬렉션" 카드,
  // 편집모드 "이름 변경"), CollectionPicker ("새 컬렉션 만들기" 버튼). 같은
  // 컴포넌트가 mode 에 따라 텍스트/제출 동작만 바꾼다.
  newCollectionModalOpen: boolean;
  newCollectionModalMode: 'create' | 'rename';
  newCollectionModalRenameTarget: RenameTarget | null;
}

export const useUiStore = defineStore('ui', {
  state: (): State => ({
    loginPromptOpen: false,
    loginPromptReason: null,
    collectionPickerOpen: false,
    collectionPickerPlaceId: null,
    newCollectionModalOpen: false,
    newCollectionModalMode: 'create',
    newCollectionModalRenameTarget: null,
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
      this.newCollectionModalMode = 'create';
      this.newCollectionModalRenameTarget = null;
      this.newCollectionModalOpen = true;
    },
    openRenameCollectionModal(target: RenameTarget): void {
      this.newCollectionModalMode = 'rename';
      this.newCollectionModalRenameTarget = { ...target };
      this.newCollectionModalOpen = true;
    },
    closeNewCollectionModal(): void {
      this.newCollectionModalOpen = false;
      this.newCollectionModalRenameTarget = null;
      this.newCollectionModalMode = 'create';
    },
  },
});
