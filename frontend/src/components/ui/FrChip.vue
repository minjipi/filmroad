<template>
  <span :class="['fr-chip', variantClass]">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type Variant = 'primary' | 'soft' | 'dark' | 'ghost';

const props = withDefaults(defineProps<{ variant?: Variant }>(), {
  variant: 'primary',
});

const variantClass = computed(() => `fr-chip-${props.variant}`);
</script>
