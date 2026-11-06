import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export async function captureScreenshot(target, options, { force = false } = {}) {
  if (!force && process.env.TEST_SCREENSHOTS !== '1') return
  mkdirSync(dirname(options.path), { recursive: true })
  return target.screenshot(options)
}

export async function waitForPageReady(page) {
  const url = new URL(page.url())
  const selector = url.pathname.endsWith('/c/') ? '#status-title'
    : url.hash.startsWith('#docs') ? '.prose-docs h1' : '#hero-title'
  await page.locator(selector).waitFor()
  if (url.pathname.endsWith('/c/')) {
    await page.waitForFunction(() => ['链接已就绪', '链接无效'].includes(document.querySelector('#link-state')?.textContent), null, { timeout: 10000 })
  }
  await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.images].every(image => {
    const box = image.getBoundingClientRect()
    return box.width <= 0 || box.height <= 0 || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth || image.complete
  }), null, { timeout: 10000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const visible = [...document.images].filter(image => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
    })
    await Promise.all(visible.map(image => image.decode()))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

export async function gotoReady(page, url) {
  // 分享页会在解析后立即跳转外部协议，不依赖后续文档加载事件。
  await page.goto(url, { waitUntil: new URL(url).pathname.endsWith('/c/') ? 'commit' : 'domcontentloaded' })
  await waitForPageReady(page)
}
