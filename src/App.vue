<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import HomePage from '@/components/HomePage.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import BackToTop from '@/components/BackToTop.vue'

const DocsPage = defineAsyncComponent(() => import('@/components/DocsPage.vue'))
const hash = ref(window.location.hash)
const isDocs = computed(() => /^#docs(?:\/|$)/.test(hash.value))
const docId = computed(() => hash.value.split('/')[1] || 'getting-started')
const positions = new Map()
let previousHash = hash.value

async function onHashChange() {
  positions.set(previousHash, window.scrollY)
  const wasDocs = isDocs.value
  hash.value = window.location.hash
  previousHash = hash.value
  document.title = isDocs.value ? '使用指南 · Kira' : 'Kira — 让日常闪闪发光'
  await nextTick()
  if (isDocs.value) {
    window.scrollTo({ top: 0, behavior: 'instant' })
  } else {
    const target = document.getElementById(hash.value.slice(1))
    if (target) target.scrollIntoView()
    else window.scrollTo({ top: positions.get(hash.value) || 0, behavior: 'instant' })
  }
  if (wasDocs !== isDocs.value) document.getElementById('main-content')?.focus({ preventScroll: true })
}

onMounted(() => {
  window.addEventListener('hashchange', onHashChange)
  if (isDocs.value) document.title = '使用指南 · Kira'
})
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
  <a class="skip-link" href="#main-content" @click.prevent="$refs.main.focus(); $refs.main.scrollIntoView()">跳到主要内容</a>
  <NavBar :is-docs="isDocs" :current-hash="hash" />
  <main id="main-content" ref="main" tabindex="-1">
    <Suspense v-if="isDocs">
      <DocsPage :doc-id="docId" />
      <template #fallback>
        <div class="container document-loading" role="status">正在翻开使用指南…</div>
      </template>
    </Suspense>
    <HomePage v-else />
  </main>
  <SiteFooter />
  <BackToTop />
</template>
