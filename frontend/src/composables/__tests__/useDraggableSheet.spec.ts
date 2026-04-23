import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, ref } from 'vue';
import {
  useDraggableSheet,
  modeToHeight,
  heightToMode,
  computeFullHeight,
  SHEET_CLOSED,
  SHEET_PEEK,
  SHEET_FULL_MAX,
  SHEET_TOP_SAFE,
  SHEET_BOTTOM_NAV,
  SHEET_MIN_FULL,
  type SheetMode,
} from '@/composables/useDraggableSheet';

// Minimal PointerEvent-ish payload — jsdom doesn't ship a constructor, so
// we fabricate what the composable reads (clientY, button).
function pointer(clientY: number, button = 0): PointerEvent {
  return { clientY, button, currentTarget: null } as unknown as PointerEvent;
}

describe('useDraggableSheet — pure helpers', () => {
  it('modeToHeight maps the three snap points with the default full cap', () => {
    expect(modeToHeight('closed')).toBe(SHEET_CLOSED);
    expect(modeToHeight('peek')).toBe(SHEET_PEEK);
    expect(modeToHeight('full')).toBe(SHEET_FULL_MAX);
  });

  it('modeToHeight respects a supplied dynamic full height', () => {
    expect(modeToHeight('full', 423)).toBe(423);
    expect(modeToHeight('peek', 423)).toBe(SHEET_PEEK); // peek is fixed
  });

  it('heightToMode picks the nearest snap point against the default full', () => {
    expect(heightToMode(0)).toBe('closed');
    expect(heightToMode(80)).toBe('closed'); // closer to 0 than 240
    expect(heightToMode(160)).toBe('peek'); // closer to 240 than 0
    expect(heightToMode(400)).toBe('peek'); // closer to 240 than 680
    expect(heightToMode(600)).toBe('full');
    expect(heightToMode(800)).toBe('full'); // clamped beyond max still snaps full
  });

  it('heightToMode respects a supplied dynamic full height', () => {
    // With a 423px cap (iPhone SE sized), the full-vs-peek boundary
    // shifts to midpoint (240+423)/2 ≈ 332.
    expect(heightToMode(300, 423)).toBe('peek');
    expect(heightToMode(360, 423)).toBe('full');
    expect(heightToMode(423, 423)).toBe('full');
  });

  it('computeFullHeight clamps by viewport, keeps SHEET_TOP_SAFE + BOTTOM_NAV clear, and never exceeds SHEET_FULL_MAX (no insets)', () => {
    // Design viewport (844) → 844-160-84=600, below the 680 cap.
    expect(computeFullHeight(844, 0, 0)).toBe(844 - SHEET_TOP_SAFE - SHEET_BOTTOM_NAV);
    // iPhone SE (667) → 667-160-84=423, well below the cap.
    expect(computeFullHeight(667, 0, 0)).toBe(667 - SHEET_TOP_SAFE - SHEET_BOTTOM_NAV);
    // Very tall screen (1200) → 1200-160-84=956 > 680 cap.
    expect(computeFullHeight(1200, 0, 0)).toBe(SHEET_FULL_MAX);
    // Pathologically short (400) → floored at SHEET_MIN_FULL.
    expect(computeFullHeight(400, 0, 0)).toBe(SHEET_MIN_FULL);
  });

  it('computeFullHeight subtracts safe-area insets on top of the base chrome (notch / home-indicator)', () => {
    // iPhone 15 Pro (innerHeight 852, notch inset 59, home-indicator 34)
    //   → 852 - 160 - 59 - 84 - 34 = 515. Close button stays ≥ 59px from top.
    expect(computeFullHeight(852, 59, 34)).toBe(515);
    // iPhone 14 (844, inset 47, home 34) → 844 - 160 - 47 - 84 - 34 = 519.
    expect(computeFullHeight(844, 47, 34)).toBe(519);
    // Android with 24px status-bar but no gesture-nav inset → 847-160-24-84-0 = 579.
    expect(computeFullHeight(847, 24, 0)).toBe(579);
    // iPhone SE (667, no notch, no home-indicator) → 423 (unchanged).
    expect(computeFullHeight(667, 0, 0)).toBe(423);
    // iPad with insets → still capped at the design's 680 ceiling.
    expect(computeFullHeight(1180, 24, 20)).toBe(SHEET_FULL_MAX);
  });

  it('computeFullHeight falls back to SHEET_MIN_FULL when insets eat the viewport', () => {
    // Contrived: a 500px viewport with 100px top inset + 100px bottom inset
    // would drop below MIN_FULL without the floor; the floor protects it.
    expect(computeFullHeight(500, 100, 100)).toBe(SHEET_MIN_FULL);
  });
});

