import { computed, nextTick, onScopeDispose, ref } from 'vue'
import { preloadScreenshotTheme } from '@/utils/screenshots'

const modes = ['system', 'dark', 'light']
const labels = { system: '自动', dark: '深色', light: '浅色' }

export function useTheme() {
  const theme = window.kiraTheme
  const root = document.documentElement
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const mode = ref(theme.mode)
  const switching = ref(false)
  const nextMode = computed(() => modes[(modes.indexOf(mode.value) + 1) % modes.length])
  const label = computed(() => labels[mode.value])
  const description = computed(() => `主题：${label.value}${mode.value === 'system' ? '（跟随系统）' : ''}；切换为${labels[nextMode.value]}`)
  let transition = null
  let animation = null
  let cancelled = false
  let disposed = false

  function cancel() {
    cancelled = true
    transition?.skipTransition()
    animation?.cancel()
  }

  const unsubscribe = theme.subscribe(state => {
    mode.value = state.mode
    if (state.source !== 'user') cancel()
  })
  function onMotionChange() { if (motion.matches) cancel() }
  function onVisibilityChange() { if (document.hidden) cancel() }
  motion.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', cancel)

  async function cycleTheme(event) {
    if (switching.value || disposed) return
    const target = nextMode.value
    const rect = event.currentTarget.getBoundingClientRect()
    if (theme.resolve(target) === theme.theme || motion.matches || document.hidden ||
      typeof document.startViewTransition !== 'function' || typeof root.animate !== 'function') {
      theme.setMode(target)
      theme.save()
      return
    }

    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    switching.value = true
    cancelled = false
    let applied = false
    let saved = false
    let finished = null
    const apply = async () => {
      if (cancelled || disposed) return
      theme.setMode(target)
      applied = true
      await nextTick()
    }

    try {
      await preloadScreenshotTheme(theme.resolve(target))
      if (cancelled || disposed) return
      root.classList.add('theme-transition')
      transition = document.startViewTransition(apply)
      finished = transition.finished.catch(() => {})
      await transition.ready
      if (applied) {
        theme.save()
        saved = true
      }
      if (!cancelled) {
        animation = root.animate({ clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ] }, {
          duration: 1000,
          easing: 'ease-out',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        })
      }
      await finished
    } catch {
      transition?.skipTransition()
      if (!applied) await apply()
      if (finished) await finished
    } finally {
      animation?.cancel()
      animation = null
      transition = null
      root.classList.remove('theme-transition')
      if (applied && !saved) theme.save()
      switching.value = false
    }
  }

  onScopeDispose(() => {
    disposed = true
    cancel()
    unsubscribe()
    motion.removeEventListener('change', onMotionChange)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', cancel)
    root.classList.remove('theme-transition')
  })

  return { mode, description, switching, cycleTheme }
}
