// Global <img> error fallback. Any image that fails to load (broken URL,
// 404, CORS) gets replaced with a neutral placeholder so the UI never shows
// the browser's default "broken image" glyph.
//
// Implementation uses a single capture-phase listener on the document —
// `error` events don't bubble, but capture catches them. The `data-fr-fallback`
// flag prevents an infinite loop if the fallback itself somehow fails.

const SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' preserveAspectRatio='xMidYMid slice'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#eef2f6'/>
        <stop offset='100%' stop-color='#dbe7f0'/>
      </linearGradient>
    </defs>
    <rect width='400' height='400' fill='url(#g)'/>
    <g fill='#9ca3af' text-anchor='middle' font-family='system-ui, sans-serif'>
      <circle cx='200' cy='165' r='34' fill='none' stroke='#9ca3af' stroke-width='6'/>
      <path d='M150 258 L175 220 L210 250 L250 205 L280 258 Z'
            fill='none' stroke='#9ca3af' stroke-width='6' stroke-linejoin='round'/>
      <text x='200' y='310' font-size='22' font-weight='600' fill='#6b7280'>이미지 없음</text>
    </g>
  </svg>`.replace(/\s+/g, ' ').trim(),
);

export const FALLBACK_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${SVG}`;

function isMissingSrc(img: HTMLImageElement): boolean {
  // Missing/empty src OR null/undefined string binding from Vue. Treat
  // the fallback itself as "set" so we never overwrite it.
  if (img.dataset.frFallback === '1') return false;
  const attr = img.getAttribute('src');
  if (attr == null || attr.trim() === '') return true;
  if (attr === 'null' || attr === 'undefined') return true;
  return false;
}

function applyFallback(img: HTMLImageElement): void {
  img.dataset.frFallback = '1';
  img.src = FALLBACK_IMAGE_URL;
}

function sweepMissingSrc(root: ParentNode): void {
  root.querySelectorAll('img').forEach((img) => {
    if (isMissingSrc(img)) applyFallback(img);
  });
}

/**
 * Installs a document-level capture listener so any <img> that errors gets
 * its `src` swapped to the demo fallback. Also runs a MutationObserver so
 * newly-added <img> nodes (or ones whose src is (re)set to an empty value)
 * pick up the fallback even when the browser never fires an error event.
 * Idempotent.
 */
export function installImageFallback(doc: Document = document): void {
  if ((doc as Document & { __frImageFallbackInstalled?: boolean }).__frImageFallbackInstalled) {
    return;
  }
  (doc as Document & { __frImageFallbackInstalled?: boolean }).__frImageFallbackInstalled = true;

  // Load errors (broken URL / 404 / CORS).
  doc.addEventListener(
    'error',
    (ev: Event) => {
      const t = ev.target;
      if (!(t instanceof HTMLImageElement)) return;
      if (t.dataset.frFallback === '1') return;
      applyFallback(t);
    },
    true, // capture — image errors don't bubble.
  );

  // Initial sweep for imgs already in the tree when this runs.
  if (doc.body) sweepMissingSrc(doc.body);

  // Observe future additions + src attribute mutations so <img src=""> or
  // :src="maybeNull" end up with the demo placeholder without each call site
  // having to handle it.
  if (typeof MutationObserver === 'undefined' || !doc.body) return;
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof HTMLImageElement) {
        if (isMissingSrc(m.target)) applyFallback(m.target);
        continue;
      }
      if (m.type !== 'childList') continue;
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLImageElement) {
          if (isMissingSrc(n)) applyFallback(n);
        } else if (n instanceof Element) {
          sweepMissingSrc(n);
        }
      });
    }
  });
  obs.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
}
