<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown, MessageCircle } from 'lucide-vue-next'
import ImagePreview from './ImagePreview.vue'
import { useDocs } from '@/composables/useDocs'
import { site } from '@/content/site'

const props = defineProps({ docId: String })
const { docs, currentId, currentDoc, select } = useDocs()
const article = ref(null)
const previewShot = ref(null)
const directory = ref(null)

// Split image links rather than placing a button inside an anchor. Extracting
// (not cloning) their contents also preserves other images and surrounding links.
function unlinkImage(image, parsed) {
  const link = image.closest('a')
  if (!link) return

  const before = parsed.createRange()
  before.setStart(link, 0)
  before.setEndBefore(image)
  const leadingLink = link.cloneNode(false)
  leadingLink.append(before.extractContents())

  const after = parsed.createRange()
  after.setStartAfter(image)
  after.setEnd(link, link.childNodes.length)
  const trailingLink = link.cloneNode(false)
  trailingLink.removeAttribute('id')
  trailingLink.append(after.extractContents())

  const hasContent = node => node.textContent.trim() || node.querySelector('img')
  link.replaceWith(
    ...(hasContent(leadingLink) ? [leadingLink] : [...leadingLink.childNodes]),
    image,
    ...(hasContent(trailingLink) ? [trailingLink] : [...trailingLink.childNodes]),
  )
}

const documentContent = computed(() => {
  // currentDoc.html has already passed through the markdown sanitation pipeline.
  // Only add DOM nodes/attributes here; never interpolate markup or replace src.
  const parsed = new DOMParser().parseFromString(currentDoc.value?.html || '', 'text/html')
  const headings = [...parsed.querySelectorAll('h2, h3')].map((heading, index) => {
    heading.id = `section-${index}`
    heading.tabIndex = -1
    return { id: heading.id, text: heading.textContent, sub: heading.tagName === 'H3' }
  })

  parsed.querySelectorAll('img').forEach((image) => {
    image.loading = 'lazy'
    image.decoding = 'async'
    if (!image.alt) image.alt = `${currentDoc.value?.title || '使用指南'}操作示意图`
    if (!image.getAttribute('src')) return

    unlinkImage(image, parsed)
    const button = parsed.createElement('button')
    button.type = 'button'
    button.className = 'doc-image-trigger'
    button.setAttribute('aria-label', `放大查看：${image.alt}`)
    button.setAttribute('aria-haspopup', 'dialog')
    const hint = parsed.createElement('span')
    hint.className = 'doc-image-hint'
    hint.textContent = '放大查看'
    hint.setAttribute('aria-hidden', 'true')
    image.replaceWith(button)
    button.append(image, hint)
  })
  return { html: parsed.body.innerHTML, headings }
})
const currentIndex = computed(() => docs.value.findIndex(doc => doc.id === currentId.value))
const nextDoc = computed(() => docs.value[currentIndex.value + 1])

watch(() => props.docId, async (id, previous) => {
  // Unmount the preview before the document's scroll/focus reset.
  previewShot.value = null
  if (directory.value) directory.value.open = false
  select(docs.value.some(doc => doc.id === id) ? id : 'getting-started')
  document.title = `${currentDoc.value?.title || '使用指南'} · Kira`
  if (previous !== undefined) {
    await nextTick()
    window.scrollTo({ top: 0, behavior: 'instant' })
    article.value?.focus({ preventScroll: true })
  }
}, { immediate: true })

function openImage(event) {
  if (!(event.target instanceof Element)) return
  const trigger = event.target.closest('button.doc-image-trigger')
  if (!trigger || !event.currentTarget.contains(trigger)) return
  const image = trigger.querySelector('img')
  const src = image?.getAttribute('src')
  if (!src) return

  // Native buttons dispatch click for Enter/Space; no duplicate key handlers.
  // Explicit focus also records the right return target on touch/Safari.
  trigger.focus({ preventScroll: true })
  previewShot.value = {
    label: currentDoc.value?.title || '使用指南',
    title: image.alt,
    full: src,
    width: image.naturalWidth || image.width || undefined,
    height: image.naturalHeight || image.height || undefined,
  }
}

function closeDirectory() {
  if (!directory.value) return
  directory.value.open = false
  directory.value.querySelector('summary')?.focus({ preventScroll: true })
}

function goHeading(id) {
  const heading = document.getElementById(id)
  heading?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  heading?.focus({ preventScroll: true })
}
</script>

