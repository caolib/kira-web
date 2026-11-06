import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { site } from '../src/content/site.js'
import { preloadScreenshotTheme, resolveScreenshot } from '../src/utils/screenshots.js'

test('十个界面具有展示图与原图，八组配对主题，仅两个漫画阅读界面共用图片', () => {
  assert.equal(site.screenshots.length, 10)
  assert.equal(new Set(site.screenshots.map(shot => shot.id)).size, 10)
  assert.equal(site.screenshots.filter(shot => shot.dark).length, 8)
  assert.deepEqual(site.screenshots.filter(shot => shot.dimInDark).map(shot => shot.id).sort(), ['reader', 'spread'])
  for (const shot of site.screenshots) {
    for (const source of [shot.light, shot.dark].filter(Boolean)) {
      for (const path of [source.src, source.full]) assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), path)
    }
  }
})

test('主题解析同时切换展示图和高清原图，不改变标签、比例或原始元数据', () => {
  for (const shot of site.screenshots) {
    const dark = resolveScreenshot(shot, 'dark')
    assert.equal(dark.src, (shot.dark || shot.light).src)
    assert.equal(dark.full, (shot.dark || shot.light).full)
    assert.equal(dark.width, shot.width)
    assert.equal(dark.height, shot.height)
    assert.equal(dark.label, shot.label)
    assert.equal(shot.src, shot.light.src)
    assert.equal(resolveScreenshot(dark, 'light').src, shot.light.src, '从已解析的深色截图切回浅色，不能继续使用深色地址')
    assert.equal(resolveScreenshot(dark, 'light').full, shot.light.full)
  }
})

test('没有主题版本的指南图片与空预览仍沿用原地址', () => {
  const image = { label: '指南图片', src: '/guide.png', full: '/guide-full.png', width: 500, height: 800 }
  assert.deepEqual(resolveScreenshot(image, 'dark'), image)
  assert.equal(resolveScreenshot(null, 'dark'), null)
})

const baseURI = 'https://kira.test/'

function screenshotImage(light, dark = light, box = {}) {
  return {
    src: new URL(light, baseURI).href,
    currentSrc: new URL(light, baseURI).href,
    dataset: { themeLight: light, themeDark: dark },
    getBoundingClientRect: () => ({ width: 100, height: 200, top: 0, bottom: 200, left: 0, right: 100, ...box }),
  }
}

function mockPreloads(t, images, Image) {
  const globals = { document: { baseURI, querySelectorAll: () => images }, innerWidth: 800, innerHeight: 600, Image }
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original)
      else delete globalThis[name]
    })
  }
}

test('预热仅加载视口内不同的目标图，规范化地址并复用进行中和成功的任务', async t => {
  const requests = []
  let complete
  const decoding = new Promise(resolve => { complete = resolve })
  mockPreloads(t, [
    screenshotImage('/dedupe.webp', '/dedupe-dark.webp'),
    screenshotImage('/dedupe.webp', `${baseURI}dedupe-dark.webp`),
    screenshotImage('/shared.webp'),
    screenshotImage('/below.webp', '/below-dark.webp', { top: 700, bottom: 900 }),
    screenshotImage('/hidden.webp', '/hidden-dark.webp', { width: 0 }),
  ], class {
    set src(value) { requests.push(value) }
    decode() { return decoding }
  })
  const first = preloadScreenshotTheme('dark')
  const second = preloadScreenshotTheme('dark')
  assert.deepEqual(requests, [`${baseURI}dedupe-dark.webp`])
  complete()
  assert.deepEqual(await first, [true])
  assert.deepEqual(await second, [true])
  assert.deepEqual(await preloadScreenshotTheme('dark'), [true])
  assert.equal(requests.length, 1)
  assert.deepEqual(await preloadScreenshotTheme('light'), [], '当前地址不需要重新加载或解码')
})

test('解码失败不会标记预热成功，后续操作可以重试', async t => {
  let attempts = 0
  mockPreloads(t, [screenshotImage('/retry.webp', '/retry-dark.webp')], class {
    decode() {
      return ++attempts === 1 ? Promise.reject(new Error('decode failed')) : Promise.resolve()
    }
  })
  assert.deepEqual(await preloadScreenshotTheme('dark'), [false])
  assert.deepEqual(await preloadScreenshotTheme('dark'), [true])
  assert.deepEqual(await preloadScreenshotTheme('dark'), [true])
  assert.equal(attempts, 2)
})

test('没有 decode 时等待 load 和有效图片尺寸，不提前标记就绪', async t => {
  let image
  mockPreloads(t, [screenshotImage('/load.webp', '/load-dark.webp')], class {
    constructor() { image = this }
    naturalWidth = 100
    naturalHeight = 200
  })
  let settled = false
  const ready = preloadScreenshotTheme('dark').then(result => { settled = true; return result })
  await Promise.resolve()
  assert.equal(settled, false)
  image.onload()
  assert.deepEqual(await ready, [true])
  assert.equal(image.onload, null)
  assert.equal(image.onerror, null)
})

test('没有 decode 时加载失败或图片尺寸无效均可重试', async t => {
  let image
  mockPreloads(t, [screenshotImage('/load-retry.webp', '/load-retry-dark.webp')], class {
    constructor() { image = this }
    naturalWidth = 0
    naturalHeight = 0
  })
  const failed = preloadScreenshotTheme('dark')
  image.onerror()
  assert.deepEqual(await failed, [false])
  const invalid = preloadScreenshotTheme('dark')
  image.onload()
  assert.deepEqual(await invalid, [false])
  const recovered = preloadScreenshotTheme('dark')
  image.naturalWidth = 100
  image.naturalHeight = 200
  image.onload()
  assert.deepEqual(await recovered, [true])
})
