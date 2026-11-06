import assert from 'node:assert/strict'
import { captureScreenshot, gotoReady } from './browser-helpers.mjs'

export async function checkBackToTop(browser, base) {
  for (const width of [1440, 375]) {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      const context = await browser.newContext({ viewport: { width, height: 812 }, reducedMotion })
      try {
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.addInitScript(() => {
          const scrollTo = window.scrollTo.bind(window)
          window.__scrollCalls = []
          window.scrollTo = (...args) => { window.__scrollCalls.push(args[0]); return scrollTo(...args) }
        })
        await gotoReady(page, base)
        const button = page.getByRole('button', { name: '回到顶部', exact: true })
        assert.equal(await button.count(), 0, '顶部不显示回顶按钮')
        await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }))
        await page.evaluate(() => new Promise(requestAnimationFrame))
        assert.equal(await button.count(), 0, '短距离滚动不打扰阅读')
        await page.locator('#reading-flow').scrollIntoViewIfNeeded()
        await button.waitFor()
        await page.waitForFunction(() => !document.querySelector('.back-to-top-enter-active'))
        const box = await button.boundingBox()
        assert.ok(box.width >= 44 && box.height >= 44, '回顶按钮保留 44px 点击区域')
        assert.ok(box.x >= 0 && box.x + box.width <= width - 15 && box.y + box.height <= 812 - 15)
        if (reducedMotion === 'reduce') await captureScreenshot(page, { path: `artifacts/back-to-top-${width}.png` })
        const url = page.url()
        await page.evaluate(() => { window.__scrollCalls = [] })
        await button.click()
        await page.waitForFunction(() => scrollY === 0)
        await button.waitFor({ state: 'detached' })
        assert.equal(page.url(), url, '回顶不改变路由或历史')
        assert.equal(await page.evaluate(() => window.__scrollCalls[0]?.behavior), reducedMotion === 'reduce' ? 'instant' : 'smooth')
        assert.ok(await page.locator('.site-header .brand').evaluate(element => element === document.activeElement), '回顶后焦点回到导航')
        await gotoReady(page, `${base}/#docs/login`)
        await page.locator('.prose-docs h1').waitFor()
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
        await button.waitFor()
        await button.focus()
        await page.keyboard.press('Enter')
        await page.waitForFunction(() => scrollY === 0)
        await button.waitFor({ state: 'detached' })
        assert.match(page.url(), /#docs\/login$/, '指南键盘回顶不返回首页')
        assert.deepEqual(errors, [])
      } finally { await context.close() }
      console.log(`通过：回到顶部 / ${width} ${reducedMotion} 显隐、点击、键盘、焦点与指南`)
    }
  }
}