describe('useDraggableSheet — drag lifecycle', () => {
  let listeners: Map<string, Array<(ev: Event) => void>>;

  beforeEach(() => {
    listeners = new Map();
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn) => {
      const arr = listeners.get(type as string) ?? [];
      arr.push(fn as (ev: Event) => void);
      listeners.set(type as string, arr);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn) => {
      const arr = listeners.get(type as string);
      if (!arr) return;
      const idx = arr.indexOf(fn as (ev: Event) => void);
      if (idx >= 0) arr.splice(idx, 1);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fire(type: string, ev: PointerEvent): void {
    (listeners.get(type) ?? []).slice().forEach((fn) => fn(ev));
  }

  it('drag up from peek past full threshold → clamps at the dynamic full height', () => {
    const mode = ref<SheetMode>('peek');
    const changes: SheetMode[] = [];
    const api = useDraggableSheet({
      mode,
      onModeChange: (m) => changes.push(m),
    });
    const cap = api.fullHeight.value;

    api.onPointerDown(pointer(600));
    // Drag up by 500px. startH=240 + 500 = 740; should clamp at the cap
    // (680 on a tall viewport, smaller when jsdom's innerHeight forces clamp).
    fire('pointermove', pointer(100));
    expect(api.isDragging.value).toBe(true);
    expect(api.height.value).toBe(cap);

    fire('pointerup', pointer(100));
    expect(api.isDragging.value).toBe(false);
    expect(changes).toEqual(['full']);
  });

  it('reads --fr-sat/--fr-sab from :root so computeFullHeight honours real device insets without explicit args', () => {
    const root = document.documentElement;
    root.style.setProperty('--fr-sat', '59px');
    root.style.setProperty('--fr-sab', '34px');
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      value: 852, writable: true, configurable: true,
    });

    try {
      // Same call without explicit insets — must pick up the CSS vars.
      expect(computeFullHeight()).toBe(515);
    } finally {
      root.style.removeProperty('--fr-sat');
      root.style.removeProperty('--fr-sab');
      Object.defineProperty(window, 'innerHeight', {
        value: originalInnerHeight, writable: true, configurable: true,
      });
    }
  });

  it('orientationchange event fires recomputeFull and retightens the cap', () => {
    const originalInnerHeight = window.innerHeight;
    const setInnerHeight = (h: number) => {
      Object.defineProperty(window, 'innerHeight', { value: h, writable: true, configurable: true });
    };

    try {
      setInnerHeight(844);
      const api = useDraggableSheet({
        mode: ref<SheetMode>('peek'),
        onModeChange: () => {},
      });
      expect(api.fullHeight.value).toBe(600); // 844 - 160 - 84

      // Rotate to landscape — innerHeight collapses.
      setInnerHeight(390);
      fire('orientationchange', pointer(0));
      expect(api.fullHeight.value).toBe(SHEET_MIN_FULL); // floored at 320
    } finally {
      setInnerHeight(originalInnerHeight);
    }
  });

  it('pointermove recomputes the cap mid-drag so URL-bar-collapse mid-gesture still clamps the sheet', () => {
    const originalInnerHeight = window.innerHeight;
    const setInnerHeight = (h: number) => {
      Object.defineProperty(window, 'innerHeight', { value: h, writable: true, configurable: true });
    };

    try {
      setInnerHeight(1000);
      const api = useDraggableSheet({
        mode: ref<SheetMode>('peek'),
        onModeChange: () => {},
      });
      expect(api.fullHeight.value).toBe(680); // capped

      api.onPointerDown(pointer(800));
      fire('pointermove', pointer(100));
      expect(api.height.value).toBe(680);

      // iOS URL bar pops back — viewport shrinks without firing resize.
      // Next pointermove must pick up the new cap and clamp live height.
      setInnerHeight(700);
      fire('pointermove', pointer(50));
      const newCap = 700 - 160 - 84;
      expect(api.fullHeight.value).toBe(newCap);
      expect(api.height.value).toBe(newCap);

      fire('pointerup', pointer(50));
    } finally {
      setInnerHeight(originalInnerHeight);
    }
  });

  it('window resize shrinks the full cap; a mid-drag height exceeding it gets clamped down', () => {
    const originalInnerHeight = window.innerHeight;
    const setInnerHeight = (h: number) => {
      Object.defineProperty(window, 'innerHeight', { value: h, writable: true, configurable: true });
    };

    try {
      setInnerHeight(1200);
      const scope = effectScope();
      let api!: ReturnType<typeof useDraggableSheet>;
      scope.run(() => {
        api = useDraggableSheet({
          mode: ref<SheetMode>('peek'),
          onModeChange: () => {},
        });
      });

      expect(api.fullHeight.value).toBe(SHEET_FULL_MAX);

      // Simulate a drag mid-flight landing at the cap.
      api.onPointerDown(pointer(900));
      fire('pointermove', pointer(100));
      expect(api.height.value).toBe(SHEET_FULL_MAX);

      // Viewport shrinks (rotate / split-screen) → cap drops, live drag height follows.
      setInnerHeight(667);
      fire('resize', pointer(0)); // payload unused by recomputeFull
      const newCap = 667 - SHEET_TOP_SAFE - SHEET_BOTTOM_NAV;
      expect(api.fullHeight.value).toBe(newCap);
      expect(api.height.value).toBe(newCap);

      fire('pointerup', pointer(100));
      scope.stop();
    } finally {
      setInnerHeight(originalInnerHeight);
    }
  });

  it('drag down from peek to below closed threshold → snaps closed', () => {
    const mode = ref<SheetMode>('peek');
    const changes: SheetMode[] = [];
    const api = useDraggableSheet({
      mode,
      onModeChange: (m) => changes.push(m),
    });

    api.onPointerDown(pointer(400));
    fire('pointermove', pointer(800)); // drag down 400px → 240 - 400 = -160 → clamped 0
    fire('pointerup', pointer(800));

    expect(changes).toEqual(['closed']);
  });

  it('short tap (<5px, <300ms) from peek → toggles to full', () => {
    const mode = ref<SheetMode>('peek');
    const changes: SheetMode[] = [];
    const api = useDraggableSheet({
      mode,
      onModeChange: (m) => changes.push(m),
    });

    api.onPointerDown(pointer(500));
    // no move — release at same point
    fire('pointerup', pointer(502)); // 2px delta, immediate

    expect(changes).toEqual(['full']);
  });

  it('short tap from full → toggles to peek', () => {
    const mode = ref<SheetMode>('full');
    const changes: SheetMode[] = [];
    const api = useDraggableSheet({
      mode,
      onModeChange: (m) => changes.push(m),
    });

    api.onPointerDown(pointer(300));
    fire('pointerup', pointer(301));

    expect(changes).toEqual(['peek']);
  });

  it('idle display height mirrors the bound mode', () => {
    const mode = ref<SheetMode>('peek');
    const api = useDraggableSheet({ mode, onModeChange: vi.fn() });

    expect(api.displayHeight.value).toBe(SHEET_PEEK);

    mode.value = 'full';
    expect(api.displayHeight.value).toBe(api.fullHeight.value);

    mode.value = 'closed';
    expect(api.displayHeight.value).toBe(SHEET_CLOSED);
  });

  it('ignores non-primary mouse buttons', () => {
    const mode = ref<SheetMode>('peek');
    const changes: SheetMode[] = [];
    const api = useDraggableSheet({
      mode,
      onModeChange: (m) => changes.push(m),
    });

    api.onPointerDown(pointer(500, 2)); // right-click
    expect(api.isDragging.value).toBe(false);
    // No listeners were attached — a subsequent pointerup is a no-op.
    fire('pointerup', pointer(500));
    expect(changes).toEqual([]);
  });
});
