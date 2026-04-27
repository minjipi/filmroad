import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

// Kakao SDK 가짜 — kakao.maps.{Map, LatLng, Marker, LatLngBounds} 의 호출이
// 어떤 인자로 들어왔는지만 검증. setBounds / setCenter / setLevel 호출 여부로
// "여러 핀이면 fit, 단일 핀이면 고정 줌" 분기를 본다.
const fake = vi.hoisted(() => {
  const setMap = vi.fn();
  const setCenter = vi.fn();
  const setLevel = vi.fn();
  const setBounds = vi.fn();
  const extend = vi.fn();
  // Map 생성 자체도 옵션을 캡처해 draggable=false 가 들어가는지 확인.
  const mapCtor = vi.fn().mockImplementation(() => ({
    setCenter,
    setLevel,
    setBounds,
  }));
  const markerCtor = vi.fn().mockImplementation(() => ({ setMap }));
  const boundsCtor = vi.fn().mockImplementation(() => ({ extend }));
  const latLngCtor = vi.fn().mockImplementation((lat: number, lng: number) => ({ lat, lng }));
  return {
    setMap, setCenter, setLevel, setBounds, extend,
    mapCtor, markerCtor, boundsCtor, latLngCtor,
  };
});

vi.mock('@/services/kakaoMap', () => ({
  loadKakaoMap: vi.fn().mockImplementation(() => Promise.resolve({
    maps: {
      Map: fake.mapCtor,
      Marker: fake.markerCtor,
      LatLng: fake.latLngCtor,
      LatLngBounds: fake.boundsCtor,
    },
  })),
}));

import VisitMap from '@/components/profile/VisitMap.vue';

describe('VisitMap.vue', () => {
  beforeEach(() => {
    fake.setMap.mockClear();
    fake.setCenter.mockClear();
    fake.setLevel.mockClear();
    fake.setBounds.mockClear();
    fake.extend.mockClear();
    fake.mapCtor.mockClear();
    fake.markerCtor.mockClear();
    fake.boundsCtor.mockClear();
    fake.latLngCtor.mockClear();
  });

  it('empty pins → empty placeholder, no kakao SDK load', async () => {
    const w = mount(VisitMap, {
      props: { pins: [] },
      global: { stubs: { 'ion-icon': true } },
    });
    await flushPromises();

    expect(w.find('[data-testid="visit-map-empty"]').exists()).toBe(true);
    expect(w.find('[data-testid="visit-map-overlay"]').text()).toContain('0곳');
    // 빈 상태에선 SDK 로드를 시도하지 않아야 한다.
    expect(fake.mapCtor).not.toHaveBeenCalled();
  });

  it('multiple pins → setBounds fits all (no setLevel for single-pin fallback)', async () => {
    mount(VisitMap, {
      props: {
        pins: [
          { latitude: 37.5665, longitude: 126.9780 }, // 서울
          { latitude: 35.1796, longitude: 129.0756 }, // 부산
          { latitude: 35.8714, longitude: 128.6014 }, // 대구
        ],
      },
      global: { stubs: { 'ion-icon': true } },
    });
    await flushPromises();

    expect(fake.mapCtor).toHaveBeenCalledTimes(1);
    // Map 옵션 — draggable=false 가 들어가는지 확인 (비-인터랙티브).
    const mapOpts = fake.mapCtor.mock.calls[0][1] as Record<string, unknown>;
    expect(mapOpts.draggable).toBe(false);
    expect(mapOpts.scrollwheel).toBe(false);

    // 핀 3개 → Marker 3번 생성 + 3번 extend.
    expect(fake.markerCtor).toHaveBeenCalledTimes(3);
    expect(fake.extend).toHaveBeenCalledTimes(3);
    // setBounds 가 호출돼 자동 fit. setLevel 단일핀 폴백은 안 탄다.
    expect(fake.setBounds).toHaveBeenCalledTimes(1);
    expect(fake.setLevel).not.toHaveBeenCalled();
  });

  it('single pin → setCenter + setLevel(SINGLE_PIN_ZOOM=5), no setBounds', async () => {
    mount(VisitMap, {
      props: { pins: [{ latitude: 37.5665, longitude: 126.978 }] },
      global: { stubs: { 'ion-icon': true } },
    });
    await flushPromises();

    expect(fake.markerCtor).toHaveBeenCalledTimes(1);
    // 단일 핀에서 setBounds 는 너무 가까이 줌인되므로 고정 레벨 폴백.
    expect(fake.setBounds).not.toHaveBeenCalled();
    expect(fake.setCenter).toHaveBeenCalledTimes(1);
    expect(fake.setLevel).toHaveBeenCalledWith(5);
  });

  it('overlay click emits "open" so parent can navigate to /map', async () => {
    const w = mount(VisitMap, {
      props: { pins: [{ latitude: 37.5665, longitude: 126.978 }] },
      global: { stubs: { 'ion-icon': true } },
    });
    await flushPromises();
    await w.find('[data-testid="visit-map-overlay"]').trigger('click');
    expect(w.emitted('open')).toBeTruthy();
  });

  it('lazy init: empty pins at mount → pins arrive later → kakao Map is constructed exactly once', async () => {
    // 회귀 차단 — 처음에 pins=[] 로 마운트되면 init 이 SDK 로드를 건너뛰고
    // early return. profileStore.fetch 가 끝난 뒤 pins 가 도착하면 그제서야
    // Map 이 생성돼야 하고 (canvas 가 빈 채로 머물러서는 안 됨), 그 뒤
    // 추가 pin 갱신은 Map 을 다시 만들지 않는다.
    const w = mount(VisitMap, {
      props: { pins: [] as Array<{ latitude: number; longitude: number }> },
      global: { stubs: { 'ion-icon': true } },
    });
    await flushPromises();
    expect(fake.mapCtor).not.toHaveBeenCalled();

    await w.setProps({
      pins: [
        { latitude: 37.5665, longitude: 126.978 },
        { latitude: 35.1796, longitude: 129.0756 },
      ],
    });
    await flushPromises();
    expect(fake.mapCtor).toHaveBeenCalledTimes(1);
    expect(fake.markerCtor).toHaveBeenCalledTimes(2);
    expect(fake.setBounds).toHaveBeenCalledTimes(1);

    // 추가 pin 갱신은 마커만 다시 그리고 Map 재생성하지 않는다.
    fake.markerCtor.mockClear();
    fake.setBounds.mockClear();
    await w.setProps({
      pins: [
        { latitude: 37.5665, longitude: 126.978 },
        { latitude: 35.1796, longitude: 129.0756 },
        { latitude: 35.8714, longitude: 128.6014 },
      ],
    });
    await flushPromises();
    expect(fake.mapCtor).toHaveBeenCalledTimes(1); // 여전히 1번
    expect(fake.markerCtor).toHaveBeenCalledTimes(3); // 3개 마커 다시
    expect(fake.setBounds).toHaveBeenCalledTimes(1);
  });

  it('overlay shows the pin count in 곳-form', async () => {
    const w = mount(VisitMap, {
      props: {
        pins: Array.from({ length: 12 }, (_, i) => ({
          latitude: 37 + i * 0.1,
          longitude: 127,
        })),
      },
      global: { stubs: { 'ion-icon': true } },
    });
    await flushPromises();
    expect(w.find('[data-testid="visit-map-overlay"]').text()).toContain('12곳');
  });
});
