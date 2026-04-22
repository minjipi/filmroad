import { toastController } from '@ionic/vue';

export type ToastVariant = 'danger' | 'success' | 'info' | 'warning';

export function useToast() {
  async function show(opts: { msg: string; variant?: ToastVariant }): Promise<void> {
    const t = await toastController.create({
      message: opts.msg,
      duration: 2500,
      color: opts.variant ?? 'danger',
      position: 'top',
    });
    await t.present();
  }
  async function showError(msg: string): Promise<void> {
    return show({ msg, variant: 'danger' });
  }
  async function showInfo(msg: string): Promise<void> {
    return show({ msg, variant: 'success' });
  }
  return { show, showError, showInfo };
}
