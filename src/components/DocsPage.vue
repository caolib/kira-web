<script setup>
import { inject, ref, watch, nextTick } from 'vue'
import { ArrowLeft, FileText, BookOpen } from 'lucide-vue-next'
import { useDocs } from '@/composables/useDocs'

const setView = inject('setView')
const { docs, currentId, currentDoc, select } = useDocs()

const contentRef = ref(null)

// 切换文档时把内容区滚回顶部
watch(currentId, async () => {
  await nextTick()
  if (contentRef.value) contentRef.value.scrollTop = 0
})

function goHome() {
  setView?.('home')
}
</script>

<template>
  <section id="docs" class="mx-auto flex w-full min-h-0 flex-1 gap-6 px-4 pb-10 pt-14 sm:px-6 sm:pt-20 lg:px-10">
    <!-- 侧边栏：移动端折叠为顶部水平滚动 -->
    <aside class="shrink-0 lg:w-60">
      <div class="lg:sticky lg:top-20">
        <button type="button"
          class="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-foreground transition hover:border-secondary hover:bg-[rgb(var(--brand)/0.12)]"
          @click="goHome">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          返回展台
        </button>

        <p
          class="mb-2 hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary lg:flex">
          <BookOpen class="h-4 w-4" aria-hidden="true" />
          使用说明
        </p>

        <!-- 移动端：横向滚动条 -->
        <nav class="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
          aria-label="文档目录">
          <a v-for="doc in docs" :key="doc.id" href="#docs"
            class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition lg:whitespace-normal"
            :class="doc.id === currentId
                ? 'bg-[rgb(var(--brand)/0.18)] text-foreground'
                : 'text-muted hover:bg-[rgb(var(--brand)/0.10)] hover:text-foreground'
              " @click.prevent="select(doc.id)">
            <FileText class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ doc.title }}
          </a>
        </nav>
      </div>
    </aside>

    <!-- 正文 -->
    <div ref="contentRef" class="docs-content min-w-0 flex-1 overflow-y-auto">
      <article v-if="currentDoc" class="prose-docs" :key="currentDoc.id" v-html="currentDoc.html" />
      <div v-else class="flex h-full items-center justify-center text-muted">
        暂无说明文档。请在 src/content/docs/ 目录下新建 .md 文件。
      </div>
    </div>
  </section>
</template>
