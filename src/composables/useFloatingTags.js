import { computed, onMounted, onUnmounted, ref, toValue } from 'vue'

export function useFloatingTags(root, paused) {
  const visible = ref(false)
  const pageVisible = ref(true)
  const reducedMotion = ref(true)
  const hovered = ref(false)
  const focused = ref(false)
  const touching = ref(false)
  const floating = computed(() => visible.value && pageVisible.value && !reducedMotion.value &&
    !toValue(paused) && !hovered.value && !focused.value && !touching.value)
  let observer
  let events

  onMounted(() => {
    const element = root.value
    if (!element) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    events = new AbortController()
    const options = { signal: events.signal }
    const syncEnvironment = () => {
      pageVisible.value = !document.hidden
      reducedMotion.value = preference.matches
    }
    syncEnvironment()
    preference.addEventListener('change', syncEnvironment, options)
    document.addEventListener('visibilitychange', syncEnvironment, options)
    window.addEventListener('pagehide', () => { pageVisible.value = false }, options)
    window.addEventListener('pageshow', syncEnvironment, options)
    element.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') hovered.value = true
    }, options)
    element.addEventListener('pointerleave', () => { hovered.value = false }, options)
    element.addEventListener('focusin', () => { focused.value = true }, options)
    element.addEventListener('focusout', event => {
      focused.value = element.contains(event.relatedTarget)
    }, options)
    element.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') touching.value = true
    }, { ...options, passive: true })
    const releaseTouch = () => { touching.value = false }
    window.addEventListener('pointerup', releaseTouch, options)
    window.addEventListener('pointercancel', releaseTouch, options)
    if ('IntersectionObserver' in window) {
      const header = document.querySelector('.site-header')?.getBoundingClientRect().height || 0
      observer = new IntersectionObserver(([entry]) => {
        visible.value = entry.isIntersecting && entry.intersectionRatio >= 0.12
      }, { rootMargin: `-${header}px 0px 0px`, threshold: [0, 0.12] })
      observer.observe(element)
    }
  })

  onUnmounted(() => {
    observer?.disconnect()
    events?.abort()
  })

  return { floating }
}
