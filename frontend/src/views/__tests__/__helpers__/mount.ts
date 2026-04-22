import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { vi } from 'vitest';
import type { Component } from 'vue';

interface MountOptions {
  initialState?: Record<string, unknown>;
  stubs?: Record<string, unknown>;
  props?: Record<string, unknown>;
}

const DEFAULT_STUBS = {
  // Ionic wrappers — render children but ignore the component itself.
  'ion-page': { template: '<div><slot /></div>' },
  'ion-content': { template: '<div><slot /></div>' },
  'ion-icon': true,
  FrChip: { template: '<span class="fr-chip-stub"><slot /></span>' },
  FrTabBar: true,
};

export function mountWithStubs<T extends Component>(
  component: T,
  opts: MountOptions = {},
) {
  const pinia = createTestingPinia({
    stubActions: false,
    createSpy: vi.fn,
    initialState: opts.initialState,
  });
  const stubs = { ...DEFAULT_STUBS, ...(opts.stubs ?? {}) };
  const wrapper = mount(component, {
    props: opts.props as Record<string, unknown> as never,
    global: { plugins: [pinia], stubs },
  });
  return { wrapper, pinia };
}
