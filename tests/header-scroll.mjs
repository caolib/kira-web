import assert from 'node:assert/strict'
import { captureScreenshot, gotoReady } from './browser-helpers.mjs'

export async function checkAutoHideHeader(browser, base) {
  for (const width of [1440, 375, 320]) {
    for (const path of ['/', '/#docs/login']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', isMobile: width < 768, hasTouch: width < 768 })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const state = hidden => page.waitForFunction(hidden => {
        const header = document.querySelector('.site-header')
        const surface = document.querySelector('.header-surface').getBoundingClientRect()
        return header.classList.contains('is-hidden') === hidden && (hidden ? surface.bottom <= 1 : surface.top >= -.1)
      }, hidden)
      const scroll = async y => {
        await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y)
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      }
      try {
        await page.mouse.move(width / 2, 700)
        await gotoReady(page, `${base}${path}`)
        await state(false)
        const height = await page.locator('.site-header').evaluate(element => element.offsetHeight)
        await scroll(50)
        await state(false)
        await scroll(300)
        await state(true)
        assert.equal(await page.locator('.site-header').evaluate(element => element.offsetHeight), height, '隐藏不改变外层高度与正文排版')
        await scroll(296)
        await state(true)
        await scroll(292)
        await state(false)
        await scroll(300)
        await state(false)
        await scroll(308)
        await state(true)
        await page.keyboard.press('Tab')
        if (!await page.locator('.site-header').evaluate(element => element.contains(document.activeElement))) await page.keyboard.press('Tab')
        await state(false)
        assert.ok(await page.locator('.site-header').evaluate(element => element.contains(document.activeElement)), '键盘进入隐藏导航应立即恢复可见')
        await scroll(500)
        await state(false)
        await page.evaluate(() => document.activeElement.blur())
        await page.mouse.move(width / 2, 700)
        await scroll(600)
        await state(true)

        if (path === '/') {
          const stars = page.locator('.tagline-sparkle')
          assert.equal(await stars.count(), 4)
          assert.ok(await stars.evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === 'none')))
          assert.equal(await stars.first().evaluate(element => getComputedStyle(element).color), await page.locator('.title-underline').evaluate(element => getComputedStyle(element).color), '静态星星应使用主题色')
          await page.evaluate(() => document.querySelector('.hero-phone').click())
          await page.locator('dialog[open]').waitFor()
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          assert.ok(await page.locator('.site-header').evaluate(element => element.classList.contains('is-hidden')), '打开预览不应误显示导航')
          await page.keyboard.press('Escape')
          await page.locator('dialog[open]').waitFor({ state: 'hidden' })
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          await state(true)
        }

        if (width < 768) {
          await scroll(592)
          await state(false)
          await page.getByRole('button', { name: '打开导航', exact: true }).tap()
          await page.locator('#mobile-nav').waitFor()
          await scroll(700)
          await state(false)
          await page.getByRole('button', { name: '关闭导航', exact: true }).tap()
          await page.locator('#mobile-nav').waitFor({ state: 'hidden' })
          await page.evaluate(() => document.activeElement.blur())
          await page.mouse.move(width / 2, 700)
          await scroll(732)
          await state(true)
        }

        await scroll(1200)
        await page.getByRole('button', { name: '回到顶部', exact: true }).click()
        await state(false)
        assert.ok(await page.locator('.site-header .brand').evaluate(element => element === document.activeElement))
        const label = path === '/' ? 'home' : 'docs'
        await captureScreenshot(page, { path: `artifacts/header-scroll-${width}-${label}-shown.png`, clip: { x: 0, y: 0, width, height: 180 } })
        await page.evaluate(() => document.activeElement.blur())
        await page.mouse.move(width / 2, 700)
        await scroll(600)
        await state(true)
        await captureScreenshot(page, { path: `artifacts/header-scroll-${width}-${label}-hidden.png`, clip: { x: 0, y: 0, width, height: 180 } })
        assert.deepEqual(errors, [])
        console.log(`通过：${width}px ${label} 下滚隐藏、上滚恢复、键盘/菜单/预览与回顶`)
      } finally { await context.close() }
    }
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  try {
    await page.mouse.move(700, 700)
    await gotoReady(page, base)
    await page.waitForFunction(() => document.querySelector('#hero-title')?.dataset.assemblyState === 'complete')
    assert.equal(await page.locator('.header-surface').evaluate(element => getComputedStyle(element).transitionDuration), '0.18s')
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelector('.header-surface').getBoundingClientRect().bottom <= 1)
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
    await page.waitForFunction(() => document.querySelector('.header-surface').getBoundingClientRect().top >= -.1)
    console.log('通过：顶部栏 180ms 滑出/滑入')
  } finally { await context.close() }
}
