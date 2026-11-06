<script setup>
import { nextTick, ref, watch } from 'vue'
import { Github, Menu, Monitor, Moon, Sun, X } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { site } from '@/content/site'
import { useAssemblyMotion } from '@/composables/useAssemblyMotion'

const props = defineProps({ isDocs: Boolean, currentHash: String })
const navRoot = ref(null)
const { refresh } = useAssemblyMotion(navRoot, { belowHeader: false })
const menuOpen = ref(false)
const { mode, description, switching, cycleTheme } = useTheme()
watch(() => props.currentHash, () => { menuOpen.value = false })
watch(menuOpen, async () => { await nextTick(); refresh() })
</script>

<template>
  <header ref="navRoot" class="site-header" @keydown.esc="menuOpen = false; $refs.menuButton?.focus()">
    <div class="container nav-inner">
      <a href="#" class="brand" aria-label="Kira 首页" data-assembly-group="header-brand" data-build="highlight" @click="menuOpen = false">
        <img data-build="image" :src="site.logo" alt="" width="40" height="40" />
        <span data-build="lines">Kira<span class="brand-dot">.</span></span>
      </a>
      <span class="nav-note" data-assembly-group="header-note" data-build="lines">给故事，留一点时间。</span>
      <nav class="desktop-nav" aria-label="主导航">
        <a href="#experience" data-assembly-group="header-experience" data-build="highlight" :aria-current="currentHash === '#experience' ? 'location' : undefined"><span data-build="lines">阅读体验</span></a>
        <a href="#docs/getting-started" data-assembly-group="header-docs" data-build="highlight" :aria-current="isDocs ? 'page' : undefined"><span data-build="lines">使用指南</span></a>
      </nav>
      <div class="nav-actions">
        <a class="icon-button nav-github" :href="site.repoUrl" data-assembly-group="header-github" data-build="highlight" target="_blank" rel="noopener noreferrer" aria-label="GitHub（在新标签页打开）" title="GitHub（在新标签页打开）"><Github :size="20" aria-hidden="true" /></a>
        <button class="theme-button" type="button" data-assembly-group="header-theme" data-build="highlight" :data-mode="mode" :aria-label="description" :title="description" :aria-disabled="switching" @click="cycleTheme">
          <Monitor v-if="mode === 'system'" :size="18" aria-hidden="true" />
          <Moon v-else-if="mode === 'dark'" :size="18" aria-hidden="true" />
          <Sun v-else :size="18" aria-hidden="true" />
        </button>
        <button ref="menuButton" class="icon-button menu-button" data-assembly-group="header-menu" data-build="highlight" :aria-expanded="menuOpen" aria-controls="mobile-nav" :aria-label="menuOpen ? '关闭导航' : '打开导航'" @click="menuOpen = !menuOpen">
          <X v-if="menuOpen" :size="22" aria-hidden="true" /><Menu v-else :size="22" aria-hidden="true" />
        </button>
      </div>
    </div>
    <Transition name="nav-expand">
    <nav v-if="menuOpen" id="mobile-nav" class="mobile-nav container" aria-label="手机导航">
      <a href="#experience" data-assembly-group="header-mobile-experience" data-build="highlight" @click="menuOpen = false"><span data-build="lines">阅读体验</span> <span>01</span></a>
      <a href="#docs/getting-started" data-assembly-group="header-mobile-docs" data-build="highlight" :aria-current="isDocs ? 'page' : undefined" @click="menuOpen = false"><span data-build="lines">使用指南</span> <span>02</span></a>
    </nav>
    </Transition>
  </header>
</template>
