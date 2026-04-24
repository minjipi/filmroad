interface KakaoSdk {
  isInitialized: () => boolean;
  init: (key: string) => void;
  Share: {
    sendDefault: (opts: {
      objectType: 'feed';
      content: {
        title: string;
        description: string;
        imageUrl: string;
        link: { mobileWebUrl: string; webUrl: string };
      };
      buttons?: Array<{
        title: string;
        link: { mobileWebUrl: string; webUrl: string };
      }>;
      serverCallbackArgs?: Record<string, string>;
    }) => void;
    sendCustom: (opts: {
      templateId: number;
      templateArgs?: Record<string, string>;
      serverCallbackArgs?: Record<string, string>;
    }) => void;
  };
}

// 구분 가능한 에러 — 호출부에서 사용자에게 무슨 일이 났는지
// (SDK 로드 실패 / 키 없음 / Kakao API 오류 / 팝업 차단 등) 안내하려면
// 그냥 Error 대신 code 로 분기해야 한다.
export type KakaoShareFailureCode =
  | 'MISSING_KEY'
  | 'SDK_LOAD_FAILED'
  | 'SDK_MISSING'
  | 'KAKAO_ERROR';

export class KakaoShareError extends Error {
  readonly code: KakaoShareFailureCode;
  constructor(code: KakaoShareFailureCode, message: string) {
    super(message);
    this.name = 'KakaoShareError';
    this.code = code;
  }
}

const DEFAULT_SHARE_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80';

let loadPromise: Promise<KakaoSdk> | null = null;

function loadKakaoSdk(): Promise<KakaoSdk> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<KakaoSdk>((resolve, reject) => {
    // Kakao JS SDK 는 Maps 와 같은 JavaScript 앱 키를 사용한다 — 단,
    // 콘솔에서 "카카오톡 공유" 기능을 활성화해 둔 앱이어야 동작한다.
    const key = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;
    if (!key) {
      loadPromise = null;
      reject(new KakaoShareError('MISSING_KEY', 'VITE_KAKAO_MAP_KEY is not set'));
      return;
    }
    const w = window as unknown as { Kakao?: KakaoSdk };
    if (w.Kakao) {
      if (!w.Kakao.isInitialized()) w.Kakao.init(key);
      resolve(w.Kakao);
      return;
    }
    const script = document.createElement('script');
    // integrity hash 는 Kakao 가 배포 파일 내용을 갱신하면 조용히 깨져
    // "왜 공유가 안 되지?" 디버깅이 어렵다. 필요 시 프로덕션에서
    // 고정 버전 + 올바른 해시로 다시 붙이는 게 낫다.
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.1/kakao.min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const ww = window as unknown as { Kakao?: KakaoSdk };
      if (!ww.Kakao) {
        loadPromise = null;
        reject(new KakaoShareError('SDK_MISSING', 'Kakao SDK missing after load'));
        return;
      }
      try {
        if (!ww.Kakao.isInitialized()) ww.Kakao.init(key);
      } catch (e) {
        loadPromise = null;
        reject(
          new KakaoShareError(
            'KAKAO_ERROR',
            e instanceof Error ? e.message : 'Kakao init failed',
          ),
        );
        return;
      }
      resolve(ww.Kakao);
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new KakaoShareError('SDK_LOAD_FAILED', 'Failed to load Kakao JS SDK'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

function sanitizeImageUrl(raw: string | null | undefined): string {
  // Kakao 공유 카드 프리뷰는 공개 접근 가능한 https 이미지만 받는다.
  // localhost / relative / http 이미지는 preview 가 비거나 전송이 거부된다.
  if (!raw) return DEFAULT_SHARE_IMAGE;
  try {
    const u = new URL(raw, window.location.origin);
    if (u.protocol !== 'https:') return DEFAULT_SHARE_IMAGE;
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return DEFAULT_SHARE_IMAGE;
    }
    return u.toString();
  } catch {
    return DEFAULT_SHARE_IMAGE;
  }
}

export interface KakaoShareParams {
  title: string;
  description: string;
  imageUrl: string | null | undefined;
  linkUrl: string;
  /**
   * 콘솔에 등록한 커스텀 메시지 템플릿 ID. 주어지면 sendDefault 대신
   * sendCustom 을 사용해 정돈된 브랜드 템플릿으로 보낸다. 없으면 기본
   * feed 템플릿(제목/설명/이미지/버튼)으로 폴백.
   */
  templateId?: number;
  /** 공유 통계용 — 백엔드 serverCallback 으로 전달된다. */
  serverCallbackArgs?: Record<string, string>;
}

export async function shareKakao(params: KakaoShareParams): Promise<void> {
  const kakao = await loadKakaoSdk();
  const safeImage = sanitizeImageUrl(params.imageUrl);

  try {
    if (params.templateId) {
      kakao.Share.sendCustom({
        templateId: params.templateId,
        templateArgs: {
          title: params.title,
          description: params.description,
          imageUrl: safeImage,
          linkUrl: params.linkUrl,
        },
        serverCallbackArgs: params.serverCallbackArgs,
      });
      return;
    }
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: params.title,
        description: params.description,
        imageUrl: safeImage,
        link: {
          mobileWebUrl: params.linkUrl,
          webUrl: params.linkUrl,
        },
      },
      buttons: [
        {
          title: '자세히 보기',
          link: {
            mobileWebUrl: params.linkUrl,
            webUrl: params.linkUrl,
          },
        },
      ],
      serverCallbackArgs: params.serverCallbackArgs,
    });
  } catch (e) {
    throw new KakaoShareError(
      'KAKAO_ERROR',
      e instanceof Error ? e.message : 'Kakao.Share failed',
    );
  }
}
