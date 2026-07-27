import { ref, onMounted, onUnmounted } from 'vue'

export function usePrefersReducedMotion() {
  const reduced = ref(false)
  let media = null

  const update = () => {
    reduced.value = Boolean(media?.matches)
  }

  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    update()
    media.addEventListener?.('change', update)
    media.addListener?.(update)
  })

  onUnmounted(() => {
    media?.removeEventListener?.('change', update)
    media?.removeListener?.(update)
  })

  return reduced
}
