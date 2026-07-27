<script setup>
import { MessageCircle } from 'lucide-vue-next'
import { site } from '@/content/site'
</script>

<template>
  <footer class="border-t border-[var(--color-border)] bg-[rgb(10_10_20/0.8)] py-3 sm:py-3.5">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-6">
      <p class="min-w-0 text-xs text-muted sm:text-sm">
        {{ site.tagline }}
      </p>
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted">© {{ new Date().getFullYear() }}</span>
        <a
          v-if="site.qqGroupUrl"
          :href="site.qqGroupUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-foreground transition hover:border-secondary"
        >
          <MessageCircle class="h-3.5 w-3.5" aria-hidden="true" />
          QQ 群
        </a>
      </div>
    </div>
  </footer>
</template>
