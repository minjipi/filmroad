import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

import ScoreRevealOverlay from '@/components/upload/ScoreRevealOverlay.vue';

function mountReveal(props: {
  loading: boolean;
  totalScore?: number | null;
  similarityScore?: number | null;
  gpsScore?: number | null;
  disableAnimation?: boolean;
} = { loading: true }) {
  return mount(ScoreRevealOverlay, {
    props: { disableAnimation: true, ...props },
    global: {
      stubs: {
        // ion-spinner has no JSDOM-friendly impl; stub keeps the test clean.
        'ion-spinner': true,
      },
    },
  });
}

describe('ScoreRevealOverlay.vue', () => {
  it('loading=true renders the score-loading affordance and hides the result block', () => {
    const wrapper = mountReveal({ loading: true });

    expect(wrapper.find('[data-testid="score-loading"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="score-total"]').exists()).toBe(false);
    expect(wrapper.attributes('aria-busy')).toBe('true');
  });

  it('loading=false with disableAnimation snaps total/similarity/gps to the prop values', async () => {
    const wrapper = mountReveal({
      loading: false,
      totalScore: 84,
      similarityScore: 82,
      gpsScore: 86,
      disableAnimation: true,
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="score-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('84');
    expect(wrapper.find('[data-testid="score-similarity"]').text()).toBe('82');
    expect(wrapper.find('[data-testid="score-gps"]').text()).toBe('86');
  });

  it('totalScore=0 renders "0" (not blank, not "—") — falsy guard regression', async () => {
    const wrapper = mountReveal({
      loading: false,
      totalScore: 0,
      similarityScore: 0,
      gpsScore: 0,
      disableAnimation: true,
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="score-similarity"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="score-gps"]').text()).toBe('0');
  });

  it('null/undefined breakdown values render as "—" without blowing up', async () => {
    const wrapper = mountReveal({
      loading: false,
      totalScore: null,
      similarityScore: null,
      gpsScore: null,
      disableAnimation: true,
    });
    await flushPromises();

    // total stays as dash because totalScore is null
    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('—');
    expect(wrapper.find('[data-testid="score-similarity"]').text()).toBe('—');
    expect(wrapper.find('[data-testid="score-gps"]').text()).toBe('—');
  });

  it('emits count-up-complete once the animation lands (parent listens to schedule stage transition)', async () => {
    const wrapper = mountReveal({
      loading: false,
      totalScore: 50,
      similarityScore: 50,
      gpsScore: 50,
      disableAnimation: true,
    });
    await flushPromises();

    expect(wrapper.emitted('count-up-complete')).toBeTruthy();
    expect(wrapper.emitted('count-up-complete')!.length).toBe(1);
  });

  it('flipping loading false → true → false re-runs the count-up (totalScore picked up on each flip)', async () => {
    const wrapper = mountReveal({
      loading: false,
      totalScore: 70,
      disableAnimation: true,
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('70');

    // Loading flips back on (e.g. retry) — overlay returns to loading state.
    await wrapper.setProps({ loading: true });
    expect(wrapper.find('[data-testid="score-loading"]').exists()).toBe(true);

    // New score arrives — the result mode shows it.
    await wrapper.setProps({ loading: false, totalScore: 92 });
    await flushPromises();
    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('92');
  });

  // QA #7 — accessibility regression: post-task-#8 the component is no longer a
  // dialog (inline embed in /upload's check-wrap), so role=dialog/aria-modal
  // are gone. aria-busy / aria-label remain meaningful and stay synced.
  it('accessibility — aria-busy reflects loading flag, aria-label is set, no dialog wrapper', async () => {
    const loadingWrapper = mountReveal({ loading: true });
    expect(loadingWrapper.attributes('aria-busy')).toBe('true');
    expect(loadingWrapper.attributes('aria-label')).toBeTruthy();
    // Inline embed — no dialog role/modal flag any more.
    expect(loadingWrapper.attributes('role')).toBeUndefined();
    expect(loadingWrapper.attributes('aria-modal')).toBeUndefined();

    const resultWrapper = mountReveal({
      loading: false,
      totalScore: 50,
      similarityScore: 50,
      gpsScore: 50,
      disableAnimation: true,
    });
    await flushPromises();
    // aria-busy 가 false 일 때 vue 는 attribute 자체를 떼는 경우가 있음 — string false 또는 null 둘 다 허용.
    const busy = resultWrapper.attributes('aria-busy');
    expect(busy === 'false' || busy === undefined).toBe(true);
  });

  // QA #7 — score-total 의 aria-label 이 prop 에 연동되어 스크린 리더에 정확한 점수를 전달.
  it('total aria-label reflects totalScore for screen readers (numeric vs missing)', async () => {
    const numericWrapper = mountReveal({
      loading: false,
      totalScore: 88,
      disableAnimation: true,
    });
    await flushPromises();
    expect(numericWrapper.find('[data-testid="score-total"]').attributes('aria-label'))
      .toBe('총점 88');

    const missingWrapper = mountReveal({
      loading: false,
      totalScore: null,
      disableAnimation: true,
    });
    await flushPromises();
    expect(missingWrapper.find('[data-testid="score-total"]').attributes('aria-label'))
      .toBe('총점 미산정');
  });

  // QA #7 — breakdown 부분 null 회귀: gps 만 null 일 때 similarity 는 정상 표시되어야 함.
  it('partial null breakdown — similarity numeric + gps null renders correctly', async () => {
    const wrapper = mountReveal({
      loading: false,
      totalScore: 50,
      similarityScore: 78,
      gpsScore: null,
      disableAnimation: true,
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="score-similarity"]').text()).toBe('78');
    expect(wrapper.find('[data-testid="score-gps"]').text()).toBe('—');
    expect(wrapper.find('[data-testid="score-total"]').text()).toBe('50');
  });
});
