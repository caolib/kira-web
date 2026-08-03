<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import DeviceFallback from './DeviceFallback.vue'
import { useStageScene } from '@/composables/useStageScene'
import { usePrefersReducedMotion } from '@/composables/usePrefersReducedMotion'

const props = defineProps({
  textureUrls: { type: Array, default: () => [] },
})

const emit = defineEmits(['change'])

const canvasHost = ref(null)
const reducedMotion = usePrefersReducedMotion()
const {
  webglSupported,
  activeTextureUrl,
  mount,
  setTextureUrls,
  setReducedMotion,
  nextSlide,
  prevSlide,
} = useStageScene()

onMounted(() => {
  if (!canvasHost.value) return
  mount(canvasHost.value, {
    reduced: reducedMotion.value,
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

watch(activeTextureUrl, (url) => {
  if (url) emit('change', url)
})

watch(reducedMotion, (value) => {
  setReducedMotion(value)
})

function onKeydown(e) {
  if (e.key === 'ArrowLeft') {
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
  <div class="stage-scene">
    <div
      ref="canvasHost"
      class="stage-scene__canvas"
      :class="{ 'stage-scene__canvas--hidden': !webglSupported }"
      role="img"
      aria-label="Kira 设备展台展示"
      tabindex="0"
    />
    <DeviceFallback
      v-if="!webglSupported"
      :src="textureUrls[0] || ''"
      alt="Kira 应用截图（静态预览）"
    />
  </div>
</template>

<style scoped>
.stage-scene {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
}
.stage-scene__canvas {
  width: 100%;
  height: 100%;
  min-height: 320px;
  border-radius: 0;
  overflow: hidden;
  user-select: none;
  background: transparent;
}
.stage-scene__canvas--hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}
</style>
