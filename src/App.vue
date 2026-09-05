<script setup>
import { defineAsyncComponent, provide, ref, onMounted, onUnmounted, watch } from 'vue'
import NavBar from '@/components/NavBar.vue'
import DocsPage from '@/components/DocsPage.vue'
import { initTheme } from '@/composables/useTheme'

const HeroSection = defineAsyncComponent(() => import('@/components/HeroSection.vue'))

// 启动时立即应用主题，避免首屏闪烁
initTheme()

// 视图状态：'home' 展台 / 'docs' 使用说明
const view = ref(window.location.hash === '#docs' ? 'docs' : 'home')

function setView(next) {
  if (view.value === next) return
  view.value = next
  // 首页不写 hash，避免地址栏出现 #top；仅说明页用 #docs 便于刷新保持
  if (next === 'docs') {
    if (window.location.hash !== '#docs') {
      window.history.pushState(null, '', '#docs')
    }
  } else if (window.location.hash) {
    window.history.pushState(null, '', window.location.pathname + window.location.search)
  }
  window.scrollTo({ top: 0 })
}

provide('view', view)
provide('setView', setView)

// 无障碍跳转：JS 滚动到主内容，避免地址栏出现 #top
function skipToMain() {
  document.getElementById('top')?.scrollIntoView()
  document.getElementById('top')?.focus?.()
}

// 监听浏览器前进/后退同步视图
function onPopState() {
  view.value = window.location.hash === '#docs' ? 'docs' : 'home'
}
onMounted(() => window.addEventListener('popstate', onPopState))
onUnmounted(() => window.removeEventListener('popstate', onPopState))

// 进入说明页时锁定 body 滚动由内层容器接管；回到展台恢复
// 注意：初始即 docs 时 watch 不触发，需立即同步一次
watch(view, (v) => {
  document.body.classList.toggle('view-docs', v === 'docs')
}, { immediate: true })
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background text-foreground">
    <a
      href="#top"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-foreground"
      @click.prevent="skipToMain"
    >
      跳到主要内容
    </a>
    <NavBar />
    <main class="flex min-h-0 flex-1 flex-col">
      <Suspense v-if="view === 'home'">
        <HeroSection />
        <template #fallback>
          <section class="flex min-h-0 flex-1 items-center justify-center pt-14 sm:pt-16">
            <div class="h-10 w-10 animate-spin rounded-full border-2 border-secondary border-t-transparent" aria-label="加载中" />
          </section>
        </template>
      </Suspense>
      <DocsPage v-else />
    </main>
  </div>
</template>
