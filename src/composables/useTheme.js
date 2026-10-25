import { ref } from 'vue'

const STORAGE_KEY = 'kira-theme'
const THEMES = ['dark', 'light']

const theme = ref('dark')

// 读取已保存的主题；无记录时跟随系统偏好
function readStored() {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (THEMES.includes(saved)) return saved
  const prefersLight =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

// 将主题应用到 <html data-theme="...">，并同步移动端浏览器地址栏主题色
function applyTheme(value) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (value === 'dark') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', value)
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', value === 'light' ? '#f0f0f0' : '#000000')
}

// 初始化：同步存储 → 状态 → DOM
// 在应用启动时调用一次，避免首屏闪烁
export function initTheme() {
  theme.value = readStored()
  applyTheme(theme.value)
}

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme(theme.value)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme.value)
    } catch {
      /* localStorage 不可用时静默忽略 */
    }
  }

  return { theme, toggle }
}
