import type { Router } from 'vue-router';

/**
 * Wires up the OAuth deep-link callback for the Capacitor native shell.
 *
 * Flow on Android/iOS:
 *   1. Login button calls Browser.open(`<api>/oauth2/authorization/{kakao|google}?app=mobile`)
 *   2. The system Custom Tabs / SFSafariViewController completes OAuth.
 *   3. The backend success handler redirects to
 *        `filmroad://oauth/callback#access=...&refresh=...`
 *   4. The OS routes that scheme to this app (intent-filter / URL types).
 *   5. Capacitor's App plugin fires `appUrlOpen` — we parse the fragment,
 *      hand the tokens to the auth store, close the browser, and navigate
 *      into the app.
 *
 * On the web build there is no native bridge to register the listener with;
 * the dynamic imports below fail gracefully and the function is a no-op.
 */
export async function registerOAuthDeepLinkHandler(router: Router): Promise<void> {
  let appPlugin: typeof import('@capacitor/app').App | null = null;
  let browserPlugin: typeof import('@capacitor/browser').Browser | null = null;
  try {
    ({ App: appPlugin } = await import('@capacitor/app'));
    ({ Browser: browserPlugin } = await import('@capacitor/browser'));
  } catch {
    // Web build or Capacitor not installed — nothing to wire up.
    return;
  }
  if (!appPlugin) return;

  await appPlugin.addListener('appUrlOpen', async (event) => {
    const raw = event?.url;
    if (typeof raw !== 'string') return;
    if (!raw.startsWith('filmroad://oauth/callback')) return;

    // The fragment carries the tokens (so they don't leak into server access
    // logs). URL doesn't expose hash params on a custom scheme reliably, so
    // parse manually.
    const hashIdx = raw.indexOf('#');
    const fragment = hashIdx >= 0 ? raw.slice(hashIdx + 1) : '';
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access');
    const refreshToken = params.get('refresh');

    // Close the in-app browser regardless of success so the user never gets
    // stuck on the OAuth page.
    if (browserPlugin) {
      try {
        await browserPlugin.close();
      } catch {
        /* nothing-open is fine */
      }
    }

    if (!accessToken || !refreshToken) {
      // Missing tokens — bounce to onboarding with an error flag, mirroring
      // the web-side ?err=oauth contract.
      await router.replace({ path: '/onboarding', query: { err: 'oauth' } });
      return;
    }

    // Pinia must already be active — registerOAuthDeepLinkHandler is invoked
    // after app.mount() in main.ts. The dynamic import keeps this module
    // loadable from non-Vue contexts (tests etc.).
    const { useAuthStore } = await import('@/stores/auth');
    const auth = useAuthStore();
    auth.applyOAuthDeepLinkTokens(accessToken, refreshToken);

    // Match the web flow's `/home?authed=1` landing — gives the SPA a chance
    // to refresh /api/users/me before painting onboarding/login screens.
    await router.replace({ path: '/home', query: { authed: '1' } });
  });
}
