import { onScopeDispose, ref } from 'vue'

export function useColorScheme() {
  const scheme = ref(window.kiraTheme.theme)
  const unsubscribe = window.kiraTheme.subscribe(state => { scheme.value = state.theme })
  onScopeDispose(unsubscribe)
  return scheme
}
