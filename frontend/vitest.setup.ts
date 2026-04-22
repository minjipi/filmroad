// Global test setup: silence toastController presents and noisy console output
// from unmocked ionicons icon imports.
import { vi } from 'vitest';

// @ionic/vue's toastController.create returns a controller whose .present()
// tries to attach to the DOM. In unit tests we don't care about the toast UI.
vi.mock('@ionic/vue', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@ionic/vue');
  return {
    ...actual,
    toastController: {
      create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }),
    },
  };
});
