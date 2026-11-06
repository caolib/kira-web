import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { checkPageAssembly } from './hero-assembly.mjs'
import { checkThemes } from './theme-browser.mjs'
import { checkHeroTags } from './hero-tags.mjs'
import { loadScreenshots } from './screenshot-helpers.mjs'
import { checkBackToTop } from './back-to-top.mjs'
import { site } from '../src/content/site.js'
import { checkAutoHideHeader } from './header-scroll.mjs'

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
const executablePath = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(path => path && existsSync(path))
assert.ok(executablePath, '请用 BROWSER_PATH 指定本地 Chromium/Chrome 可执行文件')
mkdirSync('artifacts', { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true })
const results = []

async function checkOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
  assert.ok(size.content <= size.viewport + 1, `${label} 横向溢出: ${JSON.stringify(size)}`)
}

async function checkPreviewFit(page, label) {
  const regions = await page.locator('.image-preview, .image-preview-panel, .image-preview-viewport').evaluateAll(elements => elements.map(el => ({ height: el.clientHeight, content: el.scrollHeight, width: el.clientWidth, contentWidth: el.scrollWidth })))
  assert.ok(regions.every(region => region.content <= region.height + 1 && region.contentWidth <= region.width + 1), `${label} 不应需要滚动: ${JSON.stringify(regions)}`)
}

