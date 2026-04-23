import type { MapMarker } from '@/stores/map';

/**
 * Output of {@link clusterMarkers}. Either a single map pin (rendered as the
 * usual bubble) or a cluster of N ≥ 2 pins at the same approximate location.
 */
export type MapRenderable =
  | { kind: 'pin'; marker: MapMarker }
  | {
      kind: 'cluster';
      id: string;
      count: number;
      latitude: number;
      longitude: number;
      markerIds: number[];
    };

/**
 * Resolves the grid-cell size (in degrees) used to bucket markers at a given
 * Kakao zoom level. Higher levels = more zoomed out = larger cells.
 *
 * Kakao levels: 1 = street-level, 14 = country/continent level.
 * The zero-size level 4 and below disables clustering so users can still pick
 * individual pins when they've zoomed into a city.
 *
 * Uses a continuous exponential curve (~1.7×/level) instead of discrete
 * step thresholds so the merge/split animation between zoom levels is smooth
 * — two adjacent zoom levels now differ by ~70% of a cell instead of 4–5×.
 * Anchors: level 5 ≈ 0.008° (~900 m), level 14 ≈ 0.95° (country-wide).
 */
export function clusterCellForZoom(level: number): number {
  if (level <= 4) return 0;
  return 0.008 * Math.pow(1.7, level - 5);
}

interface ClusterOptions {
  // Selected marker stays standalone ("active" pin) even when it would
  // otherwise fall into a cluster bucket, so the user never loses sight of
  // the place whose sheet they're reading.
  selectedId?: number | null;
  // Test hook: override the zoom→cell mapping without bumping the table.
  cellDegForLevel?: (level: number) => number;
}

export function clusterMarkers(
  markers: MapMarker[],
  zoomLevel: number,
  opts: ClusterOptions = {},
): MapRenderable[] {
  const selectedId = opts.selectedId ?? null;
  const cellDeg = (opts.cellDegForLevel ?? clusterCellForZoom)(zoomLevel);

  const out: MapRenderable[] = [];
  const selected = selectedId !== null ? markers.find((m) => m.id === selectedId) : undefined;
  if (selected) out.push({ kind: 'pin', marker: selected });

  if (cellDeg === 0) {
    for (const m of markers) {
      if (m.id !== selectedId) out.push({ kind: 'pin', marker: m });
    }
    return out;
  }

  // Bucket remaining markers by coarse lat/lng grid cell.
  const buckets = new Map<string, MapMarker[]>();
  for (const m of markers) {
    if (m.id === selectedId) continue;
    const key = `${Math.floor(m.latitude / cellDeg)}:${Math.floor(m.longitude / cellDeg)}`;
    const arr = buckets.get(key);
    if (arr) arr.push(m);
    else buckets.set(key, [m]);
  }

  for (const [key, group] of buckets) {
    if (group.length === 1) {
      out.push({ kind: 'pin', marker: group[0] });
      continue;
    }
    // Centroid for cluster placement — averaging lat/lng is fine at the
    // scales we care about; no great-circle math needed.
    const avgLat = group.reduce((s, m) => s + m.latitude, 0) / group.length;
    const avgLng = group.reduce((s, m) => s + m.longitude, 0) / group.length;
    out.push({
      kind: 'cluster',
      id: `c_${key}`,
      count: group.length,
      latitude: avgLat,
      longitude: avgLng,
      markerIds: group.map((m) => m.id),
    });
  }
  return out;
}
