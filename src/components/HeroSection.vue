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
    <div class="absolute inset-0 overflow-hidden">
      <!-- 画布铺满整个 section（含顶部栏背后）：画布空区由 useStageScene
           填充页面背景色，顶栏透明浮在其上，与场景融为一体无缝衔接 -->
      <StageScene
        class="h-full w-full"
        :texture-urls="textureUrls"
      />
    </div>
  </section>
</template>
