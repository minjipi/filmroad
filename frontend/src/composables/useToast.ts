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
  async function showCenter(msg: string): Promise<void> {
    const t = await toastController.create({
      message: msg,
      duration: 2000,
      color: 'dark',
      position: 'middle',
      cssClass: 'fr-toast-center',
    });
    await t.present();
  }
  return { show, showError, showInfo, showCenter };
}
