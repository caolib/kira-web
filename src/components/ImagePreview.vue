<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowUpRight, Maximize2, Minimize2, X } from 'lucide-vue-next'
import { useColorScheme } from '@/composables/useColorScheme'
import { resolveScreenshot } from '@/utils/screenshots'

const props = defineProps({ shot: Object })
const emit = defineEmits(['close'])
const dialog = ref(null)
const image = ref(null)
const viewport = ref(null)
const displayedShot = ref(null)
const scheme = useColorScheme()
const previewShot = computed(() => resolveScreenshot(displayedShot.value, scheme.value))
const phase = ref('closed')
const failed = ref(false)
const loaded = ref(false)
const originalSize = ref(false)
const naturalSize = ref({ width: 0, height: 0 })
const previewLabel = computed(() => displayedShot.value?.label || displayedShot.value?.title || '图片')
const closeDuration = 180
let revision = 0
let closeTimer
let session = null
let pendingNativeCloses = 0
let disposed = false
let backdropPressed = false

function lockPage(trigger) {
  const body = document.body
  const properties = ['overflow-x', 'overflow-y', 'position', 'top', 'left', 'width', 'padding-right']
  const styles = properties.map(property => ({
    property,
    value: body.style.getPropertyValue(property),
    priority: body.style.getPropertyPriority(property),
  }))
  const x = window.scrollX
  const y = window.scrollY
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  const padding = parseFloat(getComputedStyle(body).paddingRight) || 0

  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `${-y}px`
  body.style.left = `${-x}px`
  body.style.width = '100%'
  if (scrollbar > 0) body.style.paddingRight = `${padding + scrollbar}px`
  return { body, styles, x, y, trigger }
}

function restorePage(previous) {
  if (!previous) return
  for (const { property, value, priority } of previous.styles) {
    if (value) previous.body.style.setProperty(property, value, priority)
    else previous.body.style.removeProperty(property)
  }
  if (previous.trigger?.isConnected) previous.trigger.focus({ preventScroll: true })
  window.scrollTo({ left: previous.x, top: previous.y, behavior: 'instant' })
}

function finishClose(token, notify = true) {
  if (token !== revision) return
  clearTimeout(closeTimer)
  const previous = session
  session = null
  phase.value = 'closed'
  if (dialog.value?.open) {
    // close() queues an event. Its later delivery must not close a newer session.
    pendingNativeCloses += 1
    dialog.value.close()
  }
  displayedShot.value = null
  restorePage(previous)
  if (previous && notify) emit('close')
}

function close() {
  if (phase.value === 'closing') return
  const token = ++revision
  clearTimeout(closeTimer)
  if (!session || !dialog.value?.open || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishClose(token)
    return
  }
  phase.value = 'closing'
  // A bounded timer also completes cleanup if CSS animation is cancelled.
  closeTimer = window.setTimeout(() => finishClose(token), closeDuration)
}

function onNativeClose() {
  if (pendingNativeCloses > 0) {
    pendingNativeCloses -= 1
    return
  }
  if (!dialog.value?.open && session) finishClose(++revision)
}

function onBackdropClick(event) {
  if (backdropPressed && event.target === event.currentTarget) close()
  backdropPressed = false
}

