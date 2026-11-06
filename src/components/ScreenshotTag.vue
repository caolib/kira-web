<script setup>
import { BookOpen } from 'lucide-vue-next'

defineProps({
  shot: { type: Object, required: true },
  icon: { type: [Object, Function], default: () => BookOpen },
  as: { type: String, default: 'div' },
  assemblyGroup: { type: String, default: '' },
  floating: Boolean,
  offset: Boolean,
})
</script>

<template>
  <component :is="as" class="screenshot-caption" :data-shot-caption="shot.id" :aria-label="`${shot.label}特点`">
    <div
      class="screenshot-tag-slot"
      :class="{ 'is-offset': offset }"
      :data-shot-tag="shot.id"
      :data-assembly-group="assemblyGroup || undefined"
      data-build="slots"
      data-build-delay="240"
      :data-floating="floating ? 'playing' : 'paused'"
    >
      <span v-for="(tag, index) in shot.tags" :key="tag" class="screenshot-tag" :style="{ '--tag-index': index }">
        <component :is="icon" :size="14" aria-hidden="true" /><span>{{ tag }}</span>
      </span>
    </div>
  </component>
</template>
