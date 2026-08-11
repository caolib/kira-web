<script setup>
import StageScene from './StageScene.vue'
import { site } from '@/content/site'

const textureUrls = site.screenshots.map((s) => s.src)
</script>

<template>
  <h1 class="sr-only">{{ site.heroTitle }}</h1>

  <section
    id="top"
    class="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-14 sm:pt-16"
  >
    <div class="absolute inset-x-0 bottom-0 top-14 overflow-hidden sm:top-16">
      <div class="neon-orb left-[-10%] top-2 h-56 w-56 bg-primary opacity-40" />
      <div class="neon-orb right-[-5%] top-8 h-64 w-64 bg-accent opacity-25" />
      <div class="neon-orb bottom-4 left-1/3 h-48 w-48 bg-secondary opacity-20" />

      <div class="pointer-events-none absolute inset-x-[6%] inset-y-[2%] -z-10 rounded-full bg-[radial-gradient(circle_at_center,rgb(var(--brand)/0.34),transparent_70%)] blur-3xl" />
      <StageScene
        class="h-full w-full"
        :texture-urls="textureUrls"
      />
    </div>
  </section>
</template>
