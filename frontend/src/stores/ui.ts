import { defineStore } from 'pinia';

interface RenameTarget {
  id: number;
  name: string;
}

/**
 * 공유 시트가 한 번에 들고 다니는 데이터. 카카오톡 카드(title/description/
 * imageUrl)와 시스템 공유 / 링크 복사 모두 같은 dto 로 동작 — 호출부는 한 번만
 * 빌드해서 openShareSheet(data) 로 던지면 된다.
 */
export interface ShareData {
  title: string;
  description: string;
  imageUrl: string | null;
  url: string;
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
  // Share sheet — globally mounted bottom sheet. 4개 페이지(PlaceDetail /
  // CollectionDetail / FeedDetail / ShotDetail)가 같은 시트를 트리거한다.
  shareSheetOpen: boolean;
  shareData: ShareData | null;
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
    shareSheetOpen: false,
    shareData: null,
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
    openShareSheet(data: ShareData): void {
      this.shareData = { ...data };
      this.shareSheetOpen = true;
    },
    closeShareSheet(): void {
      this.shareSheetOpen = false;
      // shareData 는 시트가 슬라이드 아웃 되는 동안 라벨이 바뀌지 않게 유지.
      // 다음 open 때 어차피 덮어쓴다.
    },
  },
});
