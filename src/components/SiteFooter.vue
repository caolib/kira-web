<script setup>
import { ArrowUpRight } from 'lucide-vue-next'
import { site } from '@/content/site'
</script>

<template>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-top">
        <a href="#" class="brand"><img :src="site.logo" alt="" width="36" height="36" /><span>kira<span class="brand-dot">.</span></span></a>
        <p>故事还长，下次接着看。</p>
        <nav aria-label="页脚导航">
          <a href="#docs/getting-started">使用指南</a>
          <a :href="site.repoUrl" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight :size="14" aria-hidden="true" /></a>
          <a :href="site.qqGroupUrl" target="_blank" rel="noopener noreferrer">加入交流群 <ArrowUpRight :size="14" aria-hidden="true" /></a>
        </nav>
      </div>
      <div class="footer-bottom">
        <p>Kira 为非官方第三方客户端，不提供或托管内容。内容来自第三方，请遵守当地法律与版权要求。仅限年满 18 周岁的用户使用。</p>
        <a :href="`${site.repoUrl}#免责声明`" target="_blank" rel="noopener noreferrer">完整免责声明 <ArrowUpRight :size="14" aria-hidden="true" /></a>
      </div>
      <div class="footer-colophon"><span>MADE FOR THE NEXT CHAPTER.</span><span>KIRA / 漫画 · 轻小说</span></div>
    </div>
  </footer>
</template>
