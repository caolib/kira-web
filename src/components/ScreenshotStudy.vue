<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Pause, Play, ZoomIn } from '@/icons'
import ScreenshotTag from './ScreenshotTag.vue'
import ScreenshotImage from './ScreenshotImage.vue'

const props = defineProps({
  shots: { type: Array, required: true },
  label: { type: String, required: true },
  paused: Boolean,
  assemblyGroup: { type: String, default: '' },
})
const emit = defineEmits(['preview', 'interact'])
const root = ref(null)
const selected = ref(0)
const current = computed(() => props.shots[selected.value])
const ready = ref(new Set())
const visible = ref(false)
const pageVisible = ref(true)
const reducedMotion = ref(true)
const userPaused = ref(false)
const hovered = ref(false)
const focused = ref(false)
const switching = ref(false)
const canRotate = computed(() => props.shots.length > 1 &&
  props.shots.every(shot => ready.value.has(shot.src)) &&
  visible.value && pageVisible.value && !reducedMotion.value &&
  !props.paused && !userPaused.value && !hovered.value && !focused.value)
let rotationTimer
let transitionTimer
let observer
let preference
const tagsFloating = computed(() => canRotate.value && !switching.value && Boolean(observer))

function finishSwitch() {
  clearTimeout(transitionTimer)
  switching.value = false
}

function nextImage() {
  emit('interact')
  if (switching.value || props.shots.length < 2) return
  switching.value = !reducedMotion.value
  selected.value = (selected.value + 1) % props.shots.length
  // 动画被浏览器取消时也能收尾，不留下常驻帧循环。
  if (switching.value) transitionTimer = window.setTimeout(finishSwitch, 400)
}

function scheduleRotation() {
  clearTimeout(rotationTimer)
  if (canRotate.value && !switching.value) {
    rotationTimer = window.setTimeout(nextImage, 5000)
  }
}

function syncEnvironment() {
  pageVisible.value = !document.hidden
  reducedMotion.value = preference.matches
  if (!pageVisible.value || reducedMotion.value) finishSwitch()
}

function onFocusOut(event) {
  focused.value = root.value?.contains(event.relatedTarget) || false
}

function activateImage(index) {
  emit('interact')
  if (index !== selected.value) nextImage()
  else emit('preview', current.value)
}

watch([canRotate, switching], scheduleRotation)
watch([visible, () => props.paused], () => {
  if (!visible.value || props.paused) finishSwitch()
})

onMounted(() => {
  preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncEnvironment()
  preference.addEventListener('change', syncEnvironment)
  document.addEventListener('visibilitychange', syncEnvironment)
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      visible.value = entry.isIntersecting && entry.intersectionRatio >= 0.12
    }, { threshold: [0, 0.12] })
    observer.observe(root.value)
  } else {
    visible.value = true
  }
})

onUnmounted(() => {
  clearTimeout(rotationTimer)
  clearTimeout(transitionTimer)
  observer?.disconnect()
  preference?.removeEventListener('change', syncEnvironment)
  document.removeEventListener('visibilitychange', syncEnvironment)
})
</script>

<template>
  <figure
    ref="root"
    class="screenshot-study study-wide"
    :class="{ 'is-switching': switching }"
    :aria-label="label"
    :data-rotation="canRotate ? 'playing' : 'paused'"
    :data-assembly-group="assemblyGroup || undefined"
    :data-build="assemblyGroup ? 'frame' : undefined"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="onFocusOut"
  >
    <div class="screenshot-stack" :data-assembly-anchor="assemblyGroup ? '' : undefined">
      <button
        v-for="(shot, index) in shots"
        :key="shot.id"
        type="button"
        class="phone-shot stack-shot"
        :class="index === selected ? 'is-front' : 'is-back'"
        :data-shot="shot.id"
        :style="{ aspectRatio: `${shot.width} / ${shot.height}` }"
        :data-build="assemblyGroup ? 'frame' : undefined"
        :data-build-part="`frame-${shot.id}`"
        :data-build-delay="index === selected ? 340 : 160"
        :aria-label="`${index === selected ? '放大查看' : '切换到'}：${shot.label}`"
        @click="activateImage(index)"
      >
        <ScreenshotImage
          :shot="shot"
          :data-build="assemblyGroup ? 'image' : undefined"
          :data-build-part="`image-${shot.id}`"
          :data-build-delay="index === selected ? 500 : 160"
          loading="lazy"
          @load="ready.add(shot.src)"
        />
        <span v-if="index === selected" class="shot-zoom"><ZoomIn :size="20" aria-hidden="true" /></span>
      </button>
    </div>
    <div class="stack-tags">
      <ScreenshotTag v-for="(shot, index) in shots" :key="shot.id" :shot="shot" :floating="tagsFloating" :offset="Boolean(index)" />
    </div>
    <figcaption class="stack-caption">
      <div class="stack-description">
        <span class="stack-count">0{{ selected + 1 }} / 0{{ shots.length }}</span>
      </div>
      <div class="stack-actions">
        <button
          v-if="!reducedMotion"
          class="icon-button"
          type="button"
          :aria-label="userPaused ? '开启截图自动切换' : '暂停截图自动切换'"
          :aria-pressed="userPaused"
          :title="userPaused ? '开启自动切换' : '暂停自动切换'"
          @click="userPaused = !userPaused"
        >
          <Play v-if="userPaused" :size="16" aria-hidden="true" /><Pause v-else :size="16" aria-hidden="true" />
        </button>
      </div>
    </figcaption>
  </figure>
