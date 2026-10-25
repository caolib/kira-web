<script setup>
import { Download, Github, MessageCircle, BookOpen, Sun, Moon } from 'lucide-vue-next'
import { inject } from 'vue'
import { site } from '@/content/site'
import { useTheme } from '@/composables/useTheme'

const view = inject('view')
const setView = inject('setView')
const { theme, toggle } = useTheme()

// 锚点导航项只在展台视图显示；点击时确保回到展台
function goAnchor(item) {
  setView?.('home')
  // 等视图切换后再跳锚点
  requestAnimationFrame(() => {
    window.location.hash = `#${item.id}`
  })
}

function goHome() {
  setView?.('home')
}

function goDocs() {
  setView?.('docs')
}
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 border-b border-transparent bg-transparent pt-[env(safe-area-inset-top,0px)]"
    :class="{ 'nav-on-stage': view === 'home' }"
  >
    <!-- 通栏布局：logo 与右侧按钮各自贴住屏幕两端 -->
    <div class="flex h-14 w-full items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
      <a href="#top" class="flex min-w-0 items-center gap-2.5 text-foreground no-underline" @click.prevent="goHome">
        <img :src="site.logo" alt="" width="32" height="32" class="h-8 w-8 shrink-0 rounded-lg" />
        <span class="font-heading text-lg font-semibold tracking-tight">{{ site.name }}</span>
        <span class="hidden min-w-0 truncate text-xs text-muted lg:inline">{{ site.tagline }}</span>
      </a>

      <nav class="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="主导航">
        <template v-if="view === 'home'">
          <a v-for="item in site.nav" :key="item.id" href="#top"
            class="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-[rgb(var(--brand)/0.12)] hover:text-foreground"
            @click.prevent="goAnchor(item)">
            {{ item.label }}
          </a>
        </template>
        <a href="#docs"
          class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-[rgb(var(--brand)/0.12)]"
          :class="view === 'docs' ? 'text-foreground' : 'text-muted hover:text-foreground'" @click.prevent="goDocs">
          <BookOpen class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">使用说明</span>
        </a>
        <button type="button"
          class="inline-flex items-center justify-center rounded-lg bg-[var(--btn-secondary-bg)] p-2 text-muted transition hover:bg-[rgb(var(--brand)/0.12)] hover:text-foreground"
          :aria-label="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'" :title="theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'"
          @click="toggle">
          <Sun v-if="theme === 'dark'" class="h-4 w-4" aria-hidden="true" />
          <Moon v-else class="h-4 w-4" aria-hidden="true" />
        </button>
        <a class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--btn-secondary-bg)] px-2.5 py-2 text-sm font-medium text-foreground transition hover:bg-[rgb(var(--brand)/0.12)] sm:px-3"
          :href="site.releasesUrl" target="_blank" rel="noopener noreferrer">
          <Download class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">下载</span>
          <span class="sm:hidden">下载</span>
        </a>
        <a v-if="site.qqGroupUrl" :href="site.qqGroupUrl" target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--btn-secondary-bg)] px-2.5 py-2 text-sm font-medium text-foreground transition hover:bg-[rgb(var(--brand)/0.12)] sm:px-3"
          aria-label="QQ 群">
          <MessageCircle class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">QQ</span>
        </a>
        <a :href="site.repoUrl" target="_blank" rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--btn-secondary-bg)] px-2.5 py-2 text-sm font-medium text-foreground transition hover:bg-[rgb(var(--brand)/0.12)] sm:px-3"
          aria-label="GitHub 仓库">
          <Github class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">Github</span>
        </a>
      </nav>
    </div>
  </header>
</template>