function trapFocus(event) {
  if (event.key !== 'Tab') return
  const controls = [...dialog.value.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')]
  const first = controls[0]
  const last = controls[controls.length - 1]
  const active = document.activeElement
  if (!controls.includes(active) || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault()
    const target = event.shiftKey ? last : first
    target?.focus({ preventScroll: true })
  }
}

function onImageLoad() {
  if (!image.value?.naturalWidth) return
  naturalSize.value = { width: image.value.naturalWidth, height: image.value.naturalHeight }
  loaded.value = true
}

async function toggleSize() {
  originalSize.value = !originalSize.value
  await nextTick()
  viewport.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

watch(() => previewShot.value?.full, () => {
  failed.value = false
  loaded.value = false
  originalSize.value = false
  naturalSize.value = { width: 0, height: 0 }
})

watch(() => props.shot, async (shot) => {
  if (!shot) {
    close()
    return
  }
  const token = ++revision
  const trigger = session?.trigger || document.activeElement
  clearTimeout(closeTimer)
  displayedShot.value = shot
  failed.value = false
  loaded.value = false
  originalSize.value = false
  naturalSize.value = { width: 0, height: 0 }
  phase.value = 'open'
  backdropPressed = false
  await nextTick()
  if (disposed || token !== revision || !dialog.value?.isConnected) return

  if (!session) session = lockPage(trigger)
  if (!dialog.value.open) dialog.value.showModal()
  viewport.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  // Reusing the same cached image need not dispatch another load event.
  if (image.value?.complete) onImageLoad()
}, { immediate: true })

onBeforeUnmount(() => {
  disposed = true
  finishClose(++revision, false)
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="image-preview"
      :data-phase="phase"
      :aria-label="`${previewLabel} · 图片预览`"
      @pointerdown="backdropPressed = $event.target === $event.currentTarget"
      @pointercancel="backdropPressed = false"
      @click="onBackdropClick"
      @keydown="trapFocus"
      @cancel.prevent="close"
      @close="onNativeClose"
    >
      <div v-if="displayedShot" class="image-preview-panel">
        <header class="image-preview-header">
          <div class="image-preview-heading">
            <p class="image-preview-eyebrow">IMAGE VIEW / 图片预览</p>
            <h2>{{ previewLabel }}</h2>
          </div>
          <button class="image-preview-close" type="button" aria-label="关闭图片预览" autofocus @click="close">
            <X :size="22" aria-hidden="true" />
          </button>
        </header>
        <div class="image-preview-toolbar">
          <button
            type="button"
            class="image-preview-control"
            :aria-pressed="originalSize"
            :disabled="failed || !loaded"
            @click="toggleSize"
          >
            <Minimize2 v-if="originalSize" :size="17" aria-hidden="true" />
            <Maximize2 v-else :size="17" aria-hidden="true" />
            {{ originalSize ? '适合窗口' : '原始像素（100%）' }}
          </button>
          <a class="image-preview-control" :href="previewShot.full" target="_blank" rel="noopener noreferrer">
            查看原图 <ArrowUpRight :size="17" aria-hidden="true" />
          </a>
        </div>
        <div
          ref="viewport"
          class="image-preview-viewport"
          :class="{ 'is-original': originalSize }"
          tabindex="0"
          role="region"
          aria-label="截图内容，可使用方向键或触摸滚动查看"
        >
          <p v-if="failed" class="image-preview-error" role="status">图片暂时未能加载，可以点击「查看原图」重试。</p>
          <img
            v-else
            :key="previewShot.full"
            ref="image"
            class="image-preview-image"
            :src="previewShot.full"
            :alt="displayedShot.title || previewLabel"
            :width="naturalSize.width || displayedShot.width"
            :height="naturalSize.height || displayedShot.height"
            :style="originalSize ? { width: `${naturalSize.width}px` } : undefined"
            decoding="async"
            @load="onImageLoad"
            @error="failed = true"
          />
        </div>
        <p class="image-preview-hint" aria-live="polite">
          {{ failed ? '也可关闭预览后重新打开。' : !loaded ? '正在加载图片…' : originalSize ? '原始像素 · 可上下、左右滚动查看细节' : '整图预览 · 点击「原始像素」放大并滚动查看细节' }}
        </p>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.image-preview {
  --preview-surface: var(--paper);
  --preview-text: var(--ink);
  --preview-muted: var(--muted);
  --preview-line: var(--rule);
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: clamp(12px, 3vw, 32px);
  border: 0;
  background: transparent;
  color: var(--preview-text);
  overflow: hidden;
  color-scheme: inherit;
}

.image-preview[open] {
  display: grid;
  place-items: center;
}

.image-preview::backdrop {
  background: rgb(0 0 0 / 72%);
}

.image-preview-panel {
  display: flex;
  flex-direction: column;
  width: min(1440px, 100%);
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--preview-line);
  border-radius: 14px;
  background: var(--preview-surface);
}

.image-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px 8px;
}

.image-preview-heading {
  min-width: 0;
}

.image-preview-eyebrow {
  margin: 0 0 4px;
  color: var(--preview-muted);
  font-size: 11px;
  letter-spacing: .1em;
}

.image-preview-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.image-preview-close,
.image-preview-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 8px;
  box-sizing: border-box;
  min-width: 44px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--preview-line);
  border-radius: 7px;
  background: transparent;
  color: var(--preview-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
}

.image-preview-close {
  padding: 10px;
}

.image-preview-control:disabled {
  color: var(--preview-muted);
  cursor: default;
  opacity: .65;
}

.image-preview-control[aria-pressed='true'],
.image-preview-control:not(:disabled):active,
.image-preview-close:active {
  background: var(--sage-strong);
}

.image-preview :is(button, a, [tabindex]):focus-visible {
  outline: 2px solid var(--preview-text);
  outline-offset: -4px;
}

.image-preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 20px 16px;
}

.image-preview-viewport {
  display: grid;
  place-items: center;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  overscroll-behavior: contain;
  background: var(--sage);
  border-block: 1px solid var(--preview-line);
}

.image-preview-image {
  display: block;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  margin: 0;
  border: 0;
  border-radius: 0;
}

.image-preview-viewport.is-original {
  display: block;
  overflow: auto;
  scrollbar-gutter: stable;
}

.is-original .image-preview-image {
  height: auto;
  max-width: none;
  max-height: none;
  margin: 0 auto;
}

.image-preview-error {
  padding: 32px 20px;
  color: var(--preview-muted);
  text-align: center;
  line-height: 1.8;
}

.image-preview-hint {
  margin: 0;
  padding: 12px 20px;
  color: var(--preview-muted);
  font-size: 12px;
  line-height: 1.6;
}

.image-preview[data-phase='open'] .image-preview-panel {
  animation: preview-enter 240ms cubic-bezier(.2, .7, .2, 1) both;
}

.image-preview[data-phase='open']::backdrop {
  animation: preview-fade-in 240ms ease-out both;
}

.image-preview[data-phase='closing'] .image-preview-panel {
  animation: preview-leave 180ms ease-in both;
}

.image-preview[data-phase='closing']::backdrop {
  animation: preview-fade-out 180ms ease-in both;
}

@keyframes preview-enter {
  from { opacity: 0; transform: translateY(10px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes preview-leave {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(6px) scale(.99); }
}

@keyframes preview-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes preview-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@media (hover: hover) {
  .image-preview-control:not(:disabled):hover,
  .image-preview-close:hover {
    background: var(--sage);
  }
}

@media (max-width: 600px) {
  .image-preview {
    padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
  }

  .image-preview-panel {
    border-radius: 10px;
  }

  .image-preview-header {
    padding: 12px 12px 4px;
  }

  .image-preview-toolbar {
    padding: 8px 12px 12px;
  }

  .image-preview-hint {
    padding: 10px 12px;
  }
}

@media (max-height: 500px) and (orientation: landscape) {
  .image-preview {
    padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  }

  .image-preview-header {
    padding: 6px 12px 0;
  }

  .image-preview-eyebrow {
    display: none;
  }

  .image-preview-toolbar {
    padding: 4px 12px 8px;
  }

  .image-preview-hint {
    padding: 6px 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-preview .image-preview-panel,
  .image-preview::backdrop {
    animation: none;
  }
}
</style>
