import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../public/theme.js', import.meta.url), 'utf8')

function setup({ stored = null, dark = false, blocked = false } = {}) {
  const root = { dataset: {}, style: {} }
  const tags = {}
  const media = new EventTarget()
  media.matches = dark
  const window = new EventTarget()
  window.matchMedia = () => media
  const storage = new Map(stored === null ? [] : [['kira:theme', stored]])
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('blocked'); return storage.get(key) ?? null },
    setItem(key, value) { if (blocked) throw new Error('blocked'); storage.set(key, value) },
  }
  const context = vm.createContext({
    window, localStorage,
    document: {
      documentElement: root,
      querySelector: selector => ({ setAttribute: (_, value) => { tags[selector] = value } }),
    },
  })
  vm.runInContext(source, context)
  return {
    root, tags, storage, theme: window.kiraTheme,
    system(value) { media.matches = value; media.dispatchEvent(new Event('change')) },
    storageEvent(value, key = 'kira:theme', area = localStorage) {
      if (value === null) storage.delete('kira:theme')
      else storage.set('kira:theme', value)
      window.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: area }))
    },
    hide() { window.dispatchEvent(new Event('pagehide')) },
    restore() { window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })) },
  }
}

test('首次加载默认自动，跟随系统并同步根属性与浏览器配色，不写入存储', () => {
  for (const dark of [false, true]) {
    const { root, theme, tags, storage } = setup({ dark })
    assert.equal(theme.mode, 'system')
    assert.equal(theme.theme, dark ? 'dark' : 'light')
    assert.equal(root.dataset.themeMode, 'system')
    assert.equal(root.style.colorScheme, theme.theme)
    assert.equal(root.style.backgroundColor, dark ? '#1c1e1d' : '#f7f4ec')
    assert.equal(tags['meta[name="theme-color"]'], root.style.backgroundColor)
    assert.equal(tags['meta[name="color-scheme"]'], theme.theme)
    assert.equal(storage.size, 0)
  }
})

test('保存的显式主题优先于系统，非法偏好安全回退自动', () => {
  for (const stored of ['light', 'dark']) {
    const app = setup({ stored, dark: stored === 'light' })
    assert.equal(app.theme.mode, stored)
    assert.equal(app.theme.theme, stored)
    app.system(stored === 'dark')
    assert.equal(app.theme.theme, stored)
  }
  for (const stored of ['', 'invalid', '__proto__']) {
    const app = setup({ stored, dark: true })
    assert.equal(app.theme.mode, 'system')
    assert.equal(app.theme.theme, 'dark')
    assert.equal(app.theme.resolve(stored), 'dark')
  }
})

test('三态选择与实际配色分离，持久化不进入快照更新回调', () => {
  const app = setup()
  for (const mode of ['dark', 'light', 'system']) {
    app.theme.setMode(mode)
    assert.equal(app.theme.mode, mode)
    assert.equal(app.theme.theme, mode === 'dark' ? 'dark' : 'light')
    app.theme.save()
    assert.equal(app.storage.get('kira:theme'), mode)
  }
  app.system(true)
  assert.equal(app.theme.theme, 'dark')
  assert.equal(app.storage.get('kira:theme'), 'system')
})

test('存储读写被禁用时仍能选择和跟随系统', () => {
  const app = setup({ blocked: true, dark: true })
  assert.equal(app.theme.theme, 'dark')
  app.theme.setMode('light')
  assert.doesNotThrow(() => app.theme.save())
  assert.equal(app.theme.theme, 'light')
  app.theme.setMode('system')
  app.system(false)
  assert.equal(app.theme.theme, 'light')
})

test('跨标签页偏好与清空存储实时同步，忽略其他键及 sessionStorage', () => {
  const app = setup({ dark: true })
  app.storageEvent('light')
  assert.equal(app.theme.theme, 'light')
  app.storageEvent('dark', 'unrelated')
  assert.equal(app.theme.theme, 'light')
  app.storageEvent('dark', 'kira:theme', {})
  assert.equal(app.theme.theme, 'light')
  app.storageEvent(null, null)
  assert.equal(app.theme.mode, 'system')
  assert.equal(app.theme.theme, 'dark')
})

test('订阅可清理，离页取消系统监听，历史缓存恢复后重新同步', () => {
  const app = setup()
  const changes = []
  const unsubscribe = app.theme.subscribe(state => changes.push(state.source))
  app.system(true)
  assert.deepEqual(changes, ['system'])
  unsubscribe()
  app.hide()
  app.system(false)
  assert.equal(app.theme.theme, 'dark')
  app.restore()
  assert.equal(app.theme.theme, 'light')
  app.system(true)
  assert.equal(app.theme.theme, 'dark')
  assert.deepEqual(changes, ['system'])
})

test('两个入口都在正文前同步加载共享主题脚本和色板', () => {
  for (const entry of ['../index.html', '../public/c/index.html']) {
    const html = readFileSync(new URL(entry, import.meta.url), 'utf8')
    assert.match(html, /<script src="\/theme\.js"><\/script>/)
    assert.match(html, /<link rel="stylesheet" href="\/theme\.css"/)
    assert.ok(html.indexOf('/theme.js') < html.indexOf('<body>'))
  }
})

test('深浅色正文、辅助文字及按钮均满足 WCAG AA 文字对比度', () => {
  const css = readFileSync(new URL('../public/theme.css', import.meta.url), 'utf8')
  const blocks = [...css.matchAll(/\{([^}]+)\}/g)].map(match => Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+):\s*(#[\da-f]{6});/g)].map(token => [token[1], token[2]]),
  ))
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  for (const [index, colors] of blocks.entries()) {
    const pairs = ['paper', 'surface', 'sage', 'footer', 'warning-surface'].flatMap(bg => [['ink', bg], ['muted', bg], ['accent', bg]])
    pairs.push(['on-accent', 'accent'], ['on-accent', 'accent-hover'], ['on-ink', 'ink'])
    for (const [fg, bg] of pairs) {
      const values = [luminance(colors[fg]), luminance(colors[bg])].sort((a, b) => b - a)
      const contrast = (values[0] + .05) / (values[1] + .05)
      assert.ok(contrast >= 4.5, `${index === 0 ? '浅色' : '深色'} ${fg}/${bg}: ${contrast.toFixed(2)}`)
    }
  }
})
