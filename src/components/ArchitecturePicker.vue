<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Check, ChevronDown } from '@/icons'

const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null)
const trigger = ref(null)
const open = ref(false)
const active = ref(0)
const selected = computed(() => props.options.find(option => option.arch === props.modelValue))

function show() {
  active.value = Math.max(0, props.options.findIndex(option => option.arch === props.modelValue))
  open.value = true
}

function choose(index) {
  if (!props.options[index]) return
  emit('update:modelValue', props.options[index].arch)
  open.value = false
  trigger.value?.focus()
}

function onKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const key = event.key
  if (key === 'Tab' || key === 'Escape') {
    if (key === 'Escape' && open.value) event.preventDefault()
    open.value = false
    return
  }
  if (key === 'Enter' || key === ' ') {
    event.preventDefault()
    if (open.value) choose(active.value)
    else show()
  } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
    event.preventDefault()
    if (!open.value) show()
    else if (key === 'ArrowDown') active.value = Math.min(props.options.length - 1, active.value + 1)
    else if (key === 'ArrowUp') active.value = Math.max(0, active.value - 1)
    if (key === 'Home') active.value = 0
    if (key === 'End') active.value = props.options.length - 1
  } else if (key.length === 1) {
    const index = props.options.findIndex(option => option.label.toLowerCase().startsWith(key.toLowerCase()))
    if (index < 0) return
    event.preventDefault()
    if (!open.value) show()
    active.value = index
  }
}

function onOutside(event) {
  if (!root.value?.contains(event.target)) open.value = false
}

watch(() => props.options, () => { open.value = false })
onMounted(() => document.addEventListener('pointerdown', onOutside))
onUnmounted(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="architecture-picker" @keydown="onKeydown" @focusout="!root?.contains($event.relatedTarget) && (open = false)">
    <button ref="trigger" class="architecture-trigger" type="button" role="combobox" aria-haspopup="listbox" :aria-label="`安装包架构：${selected?.label || ''}`" aria-controls="architecture-options" :aria-expanded="open" :aria-activedescendant="open ? `architecture-option-${active}` : undefined" @click="open ? (open = false) : show()">
      <span>{{ selected?.label }}</span><ChevronDown :size="17" aria-hidden="true" />
    </button>
    <ul v-if="open" id="architecture-options" class="architecture-options" role="listbox" aria-label="安装包架构">
      <li v-for="(option, index) in options" :id="`architecture-option-${index}`" :key="option.arch" role="option" tabindex="-1" :aria-selected="option.arch === modelValue" :class="{ active: active === index }" @pointerenter="active = index" @click="choose(index)">
        <span class="architecture-option-copy"><span>{{ option.label }}</span><small>{{ option.description }}</small></span><Check v-if="option.arch === modelValue" :size="16" aria-hidden="true" />
      </li>
    </ul>
  </div>
</template>
