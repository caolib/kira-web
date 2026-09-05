<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
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
  setAutoCyclePaused,
  goToIndex,
  nextSlide,
  prevSlide,
} = useStageScene()

// —— 大图预览 ——
const lightboxOpen = ref(false)
const lightboxSrc = ref('')
const lightboxIndex = ref(0)
const closeBtn = ref(null)

function openLightbox() {
  if (!activeTextureUrl.value) return
  const idx = props.textureUrls.indexOf(activeTextureUrl.value)
  lightboxIndex.value = idx === -1 ? 0 : idx
  // 固定点击瞬间的截图地址，预览期间场景继续轮播也不影响
  lightboxSrc.value = activeTextureUrl.value
  lightboxOpen.value = true
  setAutoCyclePaused(true)
  nextTick(() => closeBtn.value?.focus({ preventScroll: true }))
}

function closeLightbox() {
  if (!lightboxOpen.value) return
  lightboxOpen.value = false
  setAutoCyclePaused(false)
  canvasHost.value?.focus({ preventScroll: true })
}

/** 预览内左右切换；场景同步过渡到同一张，关闭后保持一致 */
function stepLightbox(dir) {
  const n = props.textureUrls.length
  if (!n) return
  lightboxIndex.value = (lightboxIndex.value + dir + n) % n
  const url = props.textureUrls[lightboxIndex.value]
  if (!url) return
  lightboxSrc.value = url
  goToIndex(lightboxIndex.value)
}

onMounted(() => {
  if (!canvasHost.value) return
  mount(canvasHost.value, {
    reduced: reducedMotion.value,
    urls: props.textureUrls,
    onScreenClick: openLightbox,
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
  if (lightboxOpen.value) {
    if (e.key === 'Escape') {
      closeLightbox()
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      stepLightbox(-1)
      e.preventDefault()
    } else if (e.key === 'ArrowRight') {
      stepLightbox(1)
      e.preventDefault()
    }
    return
  }
  if (e.key === 'ArrowLeft') {
    prevSlide()
    e.preventDefault()
  } else if (e.key === 'ArrowRight') {
    nextSlide()
    e.preventDefault()
  } else if (e.key === 'Enter' || e.key === ' ') {
    // 键盘可达性：画布聚焦时回车/空格打开预览
    if (webglSupported.value) {
      openLightbox()
      e.preventDefault()
    }
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
      aria-label="Kira 设备展台展示，点击手机可放大查看截图"
      tabindex="0"
    />
    <DeviceFallback
      v-if="!webglSupported"
      :src="textureUrls[0] || ''"
      alt="Kira 应用截图（静态预览）"
    />

    <Teleport to="body">
      <Transition name="lightbox">
        <div
          v-if="lightboxOpen"
          class="screen-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="应用截图大图预览"
          @click="closeLightbox"
        >
          <img
            :src="lightboxSrc"
            alt="Kira 应用截图大图"
            class="screen-lightbox__img"
            @click.stop
          />
          <button
            type="button"
            class="screen-lightbox__nav screen-lightbox__nav--prev"
            aria-label="上一张"
            @click.stop="stepLightbox(-1)"
          >
            <ChevronLeft class="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="screen-lightbox__nav screen-lightbox__nav--next"
            aria-label="下一张"
            @click.stop="stepLightbox(1)"
          >
            <ChevronRight class="h-5 w-5" aria-hidden="true" />
          </button>
          <div class="screen-lightbox__count">
            {{ lightboxIndex + 1 }} / {{ props.textureUrls.length }}
          </div>
          <button
            ref="closeBtn"
            type="button"
            class="screen-lightbox__close"
            aria-label="关闭预览"
            @click="closeLightbox"
          >
            <X class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </Transition>
    </Teleport>
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

.screen-lightbox {
  /* 绝对定位 + inset/margin 居中用的内边距变量 */
  --lb-pad: clamp(12px, 3vw, 40px);
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgb(0 0 0 / 0.82);
  backdrop-filter: blur(10px);
}
.screen-lightbox__img {
  /* 经典绝对居中：百分比基于视口确定性解析，配 max 约束不会溢出
     （grid/flex 子项的固有尺寸会顶开 max-height，导致竖长图溢出） */
  position: absolute;
  inset: 0;
  margin: auto;
  max-width: calc(100% - var(--lb-pad) * 2);
  max-height: calc(100% - var(--lb-pad) * 2);
  object-fit: contain;
  border-radius: 14px;
  box-shadow: 0 30px 90px rgb(0 0 0 / 0.6);
  background: #1a1630;
}
.screen-lightbox__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.12);
  color: #fff;
  cursor: pointer;
  transition: background 160ms ease;
}
.screen-lightbox__nav:hover {
  background: rgb(255 255 255 / 0.26);
}
.screen-lightbox__nav--prev {
  left: max(14px, env(safe-area-inset-left));
}
.screen-lightbox__nav--next {
  right: max(14px, env(safe-area-inset-right));
}
.screen-lightbox__count {
  position: absolute;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 10px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.45);
  color: rgb(255 255 255 / 0.8);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.screen-lightbox__close {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  right: max(14px, env(safe-area-inset-right));
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.12);
  color: #fff;
  cursor: pointer;
  transition: background 160ms ease;
}
.screen-lightbox__close:hover {
  background: rgb(255 255 255 / 0.26);
}

.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 180ms ease;
}
.lightbox-enter-active .screen-lightbox__img {
  transition: transform 180ms ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
.lightbox-enter-from .screen-lightbox__img {
  transform: scale(0.92);
}
</style>
