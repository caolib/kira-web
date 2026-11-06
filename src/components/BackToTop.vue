<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { ArrowUp } from '@/icons'

const visible = ref(false)
const syncVisibility = () => { visible.value = window.scrollY > Math.max(600, window.innerHeight * .8) }

function backToTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })
  document.querySelector('.site-header .brand')?.focus({ preventScroll: true })
}

onMounted(() => {
  syncVisibility()
  window.addEventListener('scroll', syncVisibility, { passive: true })
  window.addEventListener('resize', syncVisibility)
})
onUnmounted(() => {
  window.removeEventListener('scroll', syncVisibility)
  window.removeEventListener('resize', syncVisibility)
})
</script>

<template>
  <Transition name="back-to-top">
    <button v-if="visible" class="back-to-top" type="button" aria-label="回到顶部" title="回到顶部" @click="backToTop">
      <ArrowUp :size="18" aria-hidden="true" />
    </button>
  </Transition>
</template>

<style scoped>
.back-to-top { position: fixed; right: max(24px, env(safe-area-inset-right)); bottom: max(24px, env(safe-area-inset-bottom)); z-index: 15; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid var(--rule); border-radius: 4px; color: var(--muted); background: var(--paper); opacity: .85; }
.back-to-top:hover, .back-to-top:focus-visible { color: var(--accent); background: var(--sage); opacity: 1; }
.back-to-top-enter-active, .back-to-top-leave-active { transition: opacity 160ms ease, transform 160ms ease; }
.back-to-top-enter-from, .back-to-top-leave-to { opacity: 0; transform: translateY(6px); }
@media (max-width: 767px) {
  .back-to-top { right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom)); }
}
</style>
