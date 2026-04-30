<template>
  <!-- 작은 자식 — SearchPlaceModal 의 결과/추천 한 줄. 디자인의 SearchResultRow 와
       동일하지만 emoji/색상 박스 → scene 이미지 thumb + content chip 으로 우리 톤 치환. -->
  <div class="rt-row" data-testid="rt-search-row">
    <div class="rt-row-thumb" :class="{ 'is-empty': !thumbUrl }">
      <img v-if="thumbUrl" :src="thumbUrl" :alt="`${place.name} 장면`" />
      <ion-icon v-else :icon="locationOutline" class="ic-22" aria-hidden="true" />
    </div>
    <div class="rt-row-body">
      <div class="rt-row-name">{{ place.name }}</div>
      <div class="rt-row-meta">
        <span>{{ place.contentTitle }}</span>
        <span class="rt-sep" aria-hidden="true">·</span>
        <span>{{ place.regionLabel }}</span>
        <template v-if="place.rating">
          <span class="rt-sep" aria-hidden="true">·</span>
          <span>★ {{ place.rating.toFixed(1) }}</span>
        </template>
      </div>
    </div>
    <button
      type="button"
      class="rt-row-add"
      :aria-label="`${place.name} 코스에 추가`"
      data-testid="rt-row-add"
      @click="emit('add')"
    >
      ＋
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import { locationOutline } from 'ionicons/icons';
import type { TripPlace } from '@/stores/tripRoute';

const props = defineProps<{ place: TripPlace }>();
const emit = defineEmits<{ (e: 'add'): void }>();

/** 우선순위: scene > cover > null. SearchPage / Home 의 row 와 동일. */
const thumbUrl = computed<string | null>(
  () => props.place.sceneImageUrl ?? props.place.coverImageUrl ?? null,
);
</script>

<style scoped>
.rt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--fr-line-soft, #f3f4f6);
}
.rt-row-thumb {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--fr-bg-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fr-ink-3);
}
.rt-row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rt-row-body {
  flex: 1;
  min-width: 0;
}
.rt-row-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--fr-ink);
  letter-spacing: -0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rt-row-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 12px;
  color: var(--fr-ink-3);
  flex-wrap: wrap;
}
.rt-row-meta .rt-sep {
  color: var(--fr-line);
}
.rt-row-add {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--fr-primary);
  border: 0;
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(20, 188, 237, 0.4);
}
</style>
