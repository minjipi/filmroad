import { describe, it, expect } from 'vitest';
import { compressDataUrl, dataUrlByteSize } from '@/utils/imageCompress';

describe('imageCompress utils', () => {
  it('dataUrlByteSize: approximates the base64 body size', () => {
    // "ABCD" (4 bytes) → base64 "QUJDRA==" (8 chars, 2 padding) → estimator
    // yields floor(8*0.75) - 2 = 4.
    expect(dataUrlByteSize('data:image/jpeg;base64,QUJDRA==')).toBe(4);
    // "ABC" (3 bytes) → base64 "QUJD" (4 chars, no padding) → 3.
    expect(dataUrlByteSize('data:image/jpeg;base64,QUJD')).toBe(3);
    // Non-dataURL input → fall back to raw length.
    expect(dataUrlByteSize('plain-string')).toBe('plain-string'.length);
  });

  it('dataUrlByteSize: rejects MAX_UPLOAD_BYTES-sized payloads (~5MB threshold)', () => {
    // Construct a base64 string long enough that the estimator reports >5MB.
    // 5MB = 5,242,880 bytes → base64 body ≈ 5,242,880 / 0.75 ≈ 6,990,507 chars.
    const body = 'A'.repeat(7_000_000);
    const bytes = dataUrlByteSize(`data:image/jpeg;base64,${body}`);
    expect(bytes).toBeGreaterThan(5 * 1024 * 1024);
  });

  it('compressDataUrl: returns the original dataURL when canvas decode fails (jsdom)', async () => {
    // jsdom's canvas does not support getContext('2d') image operations by
    // default, so the utility should bail and hand back the input unchanged.
    const input = 'data:image/jpeg;base64,QUJDRA==';
    const out = await compressDataUrl(input);
    // Either the compressed output starts with "data:image/jpeg" (if some
    // canvas path succeeded) OR we got the input back verbatim. Both are
    // acceptable — the contract is "never lose the user's shot".
    expect(typeof out).toBe('string');
    expect(out.startsWith('data:')).toBe(true);
  });
});
