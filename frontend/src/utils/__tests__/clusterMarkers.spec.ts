import { describe, it, expect } from 'vitest';
import { clusterMarkers, clusterCellForZoom } from '@/utils/clusterMarkers';
import type { MapMarker } from '@/stores/map';

function m(id: number, lat: number, lng: number): MapMarker {
  return {
    id,
    name: `p${id}`,
    latitude: lat,
    longitude: lng,
    workId: 1,
    workTitle: '',
    regionLabel: '',
    distanceKm: null,
  };
}

describe('clusterCellForZoom', () => {
  it('returns 0 at high zoom (street-level) to disable clustering', () => {
    expect(clusterCellForZoom(1)).toBe(0);
    expect(clusterCellForZoom(4)).toBe(0);
  });

  it('returns progressively larger cells as the map zooms out', () => {
    expect(clusterCellForZoom(5)).toBeGreaterThan(0);
    expect(clusterCellForZoom(7)).toBeGreaterThan(clusterCellForZoom(5));
    expect(clusterCellForZoom(9)).toBeGreaterThan(clusterCellForZoom(7));
    expect(clusterCellForZoom(12)).toBeGreaterThan(clusterCellForZoom(9));
  });

  it('grows smoothly across every adjacent level (no 4×+ jumps that cause visual stutter)', () => {
    // Each step should stay under a 2× ratio — the previous 5-step function
    // jumped 5× between 0.01 and 0.05 and between 0.2 and 1.0, which this
    // assertion would have caught.
    for (let level = 6; level <= 14; level++) {
      const prev = clusterCellForZoom(level - 1);
      const curr = clusterCellForZoom(level);
      expect(curr).toBeGreaterThan(prev);
      expect(curr / prev).toBeLessThan(2);
    }
  });

  it('stays within sensible anchor bounds (~0.008° at city zoom, ~1° at country zoom)', () => {
    expect(clusterCellForZoom(5)).toBeGreaterThanOrEqual(0.005);
    expect(clusterCellForZoom(5)).toBeLessThanOrEqual(0.02);
    expect(clusterCellForZoom(14)).toBeGreaterThan(0.5);
    expect(clusterCellForZoom(14)).toBeLessThan(1.5);
  });
});

describe('clusterMarkers', () => {
  it('emits one pin per marker when clustering is disabled (high zoom)', () => {
    const markers = [m(1, 37.5, 127.0), m(2, 37.6, 127.1), m(3, 37.7, 127.2)];
    const out = clusterMarkers(markers, 2);
    expect(out.every((r) => r.kind === 'pin')).toBe(true);
    expect(out).toHaveLength(3);
  });

  it('collapses nearby markers into a cluster and leaves isolated ones alone', () => {
    // Three near-identical points + one far-away point at zoom 13 (1° cells).
    const markers = [
      m(1, 37.50, 127.00),
      m(2, 37.501, 127.001),
      m(3, 37.502, 127.002),
      m(4, 35.15, 129.0),
    ];
    const out = clusterMarkers(markers, 13);
    const clusters = out.filter((r) => r.kind === 'cluster');
    const pins = out.filter((r) => r.kind === 'pin');
    expect(clusters).toHaveLength(1);
    expect(pins).toHaveLength(1);
    if (clusters[0].kind === 'cluster') {
      expect(clusters[0].count).toBe(3);
      expect(clusters[0].markerIds.sort()).toEqual([1, 2, 3]);
      // Centroid sits near the group average.
      expect(clusters[0].latitude).toBeCloseTo(37.501, 2);
    }
  });

  it('keeps the selected marker standalone even when it would otherwise cluster', () => {
    const markers = [m(1, 37.5, 127.0), m(2, 37.501, 127.001), m(3, 37.502, 127.002)];
    const out = clusterMarkers(markers, 13, { selectedId: 2 });
    // Selected id=2 renders as an individual pin, the other two collapse to a cluster.
    const selectedPin = out.find(
      (r) => r.kind === 'pin' && r.marker.id === 2,
    );
    expect(selectedPin).toBeDefined();
    const cluster = out.find((r) => r.kind === 'cluster');
    expect(cluster).toBeDefined();
    if (cluster && cluster.kind === 'cluster') {
      expect(cluster.markerIds.sort()).toEqual([1, 3]);
      expect(cluster.count).toBe(2);
    }
  });

  it('honours cellDegForLevel override for deterministic tests', () => {
    const markers = [m(1, 0.0, 0.0), m(2, 0.3, 0.0)];
    // Custom cell: 0.5° → both fall into the same bucket.
    const out = clusterMarkers(markers, 7, { cellDegForLevel: () => 0.5 });
    expect(out.filter((r) => r.kind === 'cluster')).toHaveLength(1);

    // Custom cell: 0.1° → markers separate.
    const out2 = clusterMarkers(markers, 7, { cellDegForLevel: () => 0.1 });
    expect(out2.filter((r) => r.kind === 'cluster')).toHaveLength(0);
    expect(out2.filter((r) => r.kind === 'pin')).toHaveLength(2);
  });

  it('merging intensifies as zoom level rises (more cluster, fewer pins)', () => {
    // Eight markers packed within ~0.14° — tight enough that a level-9 cell
    // (≈0.067°) groups them into ~3 clusters, and a level-14 cell (~0.95°)
    // collapses them into a single one.
    const markers = [
      m(1, 37.50, 127.00),
      m(2, 37.52, 127.00),
      m(3, 37.54, 127.00),
      m(4, 37.56, 127.00),
      m(5, 37.58, 127.00),
      m(6, 37.60, 127.00),
      m(7, 37.62, 127.00),
      m(8, 37.64, 127.00),
    ];

    const countGroups = (level: number) => clusterMarkers(markers, level).length;

    // At high zoom (no clustering) each marker is its own pin.
    expect(countGroups(3)).toBe(8);
    // At mid zoom, some merging begins, so total group count falls.
    expect(countGroups(9)).toBeLessThan(8);
    // At max zoom, the whole set collapses closer to a single cluster.
    expect(countGroups(14)).toBeLessThan(countGroups(9));
    // Level 14 should cram everything into 1 group.
    expect(countGroups(14)).toBe(1);
  });

  it('selected marker that is not in the markers list is ignored (no ghost pin)', () => {
    const markers = [m(1, 37.5, 127.0), m(2, 37.6, 127.1)];
    const out = clusterMarkers(markers, 13, { selectedId: 99 });
    // Still two pins or clusters covering the two given markers.
    expect(out.flatMap((r) => (r.kind === 'pin' ? [r.marker.id] : r.markerIds)).sort())
      .toEqual([1, 2]);
  });
});
