<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import DeviceFallback from './DeviceFallback.vue'
import { usePhoneScene } from '@/composables/usePhoneScene'
import { usePrefersReducedMotion } from '@/composables/usePrefersReducedMotion'

const props = defineProps({
  textureUrl: { type: String, default: '' },
  textureUrls: { type: Array, default: () => [] },
  interactive: { type: Boolean, default: false },
})

const emit = defineEmits(['change'])

const canvasHost = ref(null)
const reducedMotion = usePrefersReducedMotion()
const {
  webglSupported,
  activeTextureUrl,
  isDragging,
  focusedIndex,
  mount,
  setScreenTexture,
  setTextureUrls,
  setReducedMotion,
  nextSlide,
  prevSlide,
  focusIndex,
  exitFocus,
} = usePhoneScene({
  enableIdle: true,
  enableScrollParallax: !props.interactive,
  autoRotateSpeed: 0.16,
})

// 聚焦时显示的大图地址
const focusedSrc = computed(
  () => (focusedIndex.value >= 0 ? props.textureUrls[focusedIndex.value] : ''),
)

onMounted(() => {
  if (!canvasHost.value) return
  mount(canvasHost.value, {
    reduced: reducedMotion.value,
    textureUrl: props.textureUrl,
    urls: props.textureUrls,
  })
})

watch(
  () => props.textureUrls,
  (urls) => {
    if (urls?.length) setTextureUrls(urls)
  },
  { deep: true },
)

watch(
  () => props.textureUrl,
  (url) => {
    if (url) setScreenTexture(url, { animate: true })
  },
)

watch(activeTextureUrl, (url) => {
  if (url) emit('change', url)
})

watch(reducedMotion, (value) => {
  setReducedMotion(value)
})

function onKeydown(e) {
  if (e.key === 'Escape' && focusedIndex.value >= 0) {
    exitFocus()
    e.preventDefault()
  } else if (e.key === 'ArrowLeft') {
    prevSlide()
    e.preventDefault()
  } else if (e.key === 'ArrowRight') {
    nextSlide()
    e.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="hero-scene"
    :class="{
      'hero-scene--dragging': isDragging,
      'hero-scene--focused': focusedIndex >= 0,
    }"
  >
    <div
      ref="canvasHost"
      class="hero-scene__canvas"
      :class="{ 'hero-scene__canvas--hidden': !webglSupported }"
      role="img"
      aria-label="Kira 三维设备滚筒展示，点击截图可放大查看"
      tabindex="0"
    />
    <DeviceFallback
      v-if="!webglSupported"
      :src="textureUrl || textureUrls[0] || ''"
      alt="Kira 应用截图（静态预览）"
    />

    <!-- 聚焦层：背景模糊 + 居中大图。以视口高度为准 contain 竖图。 -->
    <div v-if="focusedIndex >= 0" class="hero-scene__focus" role="dialog" aria-modal="true">
      <div class="hero-scene__scrim" aria-hidden="true" @click="exitFocus" />
      <img
        :src="focusedSrc"
        class="hero-scene__focus-img"
        alt="Kira 界面截图（大图）"
        @click.stop="exitFocus"
      />
    </div>
  </div>
</template>

<style scoped>
.hero-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
}
.hero-scene__canvas {
  width: 100%;
  height: 100%;
  min-height: 320px;
  border-radius: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
  background: transparent;
}
.hero-scene__canvas--hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}
.hero-scene--dragging .hero-scene__canvas {
  cursor: grabbing;
}
.hero-scene--focused .hero-scene__canvas {
  cursor: zoom-out;
}

/* 聚焦层：基于视口固定定位，避免被矮容器裁切 */
.hero-scene__focus {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4vmin;
  overflow: hidden;
}
.hero-scene__scrim {
  position: absolute;
  inset: 0;
  background: rgb(8 8 18 / 0.6);
  backdrop-filter: blur(12px) saturate(120%);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  cursor: zoom-out;
  animation: scrim-in 220ms ease;
}
.hero-scene__focus-img {
  position: relative;
  z-index: 1;
  /* 竖图以高度为准 contain，宽度按比例自适应 */
  height: min(92dvh, 92%);
  width: auto;
  max-width: 100%;
  border-radius: 14px;
  object-fit: contain;
  box-shadow: 0 24px 80px rgb(0 0 0 / 0.6), 0 0 60px rgb(124 58 237 / 0.18);
  cursor: zoom-out;
  animation: focus-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@media (orientation: landscape) {
  /* 横屏时高度受限，仍优先高度 contain */
  .hero-scene__focus-img {
    height: min(88dvh, 92%);
  }
}
@keyframes scrim-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes focus-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .hero-scene__scrim,
  .hero-scene__focus-img {
    animation: none;
  }
}
</style>
