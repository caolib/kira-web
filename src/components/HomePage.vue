<script setup>
import { ref } from 'vue'
import { ArrowDown, ArrowRight, ArrowUpRight, Asterisk, BookOpen, Bookmark, Download, Github, Monitor, Plus, Smartphone, WifiOff, ZoomIn } from 'lucide-vue-next'
import { site } from '@/content/site'
import ImagePreview from './ImagePreview.vue'
import ScreenshotStudy from './ScreenshotStudy.vue'
import { useAssemblyMotion } from '@/composables/useAssemblyMotion'

const homeRoot = ref(null)
const { wideBuilding, finishGroup } = useAssemblyMotion(homeRoot)
const selectedShot = ref(null)
const platform = ref('android')
const [discover, reader, novels, novelReader, detail, bookshelf, desktop, spread] = site.screenshots
const readingNotes = [
  { number: '01', icon: BookOpen, title: '发现喜欢的，再慢慢看。', text: '从推荐、排行到最近更新，在熟悉的漫画来源里，找到下一部想读的作品。' },
  { number: '02', icon: Bookmark, title: '每次回来，都接得上。', text: '用书架收好喜欢的作品，用阅读记录和书签留住进度。不必重新寻找上次看到的那一页。' },
  { number: '03', icon: WifiOff, title: '没网的时间，也有好故事。', text: '提前下载想看的章节，让通勤、旅途和短暂的空闲，都能成为自己的阅读时间。' },
]
</script>

