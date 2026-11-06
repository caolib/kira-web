// 两个静态入口共用；在首屏样式和 Vue 加载前恢复主题，避免浅色闪烁。
;(() => {
  const storageKey = 'kira:theme'
  const root = document.documentElement
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const colors = { light: '#f7f4ec', dark: '#1c1e1d' }
  const listeners = new Set()
  const normalize = value => ['system', 'dark', 'light'].includes(value) ? value : 'system'
  let mode = readMode()

  function readMode(fallback = 'system') {
    try { return normalize(localStorage.getItem(storageKey)) }
    catch { return fallback }
  }

  function resolve(value = mode) {
    const selected = normalize(value)
    return selected === 'system' ? (media.matches ? 'dark' : 'light') : selected
  }

  function apply(source) {
    const theme = resolve()
    root.dataset.themeMode = mode
    root.dataset.theme = theme
    root.style.colorScheme = theme
    root.style.backgroundColor = colors[theme]
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[theme])
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
    for (const listener of listeners) listener({ mode, theme, source })
  }

  function save() {
    try { localStorage.setItem(storageKey, mode) }
    catch { /* 存储被禁用时，当前页面仍可切换。 */ }
  }

  function onSystemChange() {
    if (mode === 'system') apply('system')
  }

  function onStorage(event) {
    if (event.key !== storageKey && event.key !== null) return
    try { if (event.storageArea !== localStorage) return }
    catch { return }
    mode = readMode(mode)
    apply('storage')
  }

  function listen() {
    media.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorage)
  }

  window.kiraTheme = {
    get mode() { return mode },
    get theme() { return root.dataset.theme },
    resolve,
    save,
    setMode(value) {
      mode = normalize(value)
      apply('user')
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  apply('init')
  listen()
  window.addEventListener('pagehide', () => {
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  })
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return
    mode = readMode(mode)
    apply('storage')
    listen()
  })
})()
