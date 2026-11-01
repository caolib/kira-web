<script setup>
import { ref, watch } from 'vue'
import { ArrowUpRight, Menu, X } from 'lucide-vue-next'
import { site } from '@/content/site'

const props = defineProps({ isDocs: Boolean, currentHash: String })
const menuOpen = ref(false)
watch(() => props.currentHash, () => { menuOpen.value = false })
</script>

<template>
  <header class="site-header" @keydown.esc="menuOpen = false; $refs.menuButton?.focus()">
    <div class="container nav-inner">
      <a href="#" class="brand" aria-label="Kira 首页" @click="menuOpen = false">
        <img :src="site.logo" alt="" width="40" height="40" />
        <span>kira<span class="brand-dot">.</span></span>
      </a>
      <span class="nav-note">给故事，留一点时间。</span>
      <nav class="desktop-nav" aria-label="主导航">
        <a href="#experience" :aria-current="currentHash === '#experience' ? 'location' : undefined">阅读体验</a>
        <a href="#docs/getting-started" :aria-current="isDocs ? 'page' : undefined">使用指南</a>
        <a :href="site.repoUrl" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight :size="14" aria-hidden="true" /></a>
      </nav>
      <a class="button button-small nav-download" href="#download">下载 Kira <ArrowUpRight :size="16" aria-hidden="true" /></a>
      <button ref="menuButton" class="icon-button menu-button" :aria-expanded="menuOpen" aria-controls="mobile-nav" :aria-label="menuOpen ? '关闭导航' : '打开导航'" @click="menuOpen = !menuOpen">
        <X v-if="menuOpen" :size="22" aria-hidden="true" /><Menu v-else :size="22" aria-hidden="true" />
      </button>
    </div>
    <Transition name="nav-expand">
    <nav v-if="menuOpen" id="mobile-nav" class="mobile-nav container" aria-label="手机导航">
      <a href="#experience" @click="menuOpen = false">阅读体验 <span>01</span></a>
      <a href="#docs/getting-started" :aria-current="isDocs ? 'page' : undefined" @click="menuOpen = false">使用指南 <span>02</span></a>
      <a :href="site.repoUrl" target="_blank" rel="noopener noreferrer" @click="menuOpen = false">GitHub <ArrowUpRight :size="18" aria-hidden="true" /></a>
    </nav>
    </Transition>
  </header>
</template>
