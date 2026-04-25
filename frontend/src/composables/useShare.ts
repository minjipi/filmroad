import { shareKakao, KakaoShareError } from '@/services/kakaoShare';
import type { ShareData } from '@/stores/ui';
import { useToast } from '@/composables/useToast';

/**
 * 공유 채널 3종 — 카카오톡 / 링크 복사 / 시스템 공유.
 * 각 함수는 시트가 닫힌 직후 호출되며, 결과 토스트도 안에서 처리한다.
 * 호출부(ShareSheet) 는 어떤 채널이 동작했는지 신경쓰지 않고 await 만 하면 됨.
 */
export function useShare() {
  // showQuick = 하단 다크 알약 (한국 모바일 표준 패턴) — "링크 복사됐어요"는
  // 빈번한 confirm 액션이라 정중앙 카드보다 절제된 톤이 어울림.
  const { showQuick, showError } = useToast();

  async function shareToKakao(data: ShareData): Promise<void> {
    try {
      await shareKakao({
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        linkUrl: data.url,
      });
      // 성공 시 카카오톡 앱이 떠서 채팅방 선택 UI 가 뜬다 — 사용자가 이미
      // 다음 화면을 보고 있으므로 추가 토스트는 불필요.
    } catch (e) {
      const code = e instanceof KakaoShareError ? e.code : 'KAKAO_ERROR';
      const msg = (() => {
        switch (code) {
          case 'MISSING_KEY':
            return '카카오 공유 설정이 필요해요';
          case 'SDK_LOAD_FAILED':
          case 'SDK_MISSING':
            return '카카오 공유를 불러오지 못했어요. 잠시 후 다시 시도해 주세요';
          default:
            return '카카오톡 공유에 실패했어요';
        }
      })();
      await showError(msg);
    }
  }

  async function copyLink(url: string): Promise<void> {
    // navigator.clipboard 가 막혀 있는 환경(http, 일부 in-app 브라우저)을 위해
    // 폴백 — execCommand('copy') 는 deprecated 지만 여전히 가장 호환성 좋다.
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      await showQuick('링크가 복사됐어요');
    } catch {
      await showError('링크 복사에 실패했어요');
    }
  }

  async function shareSystem(data: ShareData): Promise<void> {
    // Web Share API. 미지원이거나 사용자가 캔슬하면 그냥 조용히 빠진다 — 시트는
    // 이미 닫혔고 사용자가 명시적으로 채널을 골랐으니 별도 안내 X.
    if (typeof navigator === 'undefined' || !('share' in navigator)) {
      // 폴백: 시스템 공유가 없으면 클립보드 복사로 대체. iOS Capacitor /
      // 모던 모바일 브라우저는 거의 다 지원하니 이 분기는 데스크톱 PWA 정도.
      await copyLink(data.url);
      return;
    }
    try {
      await (navigator as Navigator & {
        share: (d: { title?: string; text?: string; url?: string }) => Promise<void>;
      }).share({
        title: data.title,
        text: data.description,
        url: data.url,
      });
    } catch (e) {
      // AbortError = 사용자가 시스템 시트를 닫음. 에러 아님.
      if (e instanceof Error && e.name === 'AbortError') return;
      await showError('공유에 실패했어요');
    }
  }

  return { shareToKakao, copyLink, shareSystem };
}
