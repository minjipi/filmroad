import { toastController } from '@ionic/vue';
import {
  checkmarkCircle,
  alertCircle,
  informationCircle,
  warning as warningIcon,
} from 'ionicons/icons';

export type ToastVariant = 'danger' | 'success' | 'info' | 'warning';

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: checkmarkCircle,
  danger: alertCircle,
  info: informationCircle,
  warning: warningIcon,
};

const VARIANT_DURATION: Record<ToastVariant, number> = {
  // danger 는 사용자가 메시지를 읽고 행동을 결정해야 하니 살짝 길게.
  danger: 2800,
  warning: 2600,
  success: 2000,
  info: 2200,
};

export function useToast() {
  async function show(opts: { msg: string; variant?: ToastVariant }): Promise<void> {
    const variant: ToastVariant = opts.variant ?? 'info';
    const t = await toastController.create({
      message: opts.msg,
      duration: VARIANT_DURATION[variant],
      // 정중앙. 라이트/다크 톤은 fr-toast CSS 가 prefers-color-scheme 으로 처리.
      position: 'middle',
      icon: VARIANT_ICON[variant],
      // ion-toast 의 default `color` 토큰을 쓰면 success=초록바, danger=빨간바
      // 같은 강한 색이 background 를 덮어버려서 카드 톤이 안 산다. variant 는
      // class 로만 표현하고 color 는 비워둔다.
      cssClass: ['fr-toast', `fr-toast--${variant}`],
    });
    await t.present();
  }
  async function showError(msg: string): Promise<void> {
    return show({ msg, variant: 'danger' });
  }
  async function showInfo(msg: string): Promise<void> {
    return show({ msg, variant: 'success' });
  }
  // showCenter 는 기존 호출 유지를 위해 남겨두지만, 이제 모든 토스트가 중앙
  // 정렬이라 사실상 show 와 동일. 새 코드에선 showInfo/showError 를 쓰자.
  async function showCenter(msg: string): Promise<void> {
    return show({ msg, variant: 'info' });
  }
  /**
   * 빈번한 confirm용 미니 토스트. 하단에 짧게 뜨는 다크 알약 스타일 — "저장했어요",
   * "복사됐어요", "메시지 보냈어요" 처럼 사용자가 자주 트리거하는 액션 피드백에 쓴다.
   * 중앙 카드(showInfo/showError) 보다 절제된 톤. 카카오톡/인스타/네이버 표준 패턴.
   */
  async function showQuick(msg: string): Promise<void> {
    const t = await toastController.create({
      message: msg,
      duration: 1500,
      position: 'bottom',
      cssClass: ['fr-toast-quick'],
    });
    await t.present();
  }
  return { show, showError, showInfo, showCenter, showQuick };
}
