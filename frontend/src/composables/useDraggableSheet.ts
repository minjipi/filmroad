import { computed, getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';

// Snap points match design/pages/02-map.html. PEEK is a fixed height; FULL is
// a cap — the actual full-state height shrinks on small viewports so the
// close button + handle stay above the chip row. See computeFullHeight().
export const SHEET_CLOSED = 0;
export const SHEET_PEEK = 240;
export const SHEET_FULL_MAX = 680;

// Content chrome above the sheet, *excluding* device safe-area insets:
//   top-bar padding 16px + search bar 48px + gap 12px + chip row ~40px
//   + ~44px breathing room for the close button above the chip row.
// The notch / dynamic-island inset is added on top of this at runtime via
// env(safe-area-inset-top) so iPhones don't shove the sheet into the camera.
export const SHEET_TOP_SAFE = 160;
// Bottom tab bar (FrTabBar). The home-indicator inset is added on top via
// env(safe-area-inset-bottom) — .sheet uses `bottom: 84px + inset` in CSS,
// so we must mirror that here or the clamp drifts by the inset amount.
export const SHEET_BOTTOM_NAV = 84;
// Don't let the sheet collapse below this even on pathologically short screens
// — the sheet body is unusable otherwise.
export const SHEET_MIN_FULL = 320;
// Fallback used in SSR / Vitest where `window` isn't available — matches the
// 390×844 design viewport so the tests behave like the design preview.
const DEFAULT_VIEWPORT_HEIGHT = 844;

export type SheetMode = 'closed' | 'peek' | 'full';

function parsePx(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Reads a CSS custom property (e.g. --fr-sat) from :root and parses it as
 * pixels. Returns 0 when the DOM isn't available (Node/Vitest without a
 * jsdom wrapper) or when the property is unset.
 */
export function readSafeAreaInset(name: '--fr-sat' | '--fr-sab'): number {
  if (typeof document === 'undefined') return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return parsePx(v);
}

export function computeFullHeight(
  innerHeight?: number,
  insetTop?: number,
  insetBottom?: number,
): number {
  const h =
    innerHeight ??
    (typeof window !== 'undefined' ? window.innerHeight : DEFAULT_VIEWPORT_HEIGHT);
  const top = insetTop ?? readSafeAreaInset('--fr-sat');
  const bot = insetBottom ?? readSafeAreaInset('--fr-sab');
  const maxByViewport = Math.max(
    SHEET_MIN_FULL,
    h - SHEET_TOP_SAFE - top - SHEET_BOTTOM_NAV - bot,
  );
  return Math.min(SHEET_FULL_MAX, maxByViewport);
}

export function modeToHeight(mode: SheetMode, fullHeight = SHEET_FULL_MAX): number {
  if (mode === 'closed') return SHEET_CLOSED;
  if (mode === 'full') return fullHeight;
  return SHEET_PEEK;
}

export function heightToMode(h: number, fullHeight = SHEET_FULL_MAX): SheetMode {
  const deltas: Array<{ mode: SheetMode; d: number }> = [
    { mode: 'closed', d: Math.abs(h - SHEET_CLOSED) },
    { mode: 'peek', d: Math.abs(h - SHEET_PEEK) },
    { mode: 'full', d: Math.abs(h - fullHeight) },
  ];
  deltas.sort((a, b) => a.d - b.d);
  return deltas[0].mode;
}

interface UseDraggableSheetOptions {
  mode: Ref<SheetMode>;
  onModeChange: (next: SheetMode) => void;
}

interface DraggableSheetApi {
  height: Ref<number>;
  isDragging: Ref<boolean>;
  displayHeight: Ref<number>;
  fullHeight: Ref<number>;
  onPointerDown: (ev: PointerEvent) => void;
}

export function useDraggableSheet(opts: UseDraggableSheetOptions): DraggableSheetApi {
  const fullHeight = ref<number>(computeFullHeight());

  // Live height during a drag. When idle, we defer to the store's mode so the
  // number reflows automatically if another action (e.g. selectMarker) flips
  // the mode while the sheet is at rest.
  const liveHeight = ref<number>(modeToHeight(opts.mode.value, fullHeight.value));
  const isDragging = ref(false);

  const displayHeight = computed(() =>
    isDragging.value ? liveHeight.value : modeToHeight(opts.mode.value, fullHeight.value),
  );

  function clamp(h: number): number {
    if (h < SHEET_CLOSED) return SHEET_CLOSED;
    if (h > fullHeight.value) return fullHeight.value;
    return h;
  }

  function recomputeFull(): void {
    const next = computeFullHeight();
    if (next === fullHeight.value) return;
    fullHeight.value = next;
    // If an active drag overshoots the new cap, rein it in immediately so
    // the sheet top doesn't stay clipped above the chip row.
    if (isDragging.value && liveHeight.value > next) {
      liveHeight.value = next;
    }
  }

  if (typeof window !== 'undefined') {
    // `resize` covers desktop + most mobile cases; iOS only fires it
    // sometimes on rotation / address-bar collapse, so also listen to
    // orientationchange and visualViewport.resize as belt-and-suspenders.
    window.addEventListener('resize', recomputeFull);
    window.addEventListener('orientationchange', recomputeFull);
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    vv?.addEventListener('resize', recomputeFull);

    // Scope-based cleanup contents when the composable is called inside setup()
    // or an explicit effectScope(). Direct invocation in unit tests is fine —
    // we just skip registering the disposer to avoid a Vue dev warning.
    if (getCurrentScope()) {
      onScopeDispose(() => {
        window.removeEventListener('resize', recomputeFull);
        window.removeEventListener('orientationchange', recomputeFull);
        vv?.removeEventListener('resize', recomputeFull);
        cleanup();
      });
    }
  }

  let startY = 0;
  let startH = 0;
  let downT = 0;

  function cleanup(): void {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(ev: PointerEvent): void {
    if (!isDragging.value) return;
    // iOS fires neither `resize` nor `orientationchange` when the URL bar
    // collapses mid-drag, so re-read the viewport every move. This is cheap
    // (a single getComputedStyle read) and guarantees the sheet top never
    // crosses the status bar even if the browser chrome shifts mid-gesture.
    recomputeFull();
    // Drag up = positive delta = taller sheet.
    const delta = startY - ev.clientY;
    liveHeight.value = clamp(startH + delta);
  }

  function onPointerUp(ev: PointerEvent): void {
    if (!isDragging.value) {
      cleanup();
      return;
    }
    const dy = Math.abs(ev.clientY - startY);
    const dt = Date.now() - downT;
    // Short tap on the handle: toggle peek ↔ full instead of snapping to the
    // nearest height (matches the design's JS short-click behavior).
    let nextMode: SheetMode;
    if (dy < 5 && dt < 300) {
      nextMode = opts.mode.value === 'full' ? 'peek' : 'full';
    } else {
      nextMode = heightToMode(liveHeight.value, fullHeight.value);
    }
    isDragging.value = false;
    cleanup();
    opts.onModeChange(nextMode);
  }

  function onPointerDown(ev: PointerEvent): void {
    // Ignore non-primary buttons (right-click, middle-click).
    if (ev.button !== undefined && ev.button !== 0) return;
    startY = ev.clientY;
    startH = modeToHeight(opts.mode.value, fullHeight.value);
    liveHeight.value = startH;
    downT = Date.now();
    isDragging.value = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  return {
    height: liveHeight,
    isDragging,
    displayHeight,
    fullHeight,
    onPointerDown,
  };
}
