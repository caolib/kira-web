<script setup>
import { defineAsyncComponent } from 'vue'
import NavBar from '@/components/NavBar.vue'
import SiteFooter from '@/components/SiteFooter.vue'

const HeroSection = defineAsyncComponent(() => import('@/components/HeroSection.vue'))
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background text-foreground">
    <a
      href="#top"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-foreground"
    >
      跳到主要内容
    </a>
    <NavBar />
    <main class="flex min-h-0 flex-1 flex-col">
      <Suspense>
        <HeroSection />
        <template #fallback>
          <section class="flex min-h-0 flex-1 items-center justify-center pt-14 sm:pt-16">
            <div class="h-10 w-10 animate-spin rounded-full border-2 border-secondary border-t-transparent" aria-label="加载中" />
          </section>
        </template>
      </Suspense>
    </main>
    <SiteFooter />
  </div>
</template>
