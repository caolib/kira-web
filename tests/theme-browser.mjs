import assert from 'node:assert/strict'
import { loadScreenshots } from './screenshot-helpers.mjs'

export async function checkThemes(browser, base) {
  async function scenario(label, check, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce', ...options })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    try {
      await check(page, context)
      assert.deepEqual(errors, [], `${label} 浏览器异常`)
      console.log(`通过：主题 / ${label}`)
    } finally { await context.close() }
  }
  async function state(page, mode, theme) {
    await page.waitForFunction(({ mode, theme }) => document.documentElement.dataset.themeMode === mode && document.documentElement.dataset.theme === theme, { mode, theme })
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme), theme)
  }
  const settled = page => page.waitForFunction(() => !document.documentElement.classList.contains('theme-transition'))
  const overflow = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '主题页面不应横向溢出')

  for (const [width, height] of [[1440, 1000], [375, 812], [320, 740], [812, 375]]) {
    await scenario(`${width} 自动、循环选择、刷新、全站深色与图片`, async (page, context) => {
      await page.goto(base, { waitUntil: 'networkidle' })
      await state(page, 'system', 'dark')
      const button = page.locator('.theme-button')
      assert.equal(await button.innerText(), '')
      assert.match(await button.getAttribute('aria-label'), /自动（跟随系统）.*深色/)
      const rect = await button.boundingBox()
      assert.ok(rect.width >= 44 && rect.height >= 44)
      assert.equal(await page.locator('.site-header a[href="#download"]').count(), 0)
      assert.equal(await page.locator('.nav-github').innerText(), '')
      assert.ok(await page.locator('.nav-github').isVisible())
      assert.match(await page.locator('.nav-github').getAttribute('aria-label'), /GitHub/)
      assert.equal(await page.locator('.nav-qq').innerText(), '')
      assert.ok(await page.locator('.nav-qq').isVisible())
      assert.match(await page.locator('.nav-qq').getAttribute('aria-label'), /QQ 交流群/)
      const iconColors = () => page.locator('.nav-github, .nav-qq').evaluateAll(elements => elements.map(element => getComputedStyle(element).color))
      const darkIconColors = await iconColors()
      assert.equal(darkIconColors[0], darkIconColors[1], '深色主题下 GitHub 和 QQ 图标颜色一致')
      assert.equal(await page.locator('.site-header .brand').innerText(), 'Kira.')
      assert.equal(await page.locator('.site-footer .brand').innerText(), 'Kira.')
      await button.click()
      await state(page, 'dark', 'dark')
      assert.equal(await page.locator('html.theme-transition').count(), 0, '实际配色不变时不应播放动画')
      assert.equal(await page.evaluate(() => localStorage.getItem('kira:theme')), 'dark')
      await page.reload({ waitUntil: 'networkidle' })
      await page.emulateMedia({ colorScheme: 'light' })
      await state(page, 'dark', 'dark')
      await button.click()
      await state(page, 'light', 'light')
      const lightIconColors = await iconColors()
      assert.equal(lightIconColors[0], lightIconColors[1], '浅色主题下 GitHub 和 QQ 图标颜色一致')
      assert.notEqual(lightIconColors[1], darkIconColors[1], 'QQ 图标颜色应跟随主题变化')
      await button.click()
      await state(page, 'system', 'light')
      await page.emulateMedia({ colorScheme: 'dark' })
      await state(page, 'system', 'dark')
      await overflow(page)
      await loadScreenshots(page)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      const screenshots = await page.locator('[data-screenshot-id]').evaluateAll(images => images.map(image => ({
        id: image.dataset.screenshotId, src: image.getAttribute('src'), filter: getComputedStyle(image).filter,
      })))
      assert.equal(screenshots.length, 10)
      for (const image of screenshots) {
        const shared = ['reader', 'spread'].includes(image.id)
        assert.equal(image.src, `/screenshots/reading-edition/${image.id}${shared ? '' : '-dark'}.webp`)
        assert.equal(image.filter, shared ? 'brightness(0.85)' : 'none', `${image.id} 原生深色图不应额外压暗`)
      }
      await page.screenshot({ path: `artifacts/theme-home-dark-${width}.png`, fullPage: true })
      await page.getByRole('button', { name: '放大查看：漫画首页', exact: true }).click()
      await page.locator('.image-preview-image').evaluate(el => el.decode())
      assert.equal(await page.locator('.image-preview').evaluate(el => getComputedStyle(el).colorScheme), 'dark')
      assert.equal(await page.locator('.image-preview-image').evaluate(el => getComputedStyle(el).filter), 'none')
      assert.match(await page.locator('.image-preview-image').getAttribute('src'), /discover-dark-full\.webp$/)
      assert.ok(await page.locator('.image-preview-viewport').evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1))
      await page.screenshot({ path: `artifacts/theme-preview-dark-${width}.png` })
      const dimensions = () => page.locator('[data-screenshot-id]').evaluateAll(images => images.map(image => [image.dataset.screenshotId, image.clientWidth, image.clientHeight]))
      const darkDimensions = await dimensions()
      for (const theme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: theme })
        await state(page, 'system', theme)
        const expected = `/screenshots/reading-edition/discover${theme === 'dark' ? '-dark' : ''}-full.webp`
        await page.waitForFunction(src => document.querySelector('.image-preview-image')?.getAttribute('src') === src, expected)
        await page.locator('.image-preview-image').evaluate(image => image.decode())
        assert.equal(await page.getByRole('link', { name: '查看原图', exact: true }).getAttribute('href'), expected)
        assert.deepEqual(await dimensions(), darkDimensions, '主题切换不改变页面截图尺寸')
        assert.ok(await page.locator('.image-preview-viewport').evaluate(element => element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1))
      }
      await page.keyboard.press('Escape')
      await page.goto(`${base}/#docs/login`, { waitUntil: 'networkidle' })
      await page.locator('.prose-docs h1').waitFor()
      await state(page, 'system', 'dark')
      await overflow(page)
      assert.equal(await page.locator('.prose-docs img').first().evaluate(el => getComputedStyle(el).filter), 'brightness(0.85)')
      if (width === 375 || width === 1440) await page.screenshot({ path: `artifacts/theme-docs-dark-${width}.png`, fullPage: true })
      if (width === 375) {
        await page.addStyleTag({ content: 'html { font-size: 200%; }' })
        await overflow(page)
        await page.screenshot({ path: 'artifacts/theme-docs-dark-text-200.png', fullPage: true })
      }
      await button.click()
      await state(page, 'dark', 'dark')
      await page.goto(`${base}/c/?w=invalid.value`, { waitUntil: 'networkidle' })
      await state(page, 'dark', 'dark')
      assert.equal(await page.locator('.theme-button').count(), 0)
      assert.ok(await page.locator('#open-app').isDisabled())
      await overflow(page)
      if (width === 375 || width === 1440) await page.screenshot({ path: `artifacts/theme-share-dark-${width}.png`, fullPage: true })
      const other = await context.newPage()
      await other.goto(base, { waitUntil: 'networkidle' })
      await other.locator('.theme-button').click()
      await state(other, 'light', 'light')
      await state(page, 'light', 'light')
      await other.evaluate(() => localStorage.clear())
      await state(page, 'system', 'dark')
    }, { viewport: { width, height }, colorScheme: 'dark', isMobile: width < 768, hasTouch: width < 768 })
  }

  await scenario('应用脚本加载前即恢复深色，首屏不闪浅色', async page => {
    await page.addInitScript(() => localStorage.setItem('kira:theme', 'dark'))
    let release
    const gate = new Promise(resolve => { release = resolve })
    await page.route(/\/(assets\/index-[^/]+\.js|src\/main\.js)(\?.*)?$/, async route => {
      await gate
      await route.continue()
    })
    try {
      await page.goto(base, { waitUntil: 'commit' })
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
      assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(28, 30, 29)')
      assert.equal(await page.locator('.theme-button').count(), 0)
    } finally { release() }
    await page.locator('.theme-button').waitFor()
    await state(page, 'dark', 'dark')
  })

  for (const width of [1440, 375]) {
    await scenario(`${width} 真实双向圆形快照、按钮圆心、键盘、连点与清理`, async page => {
      await page.addInitScript(() => {
        window.__themeAnimations = []
        const animate = Element.prototype.animate
        Element.prototype.animate = function (frames, options) {
          const animation = animate.call(this, frames, options)
          if (options?.pseudoElement === '::view-transition-new(root)') {
            animation.pause()
            animation.currentTime = 350
            window.__themeAnimations.push({ animation, frames, options })
          }
          return animation
        }
      })
      await page.goto(base, { waitUntil: 'networkidle' })
      const button = page.locator('.theme-button')
      for (const [index, mode] of ['dark', 'light'].entries()) {
        const rect = await button.boundingBox()
        if (index === 0) await button.click()
        else { await button.focus(); await page.keyboard.press('Enter') }
        await page.waitForFunction(count => window.__themeAnimations.length === count, index + 1)
        await state(page, mode, mode)
        const sample = await page.evaluate(() => {
          const { frames, options } = window.__themeAnimations.at(-1)
          return { frames, options, oldZ: getComputedStyle(document.documentElement, '::view-transition-old(root)').zIndex, newZ: getComputedStyle(document.documentElement, '::view-transition-new(root)').zIndex }
        })
        const x = rect.x + rect.width / 2
        const y = rect.y + rect.height / 2
        assert.equal(sample.frames.clipPath[0], `circle(0px at ${x}px ${y}px)`)
        const radius = Number(sample.frames.clipPath[1].match(/^circle\(([\d.]+)px/)[1])
        assert.ok(radius >= Math.hypot(Math.max(x, width - x), Math.max(y, 812 - y)) - 1)
        assert.equal(sample.options.duration, 1000)
        assert.equal(sample.options.easing, 'ease-out')
        assert.equal(await page.evaluate(() => localStorage.getItem('kira:theme')), mode, '动画尚未结束也应保存选择')
        assert.ok(Number(sample.newZ) > Number(sample.oldZ))
        await button.evaluate(el => { el.click(); el.click() })
        assert.equal(await page.locator('html').getAttribute('data-theme-mode'), mode)
        assert.equal(await page.evaluate(() => window.__themeAnimations.length), index + 1)
        await page.screenshot({ path: `artifacts/theme-transition-${mode}-${width}.png` })
        await page.evaluate(() => window.__themeAnimations.at(-1).animation.finish())
        await settled(page)
        assert.equal(await page.evaluate(() => localStorage.getItem('kira:theme')), mode)
        assert.equal(await button.getAttribute('aria-disabled'), 'false')
      }
      await button.click()
      await state(page, 'system', 'light')
      assert.equal(await page.evaluate(() => window.__themeAnimations.length), 2, '回到同色自动模式不应生成动画')
      await page.emulateMedia({ colorScheme: 'dark' })
      await state(page, 'system', 'dark')
      assert.equal(await page.evaluate(() => window.__themeAnimations.length), 2, '系统变化直接更新')
      await page.emulateMedia({ colorScheme: 'light' })
      await state(page, 'system', 'light')
      await button.click()
      await page.waitForFunction(() => window.__themeAnimations.length === 3)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await settled(page)
      assert.equal(await page.evaluate(() => document.getAnimations().filter(item => item.effect?.pseudoElement).length), 0)
    }, { viewport: { width, height: 812 }, reducedMotion: 'no-preference', isMobile: width < 768, hasTouch: width < 768 })
  }

  for (const failure of ['missing', 'throw', 'ready', 'animate', 'storage']) {
    await scenario(`降级：${failure}`, async page => {
      await page.addInitScript(failure => {
        if (failure === 'missing') document.startViewTransition = undefined
        if (failure === 'throw') document.startViewTransition = () => { throw new Error('unavailable') }
        if (failure === 'ready') document.startViewTransition = update => {
          const done = Promise.resolve().then(update)
          return { ready: done.then(() => { throw new Error('snapshot failed') }), finished: done, skipTransition() {} }
        }
        if (failure === 'animate') {
          const animate = Element.prototype.animate
          Element.prototype.animate = function (frames, options) {
            if (options?.pseudoElement) throw new Error('pseudo animation unavailable')
            return animate.call(this, frames, options)
          }
        }
        if (failure === 'storage') {
          Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error('blocked') }
        }
      }, failure)
      await page.goto(base, { waitUntil: 'networkidle' })
      const button = page.locator('.theme-button')
      await button.click()
      await state(page, 'dark', 'dark')
      await settled(page)
      await button.click()
      await state(page, 'light', 'light')
      await settled(page)
      assert.equal(await button.getAttribute('aria-disabled'), 'false')
    }, { reducedMotion: failure === 'storage' ? 'reduce' : 'no-preference' })
  }

  await scenario('自然时钟动画结束后不残留快照或填充动画', async page => {
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.locator('.theme-button').click()
    await state(page, 'dark', 'dark')
    await settled(page)
    await page.waitForFunction(() => document.getAnimations()
      .filter(animation => animation.animationName !== 'screenshot-tag-float')
      .every(animation => animation.playState !== 'running'))
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.pseudoElement).length), 0)
  }, { reducedMotion: 'no-preference' })
}
