import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// useShare 는 KakaoSDK 호출을 services/kakaoShare 에 위임. 그 모듈을 mock 해야
// 진짜 SDK 로드를 안 한다. useToast 도 같이 mock 해서 토스트 호출만 검증.
const { shareKakaoMock } = vi.hoisted(() => ({
  shareKakaoMock: vi.fn(),
}));
vi.mock('@/services/kakaoShare', async () => {
  const actual = await vi.importActual<typeof import('@/services/kakaoShare')>(
    '@/services/kakaoShare',
  );
  return { ...actual, shareKakao: shareKakaoMock };
});

const { showInfoMock, showErrorMock } = vi.hoisted(() => ({
  showInfoMock: vi.fn().mockResolvedValue(undefined),
  showErrorMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showInfo: showInfoMock,
    showError: showErrorMock,
    show: vi.fn(),
    showCenter: vi.fn(),
  }),
}));

import { useShare } from '@/composables/useShare';
import { KakaoShareError } from '@/services/kakaoShare';

const SAMPLE = {
  title: '주문진 영진해변 방파제',
  description: '도깨비 · 강릉시 주문진읍',
  imageUrl: 'https://img/p10.jpg',
  url: 'https://filmroad.kr/place/10',
};

describe('useShare', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    shareKakaoMock.mockReset();
    showInfoMock.mockClear();
    showErrorMock.mockClear();
  });

  describe('shareToKakao', () => {
    it('forwards mapped params to shareKakao service', async () => {
      shareKakaoMock.mockResolvedValueOnce(undefined);
      const { shareToKakao } = useShare();

      await shareToKakao(SAMPLE);

      expect(shareKakaoMock).toHaveBeenCalledWith({
        title: SAMPLE.title,
        description: SAMPLE.description,
        imageUrl: SAMPLE.imageUrl,
        linkUrl: SAMPLE.url,
      });
      // success 시엔 카카오톡 앱이 뜨므로 추가 토스트 없음.
      expect(showInfoMock).not.toHaveBeenCalled();
      expect(showErrorMock).not.toHaveBeenCalled();
    });

    it('shows MISSING_KEY-specific copy when SDK key isn\'t configured', async () => {
      shareKakaoMock.mockRejectedValueOnce(
        new KakaoShareError('MISSING_KEY', 'no key'),
      );
      const { shareToKakao } = useShare();

      await shareToKakao(SAMPLE);

      expect(showErrorMock).toHaveBeenCalledWith('카카오 공유 설정이 필요해요');
    });

    it('shows load-failed copy on SDK_LOAD_FAILED', async () => {
      shareKakaoMock.mockRejectedValueOnce(
        new KakaoShareError('SDK_LOAD_FAILED', 'cdn down'),
      );
      const { shareToKakao } = useShare();

      await shareToKakao(SAMPLE);

      expect(showErrorMock).toHaveBeenCalledWith(
        '카카오 공유를 불러오지 못했어요. 잠시 후 다시 시도해 주세요',
      );
    });

    it('shows generic copy on unknown errors', async () => {
      shareKakaoMock.mockRejectedValueOnce(new Error('boom'));
      const { shareToKakao } = useShare();

      await shareToKakao(SAMPLE);

      expect(showErrorMock).toHaveBeenCalledWith('카카오톡 공유에 실패했어요');
    });
  });

  describe('copyLink', () => {
    it('writes to clipboard and shows confirm toast', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const { copyLink } = useShare();
      await copyLink(SAMPLE.url);

      expect(writeText).toHaveBeenCalledWith(SAMPLE.url);
      expect(showInfoMock).toHaveBeenCalledWith('링크가 복사됐어요');
    });

    it('falls back to execCommand when clipboard API is missing', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: undefined,
      });
      const execSpy = vi.fn().mockReturnValue(true);
      const original = document.execCommand;
      document.execCommand = execSpy as unknown as typeof document.execCommand;

      const { copyLink } = useShare();
      await copyLink(SAMPLE.url);

      expect(execSpy).toHaveBeenCalledWith('copy');
      expect(showInfoMock).toHaveBeenCalledWith('링크가 복사됐어요');

      document.execCommand = original;
    });

    it('shows error toast when clipboard write throws', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const { copyLink } = useShare();
      await copyLink(SAMPLE.url);

      expect(showErrorMock).toHaveBeenCalledWith('링크 복사에 실패했어요');
    });
  });

  describe('shareSystem', () => {
    it('calls navigator.share when available', async () => {
      const shareSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: shareSpy,
      });

      const { shareSystem } = useShare();
      await shareSystem(SAMPLE);

      expect(shareSpy).toHaveBeenCalledWith({
        title: SAMPLE.title,
        text: SAMPLE.description,
        url: SAMPLE.url,
      });
      expect(showErrorMock).not.toHaveBeenCalled();
    });

    it('swallows AbortError silently (user cancelled the system sheet)', async () => {
      const abort = new Error('cancelled');
      abort.name = 'AbortError';
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: vi.fn().mockRejectedValue(abort),
      });

      const { shareSystem } = useShare();
      await shareSystem(SAMPLE);

      expect(showErrorMock).not.toHaveBeenCalled();
    });

    it('falls back to copyLink when navigator.share is missing', async () => {
      // jsdom 에선 navigator.share 가 기본 미지원이라 명시적 삭제 필요.
      Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'share');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      const { shareSystem } = useShare();
      await shareSystem(SAMPLE);

      // 폴백 = copyLink 라 클립보드 호출 + 안내 토스트.
      expect(writeText).toHaveBeenCalledWith(SAMPLE.url);
      expect(showInfoMock).toHaveBeenCalledWith('링크가 복사됐어요');
    });
  });
});