<template>
  <div ref="homeRoot" class="home-page">
    <section class="hero container" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow" data-assembly-group="hero-kicker" data-build="lines"><span class="status-dot" /> 漫画 · 轻小说 · 你的阅读角落</p>
        <h1 id="hero-title" data-assembly-group="hero-title" data-build="type">好故事，<br />值得一页页<br /><span class="title-underline">读下去。</span></h1>
        <p class="hero-description" data-assembly-group="hero-description" data-build="lines" data-build-delay="240">把喜欢的漫画装进口袋，<br class="desktop-break" />也给日常留一点沉浸在故事里的时间。</p>
        <div class="hero-actions">
          <a class="button" href="#download">下载 Kira <ArrowDown :size="18" aria-hidden="true" /></a>
          <a class="text-link" href="#experience">翻开看看 <ArrowRight :size="18" aria-hidden="true" /></a>
        </div>
        <p class="hero-platforms" data-assembly-group="hero-platforms" data-build="lines"><Smartphone :size="14" aria-hidden="true" /> Android <span>/</span><Monitor :size="15" aria-hidden="true" /> Windows</p>
      </div>
      <div class="hero-art">
        <div class="art-topline" data-assembly-group="hero-art-top" data-build="rule"><span data-build="lines" data-build-delay="180">THE READING EDITION</span><span data-build="lines" data-build-delay="280">VOL. 01</span></div>
        <div class="hero-art-field">
          <div class="art-circle" aria-hidden="true" />
          <span class="art-vertical" aria-hidden="true">发现 / 收藏 / 沉浸</span>
          <button class="phone-shot hero-phone hero-phone-discover" data-assembly-group="hero-discover" data-build="frame" :aria-label="`放大查看：${discover.label}`" @click="selectedShot = discover">
            <img data-build="image" :src="discover.src" :alt="discover.title" :width="discover.width" :height="discover.height" fetchpriority="high" />
            <span class="shot-zoom"><ZoomIn :size="17" aria-hidden="true" /></span>
          </button>
          <button class="phone-shot hero-phone hero-phone-reader" data-assembly-group="hero-reader" data-build="frame" data-build-delay="120" :aria-label="`放大查看：${reader.label}`" @click="selectedShot = reader">
            <img data-build="image" data-build-delay="120" :src="reader.src" :alt="reader.title" :width="reader.width" :height="reader.height" />
            <span class="shot-zoom"><ZoomIn :size="17" aria-hidden="true" /></span>
          </button>
          <div class="reading-note" data-assembly-group="hero-note" data-build="frame" aria-hidden="true"><span data-build="lines" data-build-delay="350">JUST ONE</span><em><span class="assembly-note-text" data-build="lines" data-build-delay="550">more page.</span></em><Asterisk class="note-star" :size="38" :stroke-width="1.5" data-build="draw" data-build-delay="750" /></div>
        </div>
        <div class="art-bottomline" data-assembly-group="hero-art-bottom" data-build="rule"><span data-build="lines" data-build-delay="180"><span class="small-cross">＋</span> 一个属于你的阅读角落</span><span data-build="lines" data-build-delay="280">点击截图，近一点看 <ArrowUpRight :size="13" aria-hidden="true" /></span></div>
      </div>
    </section>

    <div class="edition-strip container" aria-label="产品特点">
      <span class="strip-heading" data-assembly-group="edition-heading" data-build="lines">少一点打扰，多一点故事。</span>
      <span data-assembly-group="edition-comics" data-build="lines" data-build-delay="120">漫画与轻小说</span><span data-assembly-group="edition-offline" data-build="lines" data-build-delay="240">下载后离线阅读</span><span data-assembly-group="edition-progress" data-build="lines" data-build-delay="360">你的进度，随时续上</span>
      <a :href="site.repoUrl" target="_blank" rel="noopener noreferrer"><Github :size="16" aria-hidden="true" /> GitHub <ArrowUpRight :size="14" aria-hidden="true" /></a>
    </div>

    <section id="experience" class="experience-section container section-space" aria-labelledby="experience-title">
      <div class="section-heading">
        <div data-assembly-group="experience-heading"><p class="eyebrow" data-build="lines">01 / 阅读这件小事</p><h2 id="experience-title" data-build="lines" data-build-delay="220">从「想看」，<br />到舍不得放下。</h2></div>
        <p class="section-intro" data-assembly-group="experience-intro" data-build="lines">不必把阅读变得复杂。<br />找到故事，翻开一页，剩下的交给 Kira。</p>
      </div>
      <div class="experience-layout">
        <div class="comic-spread">
          <figure v-for="(shot, index) in [detail, bookshelf]" :key="shot.id">
            <button class="phone-shot comic-phone" :data-assembly-group="index ? 'comic-bookshelf' : 'comic-detail'" data-build="frame" :aria-label="`放大查看：${shot.label}`" @click="selectedShot = shot">
              <img data-build="image" :src="shot.src" :alt="shot.title" :width="shot.width" :height="shot.height" loading="lazy" />
              <span class="shot-zoom"><ZoomIn :size="18" aria-hidden="true" /></span>
            </button>
            <figcaption :data-assembly-group="`${index ? 'comic-bookshelf' : 'comic-detail'}-caption`" data-build="lines">0{{ index + 1 }} — {{ shot.label }}</figcaption>
          </figure>
        </div>
        <div class="reading-notes">
          <article v-for="note in readingNotes" :key="note.number" class="reading-note-row" :data-assembly-group="`note-${note.number}-heading`" data-build="rule">
            <span class="note-number" data-build="lines">{{ note.number }}</span>
            <div><component :is="note.icon" :size="23" :stroke-width="1.5" aria-hidden="true" data-build="draw" /><h3 data-assembly-anchor data-build="lines" data-build-delay="200">{{ note.title }}</h3><p :data-assembly-group="`note-${note.number}-body`" data-build="lines">{{ note.text }}</p></div>
          </article>
          <a class="text-link notes-link" href="#docs/getting-started">初次见面？从这里开始 <ArrowUpRight :size="17" aria-hidden="true" /></a>
        </div>
      </div>
    </section>

    <section class="wide-section container" aria-labelledby="wide-title">
      <div class="section-heading">
        <div data-assembly-group="wide-heading"><p class="eyebrow" data-build="lines">02 / 让故事，铺展开来</p><h2 id="wide-title" data-build="lines" data-build-delay="220">跨页的震撼，<br />一眼看完整。</h2></div>
        <p class="section-intro" data-assembly-group="wide-intro" data-build="lines">横过屏幕，把大场面完整展开。<br />从漫画跨页到宽屏书库，每一寸都用来好好看。</p>
      </div>
      <ScreenshotStudy :shots="[spread, desktop]" label="横屏阅读与首页截图" :paused="Boolean(selectedShot) || wideBuilding" assembly-group="wide-stack" @interact="finishGroup('wide-stack')" @preview="selectedShot = $event" />
    </section>

    <section class="novel-section" aria-labelledby="novel-title">
      <div class="container novel-layout">
        <div class="novel-copy">
          <p class="eyebrow" data-assembly-group="novel-kicker" data-build="lines">03 / 故事的另一种模样</p>
          <h2 id="novel-title" data-assembly-group="novel-heading" data-build="lines">看漫画，<br />也读字里行间。</h2>
          <p data-assembly-group="novel-description" data-build="lines">想换个阅读节奏，就翻开一本轻小说。<br />从书库发现新作，在文字里慢慢走远。</p>
          <div class="novel-tags" data-assembly-group="novel-tags" data-build="slots"><span>独立书架</span><span>滚动 / 分页</span><span>离线阅读</span></div>
          <a class="text-link" href="#download">把两种喜欢，都装进口袋 <ArrowUpRight :size="18" aria-hidden="true" /></a>
        </div>
        <div class="novel-spread">
          <figure>
            <button class="phone-shot novel-phone" data-assembly-group="novel-library" data-build="frame" :aria-label="`放大查看：${novels.label}`" @click="selectedShot = novels"><img data-build="image" :src="novels.src" :alt="novels.title" :width="novels.width" :height="novels.height" loading="lazy" /><span class="shot-zoom"><ZoomIn :size="18" aria-hidden="true" /></span></button>
            <figcaption data-assembly-group="novel-library-caption" data-build="lines">01 — 发现新的世界</figcaption>
          </figure>
          <figure>
            <button class="phone-shot novel-phone novel-page" data-assembly-group="novel-reader" data-build="frame" :aria-label="`放大查看：${novelReader.label}`" @click="selectedShot = novelReader"><img data-build="image" :src="novelReader.src" :alt="novelReader.title" :width="novelReader.width" :height="novelReader.height" loading="lazy" /><span class="shot-zoom"><ZoomIn :size="18" aria-hidden="true" /></span></button>
            <figcaption data-assembly-group="novel-reader-caption" data-build="lines">02 — 安静读一会儿</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section id="download" class="download-section container section-space" aria-labelledby="download-title">
      <div class="download-copy">
        <p class="eyebrow" data-assembly-group="download-kicker" data-build="lines">04 / 下一页，从这里开始</p>
        <h2 id="download-title" data-assembly-group="download-heading" data-build="lines">你的下一部喜欢，<br />正在等你。</h2>
        <p data-assembly-group="download-intro" data-build="lines">免费开源。选好设备，就可以出发了。</p>
        <a :href="site.repoUrl" class="text-link" target="_blank" rel="noopener noreferrer"><Github :size="18" aria-hidden="true" /> 在 GitHub 认识 Kira <ArrowUpRight :size="16" aria-hidden="true" /></a>
      </div>
      <div class="download-panel" data-assembly-group="download-frame" data-build="frame">
        <fieldset class="platform-picker" @change.capture="finishGroup('download-description')">
          <legend>选择你的设备</legend>
          <label :class="{ selected: platform === 'android' }"><input v-model="platform" type="radio" name="platform" value="android" /><Smartphone :size="20" aria-hidden="true" /> Android</label>
          <label :class="{ selected: platform === 'windows' }"><input v-model="platform" type="radio" name="platform" value="windows" /><Monitor :size="20" aria-hidden="true" /> Windows</label>
        </fieldset>
        <div class="platform-description" aria-live="polite" data-assembly-group="download-description"><h3 data-build="lines">{{ platform === 'android' ? '把阅读装进口袋。' : '在大一点的屏幕上，接着读。' }}</h3><p data-build="lines" data-build-delay="180">{{ platform === 'android' ? '在发布页选择适合设备的 APK 安装包。多数较新的 Android 手机可选择 arm64 版本。' : '在发布页选择 Windows 安装包，下载后按提示安装。具体兼容要求请查看对应版本说明。' }}</p></div>
        <a class="button download-cta" :href="site.releasesUrl" target="_blank" rel="noopener noreferrer"><Download :size="18" aria-hidden="true" /> 前往 GitHub 下载 <ArrowUpRight :size="18" aria-hidden="true" /></a>
        <div class="download-help"><a href="#docs/getting-started">安装说明 <ArrowUpRight :size="14" aria-hidden="true" /></a><a :href="site.qqGroupUrl" target="_blank" rel="noopener noreferrer">其他平台？到群里聊聊 <ArrowUpRight :size="14" aria-hidden="true" /></a></div>
      </div>
    </section>

    <section class="faq-section container" aria-labelledby="faq-title">
      <div><p class="eyebrow" data-assembly-group="faq-kicker" data-build="lines">翻开之前</p><h2 id="faq-title" data-assembly-group="faq-heading" data-build="lines">你可能想知道。</h2><a href="#docs/getting-started" class="text-link">更多使用说明 <ArrowUpRight :size="16" aria-hidden="true" /></a></div>
      <div class="faq-list"><details v-for="(faq, index) in site.faqs" :key="faq.question" :data-assembly-group="`faq-0${index + 1}`" data-build="rule"><summary><span class="faq-number" data-build="lines">0{{ index + 1 }}</span><span data-build="lines" data-build-delay="140">{{ faq.question }}</span><Plus :size="20" aria-hidden="true" /></summary><p>{{ faq.answer }}</p></details></div>
    </section>
    <ImagePreview :shot="selectedShot" @close="selectedShot = null" />
  </div>
</template>