try {
  await checkAutoHideHeader(browser, base)
  await checkBackToTop(browser, base)
  await checkHeroTags(browser, base)
  await checkThemes(browser, base)
  await checkPageAssembly(browser, base)
  for (const [width, height] of [[1440, 1000], [1920, 1080], [1024, 768], [768, 1024], [375, 812], [320, 740], [812, 375]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: width < 768, hasTouch: width < 768 })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.locator('h1').waitFor()
    await checkOverflow(page, `${width} 首页`)
    assert.equal(await page.title(), 'Kira — 让日常闪闪发光')
    assert.equal(await page.locator('#hero-title').textContent(), '翻开故事，让平凡的日常闪闪发光。')
    assert.equal(await page.locator('#reading-flow .phone-shot').count(), 2, '书签和评论截图归入同一部分')
    assert.equal(await page.locator('#reading-flow .reading-note-row').count(), 4, '续读、合并、总结和疑似剧透沿用编号说明')
    assert.equal(await page.locator('#reading-flow ul').count(), 0)
    const actions = await page.locator('.nav-actions > a, .nav-actions > button').evaluateAll(elements => elements
      .filter(element => element.getClientRects().length)
      .map(element => { const { x, y, width, height } = element.getBoundingClientRect(); return { x, y, width, height } }))
    assert.equal(actions.length, width < 768 ? 4 : 3, `${width} 顶部图标数量`)
    const qq = page.locator('.nav-github + .nav-qq')
    assert.ok(await qq.isVisible(), `${width} QQ 图标应位于 GitHub 右侧且直接可见`)
    assert.equal(await qq.innerText(), '')
    assert.match(await qq.getAttribute('aria-label'), /QQ 交流群/)
    assert.equal(await qq.getAttribute('href'), site.qqGroupUrl)
    assert.equal(await qq.getAttribute('target'), '_blank')
    assert.equal(await qq.getAttribute('rel'), 'noopener noreferrer')
    await context.route(site.qqGroupUrl, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>QQ 交流群</title>' }))
    for (const keyboard of [false, true]) {
      if (keyboard) await qq.focus()
      const [popup] = await Promise.all([page.waitForEvent('popup'), keyboard ? page.keyboard.press('Enter') : qq.click()])
      await popup.waitForLoadState()
      assert.equal(popup.url(), site.qqGroupUrl, `${width} ${keyboard ? '键盘' : '点击'}应打开交流群链接`)
      assert.equal(await popup.evaluate(() => window.opener), null)
      await popup.close()
    }
    assert.equal(actions[0].y, (await page.locator('.site-header .brand').boundingBox()).y, `${width} 品牌与顶部图标应保持同一行`)
    for (const [index, action] of actions.entries()) {
      assert.ok(action.width >= 44 && action.height >= 44, `${width} 顶部图标点击区域至少 44px`)
      if (index === 0) continue
      const previous = actions[index - 1]
      assert.ok(Math.abs(action.x - previous.x - previous.width - 8) < 1, `${width} 顶部图标间距应为 8px`)
      assert.equal(action.y, previous.y, `${width} 顶部图标应对齐`)
    }
    await page.locator('.site-header').screenshot({ path: `artifacts/nav-spacing-${width}.png` })
    await loadScreenshots(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({ path: `artifacts/home-${width}.png`, fullPage: true })
    assert.equal(await page.locator('canvas').count(), 0, '新首页不应加载 3D 画布')

    const previewButton = page.getByRole('button', { name: '放大查看：漫画首页', exact: true })
    await previewButton.click()
    await page.locator('dialog[open]').waitFor()
    await page.locator('.image-preview-image').evaluate(image => image.decode())
    await checkPreviewFit(page, `${width} 首页预览`)
    const viewportBox = await page.locator('.image-preview-viewport').boundingBox()
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2)
    await page.mouse.wheel(0, -400)
    await page.locator('.image-preview-viewport.is-zoomed').waitFor()
    const zoomed = await page.locator('.image-preview-viewport').evaluate(element => ({
      percent: Number(document.querySelector('.image-preview-hint').textContent.match(/(\d+)%/)?.[1] || 0),
      scroll: element.scrollHeight,
      client: element.clientHeight,
    }))
    assert.ok(zoomed.percent > 100, `${width} 滚轮向上应放大图片`)
    assert.ok(zoomed.scroll > zoomed.client, `${width} 放大后图片应超过可视区域`)
    assert.match(await page.locator('.image-preview-hint').innerText(), /% · 滚轮/)
    const scrollTop = await page.locator('.image-preview-viewport').evaluate(element => element.scrollTop)
    assert.ok(scrollTop > 0, `${width} 放大后应围绕光标定位并可滚动`)
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2 - 60)
    await page.mouse.up()
    assert.ok(await page.locator('.image-preview-viewport').evaluate((element, previous) => element.scrollTop > previous, scrollTop), `${width} 拖动应平移放大后的图片`)
    for (let step = 0; step < 8; step++) await page.keyboard.press('-')
    await page.waitForFunction(() => !document.querySelector('.image-preview-viewport.is-zoomed'))
    await checkPreviewFit(page, `${width} 缩回整图`)
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('dialog[open]').count(), 0)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    assert.ok(await previewButton.evaluate(el => el === document.activeElement), '关闭预览应恢复焦点')

    await page.getByRole('link', { name: '下载 Kira', exact: true }).first().click()
    await page.locator('#download').waitFor()
    await page.locator('input[value="windows"]').check()
    assert.match(await page.locator('.platform-description').innerText(), /大一点的屏幕/)
    await page.locator('.faq-list summary').first().click()
    assert.equal(await page.locator('.faq-list details[open]').count(), 1)

    if (width < 768) {
      await page.getByRole('button', { name: '打开导航', exact: true }).click()
      await page.locator('#mobile-nav').getByRole('link', { name: /使用指南/ }).click()
      await page.locator('#mobile-nav').waitFor({ state: 'detached' })
    } else {
      await page.locator('.desktop-nav').getByRole('link', { name: '使用指南', exact: true }).click()
    }
    await page.locator('.prose-docs h1').waitFor()
    assert.match(await page.title(), /下载与安装/)
    await checkOverflow(page, `${width} 文档`)
    if (width === 375 || width === 1440) await page.screenshot({ path: `artifacts/docs-${width}.png`, fullPage: true })

    if (width < 768) {
      assert.equal(await page.locator('select').count(), 0, '手机指南不应使用原生下拉列表')
      await page.locator('.mobile-doc-directory summary').click()
      await checkOverflow(page, `${width} 展开的指南目录`)
      if (width === 375) await page.locator('.mobile-doc-directory').screenshot({ path: 'artifacts/docs-directory-375.png' })
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.mobile-doc-directory[open]').count(), 0)
      await page.keyboard.press('Enter')
      await page.getByRole('navigation', { name: '手机指南目录', exact: true }).getByRole('link', { name: /令牌登录/ }).click()
      assert.equal(await page.locator('.mobile-doc-directory[open]').count(), 0)
    } else await page.locator('.docs-nav').getByRole('link', { name: /令牌登录/ }).click()
    await page.waitForFunction(() => document.querySelector('.prose-docs h1')?.textContent === '令牌登录')
    assert.match(page.url(), /#docs\/login$/)
    await checkOverflow(page, `${width} 登录指南`)
    const docImage = page.locator('.doc-image-trigger').first()
    await docImage.scrollIntoViewIfNeeded()
    await docImage.focus()
    await page.keyboard.press('Enter')
    await page.locator('dialog[open]').waitFor()
    await page.locator('.image-preview-image').evaluate(image => image.decode())
    await checkPreviewFit(page, `${width} 文档预览`)
    if (width === 812) await page.screenshot({ path: 'artifacts/preview-landscape.png' })
    await page.getByRole('button', { name: '原始像素', exact: true }).click()
    assert.equal(await page.locator('.image-preview-viewport.is-original').count(), 1)
    await page.getByRole('button', { name: '适合窗口', exact: true }).click()
    await checkPreviewFit(page, `${width} 适合窗口`)
    await page.keyboard.press('Escape')
    assert.ok(await docImage.evaluate(el => el === document.activeElement), '文档预览应恢复图片按钮焦点')
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.locator('.prose-docs h1').innerText(), '令牌登录')
    await page.goBack({ waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.querySelector('.prose-docs h1')?.textContent === '下载与安装')
    assert.deepEqual(errors, [], `${width} 浏览器异常`)
    results.push({ viewport: `${width}×${height}`, home: 'pass', preview: 'pass', download: 'pass', docs: 'pass', history: 'pass', overflow: 'none' })
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(`${base}/#docs/AI`, { waitUntil: 'networkidle' })
  await checkOverflow(page, 'AI 指南')
  const images = await page.locator('.prose-docs img').evaluateAll(images => images.map(image => image.src))
  for (const src of images) assert.equal((await context.request.get(src)).status(), 200, src)
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await checkOverflow(page, '200% 字体')
  await page.screenshot({ path: 'artifacts/home-text-200.png', fullPage: true })
  await page.goto(`${base}/c/?w=abc.def`, { waitUntil: 'networkidle' })
  assert.ok(await page.locator('#open-app').isDisabled())
  assert.match(await page.locator('#status-title').innerText(), /无效/)
  await checkOverflow(page, '无效分享页')
  await page.screenshot({ path: 'artifacts/share-invalid-375.png', fullPage: true })
  await page.goto(`${base}/c/?w=test-manga_01`, { waitUntil: 'networkidle' })
  assert.ok(await page.locator('#open-app').isEnabled())
  assert.match(await page.locator('#status').innerText(), /尝试|请求/)
  await checkOverflow(page, '有效分享页')
  await page.screenshot({ path: 'artifacts/share-375.png', fullPage: true })
  assert.equal((await context.request.get(`${base}/.well-known/assetlinks.json`)).status(), 200)
  await context.close()

  const motionContext = await browser.newContext({ viewport: { width: 812, height: 375 }, reducedMotion: 'no-preference', colorScheme: 'light' })
  const motionPage = await motionContext.newPage()
  await motionPage.goto(base, { waitUntil: 'networkidle' })
  await motionPage.locator('.study-wide').scrollIntoViewIfNeeded()
  await motionPage.waitForFunction(() => document.getAnimations().filter(animation => animation.animationName !== 'screenshot-tag-float').every(animation => animation.playState !== 'running'))
  await motionPage.getByRole('button', { name: '放大查看：横屏跨页阅读', exact: true }).click()
  await motionPage.locator('.image-preview-image').evaluate(image => image.decode())
  await checkPreviewFit(motionPage, '横屏大图预览')
  await motionPage.screenshot({ path: 'artifacts/spread-preview-landscape.png' })
  await motionPage.keyboard.press('Escape')
  await motionPage.locator('dialog[open]').waitFor({ state: 'hidden' })
  assert.equal(await motionPage.getByRole('button', { name: '换一张', exact: true }).count(), 0)
  assert.equal(await motionPage.locator('.stack-shot').evaluateAll(buttons => buttons.every(button => button.tabIndex === 0)), true)
  await motionPage.locator('.stack-shot.is-back').focus()
  await motionPage.keyboard.press('Enter')
  await motionPage.getByRole('button', { name: '放大查看：横屏首页', exact: true }).waitFor()
  assert.equal(await motionPage.locator('.stack-shot').count(), 2, '堆叠应同时渲染两张截图')
  assert.equal(await motionPage.locator('.study-controls').count(), 0, '横屏截图不再显示 tab')
  assert.equal(await motionPage.locator('#experience .comic-spread .phone-shot').count(), 2, '漫画详情和书架应直接并排显示')
  await motionPage.waitForFunction(() => document.getAnimations().filter(animation => animation.animationName !== 'screenshot-tag-float').every(animation => animation.playState !== 'running'))
  assert.equal(await motionPage.evaluate(() => document.getAnimations().filter(animation => animation.animationName !== 'screenshot-tag-float' && animation.playState === 'running').length), 0, '除可见截图标签外，静止页面不应持续播放动画')
  const beforeAutomatic = await motionPage.locator('.stack-shot.is-front').getAttribute('data-shot')
  await motionPage.mouse.move(0, 0)
  await motionPage.evaluate(() => document.activeElement?.blur())
  await motionPage.waitForFunction(() => document.querySelector('.screenshot-study')?.dataset.rotation === 'playing')
  await motionPage.waitForFunction(previous => document.querySelector('.stack-shot.is-front')?.dataset.shot !== previous, beforeAutomatic, { timeout: 7500 })
  await motionPage.waitForFunction(() => !document.querySelector('.screenshot-study.is-switching'))

  for (const theme of ['dark', 'light']) {
    await motionPage.emulateMedia({ colorScheme: theme })
    const expected = `/screenshots/reading-edition/desktop${theme === 'dark' ? '-dark' : ''}.webp`
    await motionPage.waitForFunction(src => document.querySelector('[data-screenshot-id="desktop"]')?.getAttribute('src') === src, expected)
    await motionPage.locator('.screenshot-study img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
    await motionPage.waitForFunction(() => document.querySelector('.screenshot-study')?.dataset.rotation === 'playing')
    const front = await motionPage.locator('.stack-shot.is-front').getAttribute('data-shot')
    await motionPage.waitForFunction(previous => document.querySelector('.stack-shot.is-front')?.dataset.shot !== previous, front, { timeout: 7500 })
    await motionPage.waitForFunction(() => !document.querySelector('.screenshot-study.is-switching'))
  }

  await motionPage.getByRole('button', { name: '暂停截图自动切换', exact: true }).click()
  await motionPage.mouse.move(0, 0)
  await motionPage.evaluate(() => document.activeElement?.blur())
  assert.equal(await motionPage.locator('.screenshot-study').getAttribute('data-rotation'), 'paused')
  await motionPage.getByRole('button', { name: '开启截图自动切换', exact: true }).click()
  await motionPage.mouse.move(0, 0)
  await motionPage.evaluate(() => document.activeElement?.blur())
  await motionPage.waitForFunction(() => document.querySelector('.screenshot-study')?.dataset.rotation === 'playing')
  await motionPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await motionPage.waitForFunction(() => document.querySelector('.screenshot-study')?.dataset.rotation === 'paused')
  await motionPage.emulateMedia({ reducedMotion: 'reduce' })
  await motionPage.waitForFunction(() => !document.querySelector('.reveal-pending'))
  await motionPage.locator('.screenshot-study').scrollIntoViewIfNeeded()
  assert.equal(await motionPage.locator('.screenshot-study').getAttribute('data-rotation'), 'paused')
  await motionContext.close()
  console.table(results)
  console.log('通过：响应式页面、预览焦点、下载选择、FAQ、文档深链/历史、图片、200% 缩放、分享页及域名验证文件。')
} finally {
  await browser.close()
}
