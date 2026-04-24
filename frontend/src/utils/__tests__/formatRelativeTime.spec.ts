import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatRelativeTime,
  formatVisitDate,
} from '@/utils/formatRelativeTime';

// Anchor "now" to a fixed point so buckets are deterministic.
const NOW_ISO = '2026-04-24T12:00:00Z';
const NOW_MS = Date.parse(NOW_ISO);

function agoSec(n: number): string {
  return new Date(NOW_MS - n * 1000).toISOString();
}

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_MS));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty for null / undefined / unparsable input', () => {
    expect(formatRelativeTime(null)).toBe('');
    expect(formatRelativeTime(undefined)).toBe('');
    expect(formatRelativeTime('')).toBe('');
    expect(formatRelativeTime('not-a-date')).toBe('');
  });

  it('< 60s → "방금 전"', () => {
    expect(formatRelativeTime(agoSec(0))).toBe('방금 전');
    expect(formatRelativeTime(agoSec(59))).toBe('방금 전');
  });

  it('< 60m → "N분 전"', () => {
    expect(formatRelativeTime(agoSec(60))).toBe('1분 전');
    expect(formatRelativeTime(agoSec(60 * 45))).toBe('45분 전');
    expect(formatRelativeTime(agoSec(60 * 59))).toBe('59분 전');
  });

  it('< 24h → "N시간 전"', () => {
    expect(formatRelativeTime(agoSec(60 * 60))).toBe('1시간 전');
    expect(formatRelativeTime(agoSec(60 * 60 * 5))).toBe('5시간 전');
    expect(formatRelativeTime(agoSec(60 * 60 * 23))).toBe('23시간 전');
  });

  it('24h–2d → "어제"; 2d–7d → "N일 전"', () => {
    expect(formatRelativeTime(agoSec(24 * 3600))).toBe('어제');
    expect(formatRelativeTime(agoSec(24 * 3600 * 2 - 1))).toBe('어제');
    // 2 days exactly → bucket shifts to "N일 전".
    expect(formatRelativeTime(agoSec(24 * 3600 * 2))).toBe('2일 전');
    expect(formatRelativeTime(agoSec(24 * 3600 * 6))).toBe('6일 전');
  });

  it('1w–4w → "N주 전" (task #34)', () => {
    expect(formatRelativeTime(agoSec(24 * 3600 * 7))).toBe('1주 전');
    expect(formatRelativeTime(agoSec(24 * 3600 * 13))).toBe('1주 전');
    expect(formatRelativeTime(agoSec(24 * 3600 * 14))).toBe('2주 전');
    expect(formatRelativeTime(agoSec(24 * 3600 * 29))).toBe('4주 전');
  });

  it('1mo–11mo → "N달 전" (task #34)', () => {
    expect(formatRelativeTime(agoSec(24 * 3600 * 30))).toBe('1달 전');
    expect(formatRelativeTime(agoSec(24 * 3600 * 90))).toBe('3달 전');
    expect(formatRelativeTime(agoSec(24 * 3600 * 364))).toBe('12달 전');
  });

  it('≥ 1y → "N년 전" (task #34)', () => {
    expect(formatRelativeTime(agoSec(24 * 3600 * 365))).toBe('1년 전');
    expect(formatRelativeTime(agoSec(24 * 3600 * 365 * 3))).toBe('3년 전');
  });

  it('future timestamps clamp to "방금 전" (negative diff guarded)', () => {
    const future = new Date(NOW_MS + 60_000).toISOString();
    expect(formatRelativeTime(future)).toBe('방금 전');
  });

  it('accepts an explicit `now` arg so callers can freeze reference time without fake timers', () => {
    // Real timers restored for this test only — the `now` arg carries the
    // freeze, not vi.setSystemTime.
    vi.useRealTimers();
    const frozenNow = new Date('2026-04-24T12:00:00Z');
    const fiveMinAgo = new Date(frozenNow.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo, frozenNow)).toBe('5분 전');
    const threeDaysAgo = new Date(frozenNow.getTime() - 3 * 24 * 3600 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo, frozenNow)).toBe('3일 전');
  });
});

describe('formatVisitDate', () => {
  it('formats ISO timestamps to YYYY.MM.DD in the local timezone', () => {
    expect(formatVisitDate('2025-10-14T10:00:00Z')).toMatch(/^2025\.10\.1[3-4]$/);
    // Null / bad input coalesces to empty string, matching formatRelativeTime.
    expect(formatVisitDate(null)).toBe('');
    expect(formatVisitDate('garbage')).toBe('');
  });
});
