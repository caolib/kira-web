<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { ArrowUpRight, Check, Copy, Qq, X } from '@/icons'
import { site } from '@/content/site'
import { useQqGroupDialog } from '@/composables/useQqGroupDialog'

const { open, closeDialog } = useQqGroupDialog()
const dialog = ref(null)
const copiedNumber = ref('')
const copyingNumber = ref('')
const copyMessage = ref('')
let feedbackTimer
let copySession = 0

function resetCopyState() {
  copySession += 1
  clearTimeout(feedbackTimer)
  copiedNumber.value = ''
  copyingNumber.value = ''
  copyMessage.value = ''
}

watch(open, value => {
  resetCopyState()
  const element = dialog.value
  if (!element) return
  if (value && !element.open) element.showModal()
  else if (!value && element.open) element.close()
})

onBeforeUnmount(resetCopyState)

// 兼容不支持 Clipboard API 的浏览器；临时输入框必须放在模态框内。
function copyWithSelection(number) {
  const activeElement = document.activeElement
  const field = document.createElement('textarea')
  field.value = number
  field.readOnly = true
  field.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;font-size:16px;'
  dialog.value.append(field)
  try {
    field.focus({ preventScroll: true })
    field.select()
    field.setSelectionRange(0, number.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
    activeElement?.focus({ preventScroll: true })
  }
}

async function copyGroupNumber(group, event) {
  if (copyingNumber.value) return
  const session = copySession
  const card = event.currentTarget.closest('.qq-group-card')
  clearTimeout(feedbackTimer)
  copiedNumber.value = ''
  copyingNumber.value = group.number
  copyMessage.value = ''
  let copied = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(group.number)
      copied = true
    } else {
      copied = copyWithSelection(group.number)
    }
  } catch {
    if (session !== copySession || !open.value) return
    copied = copyWithSelection(group.number)
  }
  if (session !== copySession || !open.value) return
  copyingNumber.value = ''
  if (copied) {
    copiedNumber.value = group.number
    copyMessage.value = `已复制${group.label}群号 ${group.number}`
    feedbackTimer = setTimeout(() => {
      copiedNumber.value = ''
      copyMessage.value = ''
    }, 2400)
  } else {
    copyMessage.value = '复制失败，请手动复制已选中的群号。'
    const field = card.querySelector('input')
    field.focus({ preventScroll: true })
    field.select()
  }
}

function onBackdropClick(event) {
  if (event.target === dialog.value) closeDialog()
}
</script>

<template>
  <dialog ref="dialog" class="qq-dialog" aria-labelledby="qq-dialog-title" @close="closeDialog" @click="onBackdropClick">
    <div class="qq-dialog-head">
      <h2 id="qq-dialog-title">加入交流群</h2>
      <button class="qq-dialog-close" type="button" aria-label="关闭" @click="closeDialog"><X :size="20" aria-hidden="true" /></button>
    </div>
    <div class="qq-group-options">
      <article v-for="(group, index) in site.qqGroups" :key="group.url" class="qq-group-card">
        <div class="qq-group-info">
          <span class="qq-group-logo"><Qq :size="26" aria-hidden="true" /></span>
          <div class="qq-group-details">
            <h3>{{ group.label }}</h3>
            <div class="qq-group-number"><span>群号</span><input :value="group.number" :aria-label="`${group.label}群号`" readonly @focus="$event.target.select()" @click="$event.target.select()" /></div>
          </div>
        </div>
        <div class="qq-group-actions">
          <button class="qq-group-copy" :class="{ copied: copiedNumber === group.number }" type="button" :aria-disabled="Boolean(copyingNumber)" :aria-label="`${copiedNumber === group.number ? '已复制' : '复制'}${group.label}群号 ${group.number}`" @click="copyGroupNumber(group, $event)">
            <component :is="copiedNumber === group.number ? Check : Copy" :size="16" aria-hidden="true" />
            {{ copyingNumber === group.number ? '复制中…' : copiedNumber === group.number ? '已复制' : '复制群号' }}
          </button>
          <a class="qq-group-join" :href="group.url" :autofocus="index === 0" :aria-label="`加入${group.label}`" target="_blank" rel="noopener noreferrer" @click="closeDialog">加入群聊 <ArrowUpRight :size="16" aria-hidden="true" /></a>
        </div>
      </article>
    </div>
    <p class="qq-copy-status" role="status" aria-live="polite" aria-atomic="true">{{ copyMessage }}</p>
  </dialog>
</template>
