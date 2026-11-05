<script setup>
import { nextTick, ref, watch } from 'vue'
import { ArrowUpRight, Menu, X } from 'lucide-vue-next'
import { site } from '@/content/site'
import { useAssemblyMotion } from '@/composables/useAssemblyMotion'

const props = defineProps({ isDocs: Boolean, currentHash: String })
const navRoot = ref(null)
const { refresh } = useAssemblyMotion(navRoot, { belowHeader: false })
const menuOpen = ref(false)
watch(() => props.currentHash, () => { menuOpen.value = false })
watch(menuOpen, async () => { await nextTick(); refresh() })
</script>

<template>
  <header ref="navRoot" class="site-header" @keydown.esc="menuOpen = false; $refs.menuButton?.focus()">
    <div class="container nav-inner">
      <a href="#" class="brand" aria-label="Kira 首页" data-assembly-group="header-brand" data-build="highlight" @click="menuOpen = false">
        <img data-build="image" :src="site.logo" alt="" width="40" height="40" />
        <span data-build="lines">kira<span class="brand-dot">.</span></span>
      </a>
      <span class="nav-note" data-assembly-group="header-note" data-build="lines">给故事，留一点时间。</span>
      <nav class="desktop-nav" aria-label="主导航">
        <a href="#experience" data-assembly-group="header-experience" data-build="highlight" :aria-current="currentHash === '#experience' ? 'location' : undefined"><span data-build="lines">阅读体验</span></a>
        <a href="#docs/getting-started" data-assembly-group="header-docs" data-build="highlight" :aria-current="isDocs ? 'page' : undefined"><span data-build="lines">使用指南</span></a>
        <a :href="site.repoUrl" data-assembly-group="header-github" data-build="highlight" target="_blank" rel="noopener noreferrer"><span data-build="lines">GitHub</span> <ArrowUpRight :size="14" aria-hidden="true" /></a>
      </nav>
      <a class="button button-small nav-download" data-assembly-group="header-download" data-build="highlight" href="#download">下载 Kira <ArrowUpRight :size="16" aria-hidden="true" /></a>
      <button ref="menuButton" class="icon-button menu-button" data-assembly-group="header-menu" data-build="highlight" :aria-expanded="menuOpen" aria-controls="mobile-nav" :aria-label="menuOpen ? '关闭导航' : '打开导航'" @click="menuOpen = !menuOpen">
        <X v-if="menuOpen" :size="22" aria-hidden="true" /><Menu v-else :size="22" aria-hidden="true" />
      </button>
    </div>
    <Transition name="nav-expand">
    <nav v-if="menuOpen" id="mobile-nav" class="mobile-nav container" aria-label="手机导航">
      <a href="#experience" data-assembly-group="header-mobile-experience" data-build="highlight" @click="menuOpen = false"><span data-build="lines">阅读体验</span> <span>01</span></a>
      <a href="#docs/getting-started" data-assembly-group="header-mobile-docs" data-build="highlight" :aria-current="isDocs ? 'page' : undefined" @click="menuOpen = false"><span data-build="lines">使用指南</span> <span>02</span></a>
      <a :href="site.repoUrl" data-assembly-group="header-mobile-github" data-build="highlight" target="_blank" rel="noopener noreferrer" @click="menuOpen = false"><span data-build="lines">GitHub</span> <ArrowUpRight :size="18" aria-hidden="true" /></a>
    </nav>
    </Transition>
  </header>
</template>
