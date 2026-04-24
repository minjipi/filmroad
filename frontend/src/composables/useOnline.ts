import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * Reactive wrapper around `navigator.onLine`. Returns `true` when the browser
 * reports an active network connection, `false` when it's explicitly offline.
 *
 * Behavior notes:
 * - jsdom / SSR: `navigator` may be missing — we default to `true` so specs
 *   and first render don't spuriously show an offline state.
 * - `navigator.onLine` can lie in both directions (true doesn't prove reachable
 *   servers, false is usually accurate). Good enough as a UI affordance gate —
 *   the submit path still has its own guard for the edge case.
 */
export function useOnline(): Ref<boolean> {
  const online = ref(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );

  // Guard mount/unmount so the composable is safe to call from tests that
  // don't run inside a component lifecycle (e.g. direct composable invocation).
  function onOnline(): void {
    online.value = true;
  }
  function onOffline(): void {
    online.value = false;
  }

  onMounted(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  });
  onBeforeUnmount(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  });

  return online;
}
