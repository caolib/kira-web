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
  <section
    id="docs"
    class="mx-auto flex w-full min-h-0 flex-1 flex-col gap-2 px-3 pb-6 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:px-6 sm:pt-[calc(5rem+env(safe-area-inset-top,0px))] lg:flex-row lg:gap-6 lg:px-10 lg:pb-10"
  >
    <!-- 侧边栏：移动端折叠为顶栏（返回按钮 + 横向滚动目录），桌面端恢复纵栏 -->
    <aside class="shrink-0 lg:w-60">
      <div class="lg:sticky lg:top-20">
        <p
          class="mb-2 hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-secondary lg:flex">
          <BookOpen class="h-4 w-4" aria-hidden="true" />
          使用说明
        </p>

        <!-- 移动端：返回与目录并排一行，节省纵向空间 -->
        <div class="flex items-center gap-2 lg:flex-col lg:items-stretch">
          <button type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-foreground transition hover:border-secondary hover:bg-[rgb(var(--brand)/0.12)]"
            @click="goHome">
            <ArrowLeft class="h-4 w-4" aria-hidden="true" />
            返回
          </button>

          <nav
            class="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
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
      </div>
    </aside>

    <!-- 正文 -->
    <div ref="contentRef" class="docs-content min-h-0 min-w-0 flex-1 overflow-y-auto">
      <article v-if="currentDoc" class="prose-docs" :key="currentDoc.id" v-html="currentDoc.html" />
      <div v-else class="flex h-full items-center justify-center text-muted">
        暂无说明文档。请在 src/content/docs/ 目录下新建 .md 文件。
      </div>
    </div>
  </section>
</template>
