<script setup>
import { Download, Github, MessageCircle } from 'lucide-vue-next'
import { site } from '@/content/site'
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 border-b border-transparent bg-transparent"
  >
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
      <a href="#top" class="flex min-w-0 items-center gap-2.5 text-foreground no-underline">
        <img :src="site.logo" alt="" width="32" height="32" class="h-8 w-8 shrink-0 rounded-lg" />
        <span class="font-heading text-lg font-semibold tracking-tight">{{ site.name }}</span>
        <span class="hidden min-w-0 truncate text-xs text-muted lg:inline">{{ site.tagline }}</span>
      </a>

      <nav class="flex shrink-0 items-center gap-2" aria-label="主导航">
        <a
          v-for="item in site.nav"
          :key="item.id"
          :href="`#${item.id}`"
          class="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-[rgb(124_58_237/0.12)] hover:text-foreground"
        >
          {{ item.label }}
        </a>
        <a
          class="btn-primary !min-h-0 gap-1.5 px-3 py-2 text-sm sm:px-4"
          :href="site.releasesUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">获取最新版本</span>
          <span class="sm:hidden">下载</span>
        </a>
        <a
          v-if="site.qqGroupUrl"
          :href="site.qqGroupUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-sm font-medium text-foreground transition hover:border-secondary hover:bg-[rgb(124_58_237/0.12)] sm:px-3"
          aria-label="QQ 群"
        >
          <MessageCircle class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">QQ 群</span>
        </a>
        <a
          :href="site.repoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-sm font-medium text-foreground transition hover:border-secondary hover:bg-[rgb(124_58_237/0.12)] sm:px-3"
          aria-label="GitHub 仓库"
        >
          <Github class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">GitHub</span>
        </a>
      </nav>
    </div>
  </header>
</template>
