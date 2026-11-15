<script setup>
import { ref, watch } from 'vue'
import { ArrowUpRight, X } from '@/icons'
import { site } from '@/content/site'
import { useQqGroupDialog } from '@/composables/useQqGroupDialog'

const { open, closeDialog } = useQqGroupDialog()
const dialog = ref(null)

watch(open, value => {
  const element = dialog.value
  if (!element) return
  if (value && !element.open) element.showModal()
  else if (!value && element.open) element.close()
})

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
      <a v-for="(group, index) in site.qqGroups" :key="group.url" :href="group.url" :autofocus="index === 0" target="_blank" rel="noopener noreferrer" @click="closeDialog">
        <span>{{ group.label }}</span>
        <ArrowUpRight :size="16" aria-hidden="true" />
      </a>
    </div>
  </dialog>
</template>
