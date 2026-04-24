/**
 * Decode → EXIF-rotate → resize → re-encode to JPEG.
 *
 * Handles the gnarly "mobile photo rotated wrong" case: some browsers
 * (older Safari, some embedded WebViews) don't honor EXIF orientation when
 * drawing to a canvas via a plain Image element — landscape shots taken in
 * portrait mode come out 90° off. `createImageBitmap(blob, { imageOrientation:
 * 'from-image' })` forces the browser to apply the EXIF rotation before the
 * pixels hit us. Falls back to Image() when createImageBitmap is missing
 * (jsdom, very old browsers).
 *
 * Returns the new data URL, or the original on any decode failure so callers
 * never lose the user's shot to a compression hiccup.
 */
export interface CompressOptions {
  /** Cap for the longest side. Default 1600 — balance between quality and payload. */
  maxPx?: number;
  /** JPEG quality 0–1. Default 0.85 — visually near-lossless at cap. */
  quality?: number;
}

const DEFAULT_MAX_PX = 1600;
const DEFAULT_QUALITY = 0.85;

export async function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {},
): Promise<string> {
  const maxPx = options.maxPx ?? DEFAULT_MAX_PX;
  const quality = options.quality ?? DEFAULT_QUALITY;

  // jsdom / SSR — skip. Callers fall back to the raw dataURL.
  if (typeof document === 'undefined') return dataUrl;

  // Path 1 — modern browsers via createImageBitmap with EXIF auto-rotate.
  // This is the only way to guarantee correct orientation across Safari + Chrome.
  if (
    typeof createImageBitmap === 'function' &&
    typeof fetch !== 'undefined'
  ) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: 'from-image',
      });
      try {
        const out = drawToJpeg(bitmap, bitmap.width, bitmap.height, maxPx, quality);
        if (out) return out;
      } finally {
        // close() is a no-op on bitmaps that the browser has already released.
        if (typeof bitmap.close === 'function') bitmap.close();
      }
    } catch {
      // fallthrough to Image() path
    }
  }

  // Path 2 — Image() fallback. Modern browsers auto-rotate EXIF when drawing
  // a decoded Image to a canvas; older ones don't, but at least the pixels
  // survive the round-trip.
  if (typeof Image === 'undefined') return dataUrl;
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = dataUrl;
    await img.decode();
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w === 0 || h === 0) return dataUrl;
    const out = drawToJpeg(img, w, h, maxPx, quality);
    if (out) return out;
  } catch {
    // give up — raw dataURL goes up as-is
  }
  return dataUrl;
}

function drawToJpeg(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxPx: number,
  quality: number,
): string | null {
  const scale = Math.min(1, maxPx / Math.max(srcW, srcH));
  const tw = Math.max(1, Math.round(srcW * scale));
  const th = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, tw, th);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Estimate the byte size of a base64 data URL without materializing the full
 * buffer. 4 base64 chars = 3 bytes; trailing "=" padding costs one each.
 */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  // Approx — treats body as pure base64. Good enough for a 5MB cap.
  return Math.max(0, Math.floor(body.length * 0.75) - padding);
}
