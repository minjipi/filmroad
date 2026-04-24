import { describe, it, expect, beforeEach } from 'vitest';
import { FALLBACK_IMAGE_URL, installImageFallback } from '../imageFallback';

// Fresh document state per test — the installer is idempotent but we want
// each test to start without the flag so the fallback actually attaches.
beforeEach(() => {
  document.body.innerHTML = '';
  const doc = document as Document & { __frImageFallbackInstalled?: boolean };
  doc.__frImageFallbackInstalled = false;
});

describe('installImageFallback', () => {
  it('swaps a broken <img> src to the demo placeholder on error', () => {
    installImageFallback();
    const img = document.createElement('img');
    document.body.appendChild(img);
    img.src = 'https://definitely-not-a-real-host.invalid/x.jpg';

    // Simulate the browser's error event — jsdom doesn't actually fetch.
    img.dispatchEvent(new Event('error'));

    expect(img.src).toBe(FALLBACK_IMAGE_URL);
    expect(img.dataset.frFallback).toBe('1');
  });

  it('does not loop: a second error on the fallback image is ignored', () => {
    installImageFallback();
    const img = document.createElement('img');
    document.body.appendChild(img);
    img.src = 'bad://first';
    img.dispatchEvent(new Event('error'));
    // Now the src is the fallback; if the fallback itself 404s, the listener
    // must not re-run (data attr guards it).
    const firstSrc = img.src;
    img.dispatchEvent(new Event('error'));
    expect(img.src).toBe(firstSrc);
  });

  it('is idempotent across multiple installs', () => {
    installImageFallback();
    installImageFallback();
    installImageFallback();

    const img = document.createElement('img');
    document.body.appendChild(img);
    img.src = 'bad://x';
    img.dispatchEvent(new Event('error'));
    expect(img.src).toBe(FALLBACK_IMAGE_URL);
  });

  it('applies fallback to imgs added with no src attribute', async () => {
    installImageFallback();
    const img = document.createElement('img');
    // No src assigned before or after — the observer should notice the node.
    document.body.appendChild(img);
    // MutationObserver is async — wait a tick.
    await new Promise((r) => setTimeout(r, 0));
    expect(img.src).toBe(FALLBACK_IMAGE_URL);
  });

  it('applies fallback to imgs added with empty src', async () => {
    installImageFallback();
    const img = document.createElement('img');
    img.setAttribute('src', '');
    document.body.appendChild(img);
    await new Promise((r) => setTimeout(r, 0));
    expect(img.src).toBe(FALLBACK_IMAGE_URL);
  });

  it('leaves imgs with real src alone until they error', async () => {
    installImageFallback();
    const img = document.createElement('img');
    img.src = 'https://example.com/ok.jpg';
    document.body.appendChild(img);
    await new Promise((r) => setTimeout(r, 0));
    expect(img.src).toBe('https://example.com/ok.jpg');
  });

  it('sweeps imgs that existed before install runs', () => {
    const img = document.createElement('img');
    document.body.appendChild(img); // no src, pre-install
    installImageFallback();
    expect(img.src).toBe(FALLBACK_IMAGE_URL);
  });
});
