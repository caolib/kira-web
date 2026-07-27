<script setup>
import { computed } from 'vue'
import HeroScene from './HeroScene.vue'
import { site } from '@/content/site'

const textureUrls = computed(() => site.screenshots.map((s) => s.src))
const currentTexture = computed(() => textureUrls.value[0] || '')
</script>

<template>
  <!-- 明确视口高度，避免 flex 链断裂导致画布高度为 0 -->
  <section
    id="top"
    class="relative h-[calc(100dvh-3.5rem)] overflow-hidden pt-14 sm:h-[calc(100dvh-3.75rem)] sm:pt-16"
  >
    <div class="neon-orb left-[-10%] top-16 h-56 w-56 bg-primary opacity-40" />
    <div class="neon-orb right-[-5%] top-24 h-64 w-64 bg-accent opacity-25" />
    <div class="neon-orb bottom-4 left-1/3 h-48 w-48 bg-secondary opacity-20" />

    <h1 class="sr-only">{{ site.heroTitle }}</h1>

    <div class="absolute inset-x-0 bottom-0 top-14 sm:top-16">
      <div class="pointer-events-none absolute inset-x-[6%] inset-y-[2%] -z-10 rounded-full bg-[radial-gradient(circle_at_center,rgb(124_58_237/0.34),transparent_70%)] blur-3xl" />
      <HeroScene
        class="h-full w-full"
        :texture-url="currentTexture"
        :texture-urls="textureUrls"
      />
    </div>
  </section>
</template>
