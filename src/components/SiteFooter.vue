<script setup>
import { ref } from 'vue'
import { ArrowUpRight } from '@/icons'
import { site } from '@/content/site'
import { useAssemblyMotion } from '@/composables/useAssemblyMotion'

const footerRoot = ref(null)
useAssemblyMotion(footerRoot)
</script>

<template>
  <footer ref="footerRoot" class="site-footer">
    <div class="container">
      <div class="footer-top">
        <a href="#" class="brand" data-assembly-group="footer-brand" data-build="highlight"><img data-build="image" :src="site.logo" alt="" width="36" height="36" /><span data-build="lines">Kira<span class="brand-dot">.</span></span></a>
        <p data-assembly-group="footer-note" data-build="lines">故事还长，下次接着看。</p>
        <nav aria-label="页脚导航">
          <a href="#docs/getting-started" data-assembly-group="footer-docs" data-build="highlight"><span data-build="lines">使用指南</span></a>
          <a :href="site.repoUrl" data-assembly-group="footer-github" data-build="highlight" target="_blank" rel="noopener noreferrer"><span data-build="lines">GitHub</span> <ArrowUpRight :size="14" aria-hidden="true" /></a>
          <a :href="site.qqGroupUrl" data-assembly-group="footer-community" data-build="highlight" target="_blank" rel="noopener noreferrer"><span data-build="lines">加入交流群</span> <ArrowUpRight :size="14" aria-hidden="true" /></a>
        </nav>
      </div>
      <div class="footer-bottom" data-assembly-group="footer-rule" data-build="rule">
        <p data-assembly-group="footer-disclaimer" data-build="lines">Kira 为非官方第三方客户端，不提供或托管内容。内容来自第三方，请遵守当地法律与版权要求。仅限年满 18 周岁的用户使用。</p>
        <a :href="`${site.repoUrl}#免责声明`" data-assembly-group="footer-disclaimer-link" data-build="highlight" target="_blank" rel="noopener noreferrer"><span data-build="lines">完整免责声明</span> <ArrowUpRight :size="14" aria-hidden="true" /></a>
      </div>
      <div class="footer-colophon"><span data-assembly-group="footer-colophon-en" data-build="lines">MADE FOR THE NEXT CHAPTER.</span><span data-assembly-group="footer-colophon-zh" data-build="lines">KIRA / 漫画 · 轻小说</span></div>
    </div>
  </footer>
</template>
