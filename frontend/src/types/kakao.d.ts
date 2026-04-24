declare global {
  interface Window {
    kakao: unknown;
    // Kakao JS SDK (Share, Login 등) 는 전역 `Kakao` 로 올라온다.
    // Maps SDK 의 `window.kakao` 와는 별개.
    Kakao?: unknown;
  }
}

export {};
