import { onMounted, onUnmounted, ref, toValue, watch } from 'vue'
import { createHeaderScroll } from '@/utils/header-scroll'

export function useAutoHideHeader(root, paused, route) {
  const hidden = ref(false)
  const scroll = createHeaderScroll()
  let hovered = false
  let keyboardFocused = false
  let frame = null
  let events

  const position = () => Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight))
  const reveal = () => { hidden.value = scroll.reset(position()) }
  const sync = () => {
    frame = null
    // 图片预览会固定 body 并还原滚动位置，不把这次跳变当成用户滚动。
    if (document.hidden || document.body.style.position === 'fixed') return
    hidden.value = scroll.update(position(), root.value?.offsetHeight || 0, toValue(paused) || hovered || keyboardFocused)
  }
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(sync) }

  watch(() => toValue(paused), reveal)
  watch(() => toValue(route), reveal, { flush: 'post' })

  onMounted(() => {
    const element = root.value
    if (!element) return
    events = new AbortController()
    const options = { signal: events.signal }
    window.addEventListener('scroll', schedule, { ...options, passive: true })
    window.addEventListener('resize', reveal, options)
    window.addEventListener('pageshow', reveal, options)
    element.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') { hovered = true; reveal() }
    }, options)
    element.addEventListener('pointerleave', () => { hovered = false; reveal() }, options)
    element.addEventListener('pointerdown', () => { keyboardFocused = false; reveal() }, options)
    element.addEventListener('focusin', event => {
      keyboardFocused = event.target.matches(':focus-visible')
      reveal()
    }, options)
    element.addEventListener('focusout', event => {
      if (!element.contains(event.relatedTarget)) { keyboardFocused = false; reveal() }
    }, options)
    element.addEventListener('keydown', () => { keyboardFocused = true; reveal() }, options)
    reveal()
  })

  onUnmounted(() => {
    events?.abort()
    if (frame !== null) cancelAnimationFrame(frame)
  })

  return { hidden }
}
