import { ref } from 'vue'

const open = ref(false)

export function useQqGroupDialog() {
  return {
    open,
    openDialog: () => { open.value = true },
    closeDialog: () => { open.value = false },
  }
}