<template>
  <div class="container docs-shell">
    <div class="docs-masthead">
      <p class="eyebrow"><BookOpen :size="16" aria-hidden="true" /> THE KIRA HANDBOOK / 使用指南</p>
      <a class="text-link" href="#"><ArrowLeft :size="15" aria-hidden="true" /> 返回首页</a>
    </div>
    <div class="docs-layout">
      <aside class="docs-sidebar">
        <p class="sidebar-title">从这里开始<span>CONTENTS</span></p>
        <nav class="docs-nav" aria-label="指南目录">
          <a
            v-for="(doc, index) in docs"
            :key="doc.id"
            :href="`#docs/${doc.id}`"
            :aria-current="doc.id === currentId ? 'page' : undefined"
          >
            <span>0{{ index + 1 }}</span>{{ doc.title }}
            <ArrowUpRight v-if="doc.id === currentId" :size="15" aria-hidden="true" />
          </a>
        </nav>
        <div class="docs-support">
          <MessageCircle :size="22" :stroke-width="1.5" aria-hidden="true" />
          <h2>还需要一点帮助？</h2>
          <p>和同样喜欢阅读的人<br />一起聊聊。</p>
          <a :href="site.qqGroupUrl" class="text-link" target="_blank" rel="noopener noreferrer">
            加入交流群 <ArrowUpRight :size="14" aria-hidden="true" />
          </a>
        </div>
      </aside>
      <details ref="directory" class="mobile-doc-directory" @keydown.esc.prevent="closeDirectory">
        <summary>
          <BookOpen :size="22" :stroke-width="1.5" aria-hidden="true" />
          <span class="directory-current"><span>指南目录</span><strong>{{ currentDoc?.title }}</strong></span>
          <ChevronDown class="directory-chevron" :size="18" aria-hidden="true" />
        </summary>
        <nav aria-label="手机指南目录">
          <a
            v-for="(doc, index) in docs"
            :key="doc.id"
            :href="`#docs/${doc.id}`"
            :aria-current="doc.id === currentId ? 'page' : undefined"
            @click="closeDirectory"
          >
            <span class="directory-number">0{{ index + 1 }}</span>
            <span>{{ doc.title }}</span>
            <Check v-if="doc.id === currentId" :size="17" aria-hidden="true" />
            <ArrowUpRight v-else :size="16" aria-hidden="true" />
          </a>
        </nav>
      </details>
      <div class="document-column">
        <p class="document-kicker">使用指南 <span>/</span> {{ currentDoc?.title }}</p>
        <details v-if="documentContent.headings.length" class="mobile-toc">
          <summary>本篇目录</summary>
          <nav aria-label="本篇章节">
            <button v-for="heading in documentContent.headings" :key="heading.id" @click="goHeading(heading.id)">
              {{ heading.text }}
            </button>
          </nav>
        </details>
        <article
          :key="currentId"
          ref="article"
          class="prose-docs docs-content-enter"
          tabindex="-1"
          @click="openImage"
          v-html="documentContent.html"
        />
        <div class="document-end">
          <span>读到这里，就可以试试看了。</span>
          <a v-if="nextDoc" :href="`#docs/${nextDoc.id}`" class="text-link">
            下一篇：{{ nextDoc.title }} <ArrowRight :size="18" aria-hidden="true" />
          </a>
          <a v-else href="#download" class="text-link">去下载 Kira <ArrowRight :size="18" aria-hidden="true" /></a>
        </div>
      </div>
      <aside v-if="documentContent.headings.length" class="docs-toc">
        <p class="sidebar-title">本篇目录</p>
        <nav aria-label="本篇章节">
          <button
            v-for="heading in documentContent.headings"
            :key="heading.id"
            :class="{ 'toc-sub': heading.sub }"
            @click="goHeading(heading.id)"
          >
            {{ heading.text }}
          </button>
        </nav>
      </aside>
    </div>
  </div>
  <ImagePreview v-if="previewShot" :shot="previewShot" @close="previewShot = null" />
</template>

<style scoped>
.mobile-doc-directory { display: none; }
@media (max-width: 767px) {
  .mobile-doc-directory { display: block; margin-bottom: 28px; border: 1px solid var(--rule); border-radius: 7px; background: var(--surface); }
  .mobile-doc-directory summary { display: flex; align-items: center; gap: 14px; min-height: 76px; padding: 14px 18px; color: var(--accent); list-style: none; border-radius: 7px; }
  .mobile-doc-directory summary::-webkit-details-marker { display: none; }
  .directory-current { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
  .directory-current > span { font-size: .6875rem; letter-spacing: .08em; color: var(--muted); }
  .directory-current strong { font-size: 1rem; font-weight: 500; overflow-wrap: anywhere; }
  .directory-chevron { transition: transform 200ms ease; }
  .mobile-doc-directory[open] .directory-chevron { transform: rotate(180deg); }
  .mobile-doc-directory nav { padding: 8px; border-top: 1px solid var(--rule); }
  .mobile-doc-directory nav a { display: flex; align-items: center; gap: 14px; min-height: 52px; margin-bottom: 4px; padding: 12px; border-radius: 4px; font-size: .9375rem; }
  .mobile-doc-directory nav a:last-child { margin-bottom: 0; }
  .mobile-doc-directory nav a[aria-current] { background: var(--sage); color: var(--accent); }
  .mobile-doc-directory nav a:hover { background: var(--sage); }
  .directory-number { color: var(--muted); font-size: .6875rem; }
  .mobile-doc-directory nav a > svg { margin-left: auto; }
}
@media (prefers-reduced-motion: no-preference) {
  .mobile-doc-directory[open] nav { animation: directory-enter 220ms ease-out; }
  @keyframes directory-enter {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
}

.prose-docs :deep(.doc-image-trigger) {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  max-width: 100%;
  min-width: 44px;
  min-height: 44px;
  margin: 12px 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgb(128 128 128 / 35%);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: zoom-in;
  touch-action: manipulation;
  transition: transform 160ms ease-out;
}

.prose-docs :deep(.doc-image-trigger img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0;
  border: 0;
  border-radius: 0;
}

.prose-docs :deep(.doc-image-hint) {
  align-self: stretch;
  padding: 9px 14px;
  background: rgb(128 128 128 / 8%);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  text-align: end;
}

.prose-docs :deep(.doc-image-trigger:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

.prose-docs :deep(.doc-image-trigger:active) {
  transform: scale(.995);
}

.docs-content-enter {
  animation: docs-content-enter 280ms cubic-bezier(.2, .7, .2, 1);
}

@keyframes docs-content-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (hover: hover) {
  .prose-docs :deep(.doc-image-trigger:hover) {
    transform: translateY(-2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .docs-content-enter {
    animation: none;
  }

  .prose-docs :deep(.doc-image-trigger),
  .prose-docs :deep(.doc-image-trigger:hover),
  .prose-docs :deep(.doc-image-trigger:active) {
    transition: none;
    transform: none;
  }
}
</style>
