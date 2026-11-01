import { onMounted, onUnmounted } from 'vue'

export function useEditorialMotion(root) {
  let observer
  let preference
  const pending = new Set()
  const animations = new Set()

  function revealAll() {
    observer?.disconnect()
    pending.forEach(element => element.classList.remove('reveal-pending'))
    pending.clear()
    animations.forEach(animation => animation.cancel())
    animations.clear()
  }

  onMounted(() => {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    preference.addEventListener('change', revealAll)
    if (preference.matches || !('IntersectionObserver' in window)) return

    observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue
        observer.unobserve(target)
        pending.delete(target)
        target.classList.remove('reveal-pending')
        const animation = target.animate([
          { opacity: 0, transform: 'translateY(20px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 400, easing: 'cubic-bezier(.22, 1, .36, 1)' })
        animations.add(animation)
        animation.finished.then(() => animations.delete(animation), () => animations.delete(animation))
      }
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.06 })

    root.value?.querySelectorAll('[data-reveal]').forEach(element => {
      // 首屏直接显示，只观察尚未进入视野的内容；播放后不再监听。
      if (element.getBoundingClientRect().top < window.innerHeight) return
      pending.add(element)
      element.classList.add('reveal-pending')
      observer.observe(element)
    })
  })

  onUnmounted(() => {
    revealAll()
    preference?.removeEventListener('change', revealAll)
  })
}