</template>

<style scoped>
.screenshot-study {
  --stack-front: translate(-10%, 0) rotate(-1.2deg);
  --stack-back: translate(13%, 8%) rotate(2.6deg) scale(.97);
  position: relative;
  min-width: 0;
  padding: 28px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--sage);
}

.screenshot-stack {
  display: grid;
  isolation: isolate;
  width: min(1080px, 100%);
  margin-inline: auto;
  padding-block: 22px clamp(48px, 6vw, 80px);
}

.stack-shot {
  grid-area: 1 / 1;
  justify-self: center;
  width: 78%;
  min-width: 0;
  border-width: 5px;
  border-radius: 9px;
}

.stack-shot img { width: 100%; height: 100%; object-fit: contain; }
.stack-shot.is-front { z-index: 2; transform: var(--stack-front); }
.stack-shot.is-back { z-index: 1; transform: var(--stack-back); cursor: pointer; }
.stack-tags { position: absolute; inset: 0; pointer-events: none; }
.stack-tags :deep(.screenshot-tag) { --tag-x: 24px; --tag-y: 12px; --tag-anchor-x: 0%; max-width: calc((100% - 64px) / 2); }
.stack-tags :deep([data-shot-caption='desktop'] .screenshot-tag) { --tag-x: calc(100% - 24px); --tag-anchor-x: -100%; }
.stack-caption { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; }
.stack-description { display: flex; align-items: center; gap: 14px; min-width: 0; font-size: .75rem; color: var(--accent); line-height: 1.8; }
.stack-count { white-space: nowrap; font-size: .6875rem; color: var(--muted); }
.stack-actions { display: flex; align-items: center; flex-shrink: 0; gap: 12px; }
.stack-actions .text-link { font-size: .75rem; color: var(--accent); }
.stack-actions .icon-button:hover { background: var(--surface); }

/* 两张实图短暂错开，再交换层级；其余时间没有动画。 */
.is-switching .stack-shot.is-front { animation: stack-forward 400ms cubic-bezier(.22, 1, .36, 1) both; }
.is-switching .stack-shot.is-back { animation: stack-backward 400ms cubic-bezier(.22, 1, .36, 1) both; }
@keyframes stack-forward {
  0% { transform: var(--stack-back); z-index: 1; }
  49% { transform: translate(14%, 12%) rotate(3deg) scale(.97); z-index: 1; }
  50% { z-index: 2; }
  100% { transform: var(--stack-front); z-index: 2; }
}
@keyframes stack-backward {
  0% { transform: var(--stack-front); z-index: 2; }
  49% { transform: translate(-12%, -4%) rotate(-2deg) scale(.98); z-index: 2; }
  50% { z-index: 1; }
  100% { transform: var(--stack-back); z-index: 1; }
}

@media (max-width: 767px) {
  .screenshot-study { padding: 14px; }
  .screenshot-stack { padding-block: 12px 38px; }
  .stack-tags :deep(.screenshot-tag) { --tag-x: 12px; --tag-y: 0px; max-width: calc((100% - 40px) / 2); }
  .stack-tags :deep([data-shot-caption='desktop'] .screenshot-tag) { --tag-x: calc(100% - 12px); }
  .stack-shot { border-width: 3px; border-radius: 5px; }
  .stack-caption { flex-wrap: wrap; gap: 6px 12px; }
  .stack-description { flex: 1 1 190px; align-items: flex-start; gap: 10px; }
  .stack-actions { margin-left: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .is-switching .stack-shot { animation: none; }
}
</style>
