/**
 * Human-friendly relative time formatter in Korean.
 *
 * Ladder (task #34):
 *   < 60s         → "방금 전"
 *   < 60m         → "N분 전"
 *   < 24h         → "N시간 전"
 *   1–2d          → "어제"
 *   2–7d          → "N일 전"
 *   1–4w          → "N주 전"     ⎫
 *   1–12mo        → "N달 전"     ⎬ task #34 additions
 *   ≥ 1y          → "N년 전"     ⎭
 *
 * Returns an empty string for missing/unparsable input — templates can
 * coalesce with `v-if` or use as-is without null guards.
 */

const MINUTE = 60;
const HOUR = 60 * 60;
const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;
// Approximate months as 30 days / years as 365 days — the UX value of
// "약 11달 전" beats precision, and the brain rounds the same way.
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  // `now` default defers creation until call time, but the optional arg lets
  // specs freeze the reference point without reaching for vi.useFakeTimers.
  const diffSec = Math.max(0, (now.getTime() - t) / 1000);

  if (diffSec < MINUTE) return '방금 전';
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}분 전`;
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}시간 전`;
  if (diffSec < 2 * DAY) return '어제';
  if (diffSec < WEEK) return `${Math.floor(diffSec / DAY)}일 전`;
  if (diffSec < MONTH) return `${Math.floor(diffSec / WEEK)}주 전`;
  if (diffSec < YEAR) return `${Math.floor(diffSec / MONTH)}달 전`;
  return `${Math.floor(diffSec / YEAR)}년 전`;
}

/**
 * Absolute calendar date formatter — "YYYY.MM.DD". Used by visit chips and
 * other "when did this happen" markers where the relative phrasing would
 * feel wrong (e.g. "어제 방문" vs "2025.10.14 방문").
 */
export function formatVisitDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}
