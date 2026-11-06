import assert from 'node:assert/strict'
import { loadScreenshots, screenshotRegions as regions } from './screenshot-helpers.mjs'

const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
const tagSelector = id => `.screenshot-tag-slot[data-shot-tag="${id}"]`
const state = (page, value, id = 'discover') => page.locator(`${tagSelector(id)}[data-floating="${value}"]`).first().waitFor({ state: 'attached' })
const labels = {
  discover: '漫画首页', reader: '漫画阅读', detail: '漫画详情', bookshelf: '我的书架',
  spread: '横屏跨页阅读', desktop: '横屏首页', novels: '轻小说书库', 'novel-reader': '轻小说阅读',
  bookmarks: '阅读书签', comments: '章节评论',
}

const features = {
  discover: ['双源切换', '发现下一部喜欢'], reader: ['全屏沉浸', '状态显示'],
  detail: ['本地下载', '精确进度'], bookshelf: ['留一格给喜欢', '更新不错过'],
  bookmarks: ['一键续读', '喜欢的片段随时重温'], comments: ['疑似剧透先遮挡', '热门讨论一眼看到'],
  spread: ['大场面一眼看全'], desktop: ['大屏浏览更从容'],
  novels: ['按喜好发现新作'], 'novel-reader': ['字号排版自己定', '沉浸字里行间'],
}

async function checkLayout(page) {
  const { tags, images, viewport, layoutStable } = await page.evaluate(() => {
    const quad = element => {
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const width = parseFloat(style.width)
      const height = parseFloat(style.height)
      let matrix = new DOMMatrix()
      for (let node = element; node; node = node.parentElement) matrix = new DOMMatrix(getComputedStyle(node).transform).multiply(matrix)
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({
        x: box.x + box.width / 2 + matrix.a * x * width / 2 + matrix.c * y * height / 2,
        y: box.y + box.height / 2 + matrix.b * x * width / 2 + matrix.d * y * height / 2,
      }))
    }
    const geometry = () => JSON.stringify([document.documentElement.scrollHeight, ...[...document.querySelectorAll('.phone-shot')].map(element => element.getBoundingClientRect().toJSON())])
    const before = geometry()
    const captions = [...document.querySelectorAll('.screenshot-caption')]
    captions.forEach(element => { element.style.display = 'none' })
    const layoutStable = before === geometry()
    captions.forEach(element => { element.style.display = '' })
    return {
    viewport: innerWidth, layoutStable,
    tags: [...document.querySelectorAll('.screenshot-tag-slot')].flatMap(slot => [...slot.querySelectorAll('.screenshot-tag')].map(tag => ({
      id: slot.dataset.shotTag,
      text: tag.textContent.trim(),
      box: tag.getBoundingClientRect().toJSON(),
      quad: quad(tag),
      hidden: Boolean(tag.closest('[aria-hidden="true"]')),
      pointerEvents: getComputedStyle(tag).pointerEvents,
    }))),
    images: [...document.querySelectorAll('.home-page .phone-shot img')].map(image => ({
      id: image.dataset.screenshotId,
      box: image.getBoundingClientRect().toJSON(),
      quad: quad(image),
    })),
    }
  })
  assert.equal(layoutStable, true, '标签不改变截图尺寸、位置或页面高度')
  const overlaps = (a, b) => [...a, ...b].every((point, index) => {
    const polygon = index < a.length ? a : b
    const next = polygon[(index < a.length ? index + 1 : index - a.length + 1) % polygon.length]
    const axis = { x: -(next.y - point.y), y: next.x - point.x }
    const project = points => points.map(p => p.x * axis.x + p.y * axis.y)
    const pa = project(a), pb = project(b)
    return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) > .01
  })
  const swept = points => [...points, ...points.map(point => ({ ...point, y: point.y - 6 }))]
  assert.equal(tags.length, 17, '十张截图保留全部 17 个特点标签，手机不隐藏')
  assert.equal(new Set(tags.map(tag => tag.id)).size, 10)
  for (const [id, expected] of Object.entries(features)) assert.deepEqual(tags.filter(tag => tag.id === id).map(tag => tag.text), expected)
  assert.deepEqual([...new Set(tags.map(tag => tag.id))].sort(), images.map(image => image.id).sort())
  assert.equal(await page.locator('.screenshot-name').count(), 0, '图片下方不另显示名称')
  for (const [index, tag] of tags.entries()) {
    assert.ok(tag.box.width > 0 && tag.box.height > 0, `${tag.id} 标签可见`)
    assert.equal(tag.hidden, false, '特点文案对辅助技术可读')
    assert.ok(!Object.values(labels).includes(tag.text), '特点标签不再使用图片名称')
    assert.equal(tag.pointerEvents, 'none')
    assert.ok(tag.box.left >= 0 && tag.box.right <= viewport + 1, `${tag.id} 标签不越出视口`)
    // 用旋转后的实际四边形检查，包含向上浮动 6px；外接矩形会把倾斜截图角落的留白误报为遮挡。
    for (const image of images) assert.ok(!overlaps(swept(tag.quad), image.quad), `${tag.id}:${tag.text} 不能遮挡 ${image.id} 截图`)
    for (const other of tags.slice(index + 1)) assert.ok(!overlaps(swept(tag.quad), swept(other.quad)), `${tag.id}:${tag.text} 与 ${other.id}:${other.text} 不重叠`)
  }
  assert.equal(await page.locator('.screenshot-tag-slot a, .screenshot-tag-slot button, .screenshot-tag-slot [tabindex]').count(), 0)
}

async function assertPaused(page, id = 'discover') {
  await state(page, 'paused', id)
  await frame(page)
  const times = () => page.locator(`${tagSelector(id)} .screenshot-tag`).evaluateAll(elements => elements.flatMap(element => element.getAnimations())
    .filter(animation => animation.animationName === 'screenshot-tag-float').map(animation => animation.currentTime))
  const before = await times()
  await frame(page)
  assert.deepEqual(await times(), before, `${id} 暂停时实际动画时间线不应推进`)
}

export async function checkHeroTags(browser, base) {
  for (const [width, height] of [[1440, 1000], [1920, 1080], [1024, 768], [768, 1024], [375, 812], [320, 740], [812, 375]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: 'light' })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(base, { waitUntil: 'networkidle' })
      await loadScreenshots(page)
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') await page.locator('.theme-button').click()
        await checkLayout(page)
        assert.equal(await page.locator('.screenshot-tag-slot[data-floating="playing"]').count(), 0)
        assert.equal(await page.locator('.screenshot-tag').evaluateAll(elements => elements.flatMap(element => element.getAnimations()).length), 0)
        for (const [name, selector] of regions) {
          await page.locator(selector).screenshot({ path: `artifacts/screenshot-tags-${name}-${theme}-${width}.png` })
        }
      }
      if (width === 320 || width === 375 || width === 768) {
        await page.addStyleTag({ content: 'html { font-size: 200%; }' })
        await checkLayout(page)
        await page.locator('.hero-art').screenshot({ path: `artifacts/screenshot-tags-text-200-${width}.png` })
      }
      assert.deepEqual(errors, [])
    } finally { await context.close() }
    console.log(`通过：截图标签 / ${width} 十图十七个特点标签、全程不遮挡、深浅色与减少动态效果`)
  }

  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'no-preference', hasTouch: width === 375 })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        window.__holdTagAssembly = true
        const animate = Element.prototype.animate
        Element.prototype.animate = function (...args) {
          const animation = animate.apply(this, args)
          queueMicrotask(() => { if (window.__holdTagAssembly && animation.id.startsWith('assembly:')) animation.pause() })
          return animation
        }
      })
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.locator(tagSelector('discover')).scrollIntoViewIfNeeded()
      await page.locator('[data-assembly-group="hero-discover-caption"][data-assembly-state="playing"]').waitFor()
      assert.equal(await page.locator(tagSelector('discover')).getAttribute('data-floating'), 'paused', '生成完成前不飘动')
      await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith('assembly:hero-discover-caption:')).forEach(animation => { animation.currentTime = 700 }))
      await frame(page)
      const alignment = await page.evaluate(() => {
        const tags = [...document.querySelectorAll('[data-shot-tag="discover"] .screenshot-tag')]
        const frames = [...document.querySelectorAll('.assembly-selection[data-assembly-owner="hero-discover-caption"]')]
        return tags.map((tag, index) => ({ tag: tag.getBoundingClientRect().toJSON(), frame: frames[index]?.getBoundingClientRect().toJSON() }))
      })
      for (const pair of alignment) {
        assert.ok(pair.frame, '每个 tag 都有自己的动画选框')
        for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(pair.tag[key] - pair.frame[key]) < 1, `${width} tag 选框 ${key} 应与实际标签对齐`)
      }
      await page.screenshot({ path: `artifacts/tag-frame-alignment-${width}.png` })
      await page.evaluate(() => {
        window.__holdTagAssembly = false
        document.getAnimations().filter(animation => animation.id.startsWith('assembly:')).forEach(animation => animation.finish())
      })
      await state(page, 'playing')
      const initial = await page.locator(`${tagSelector('discover')} .screenshot-tag`).first().evaluate(element => getComputedStyle(element).transform)
      await page.waitForFunction(initial => getComputedStyle(document.querySelector('[data-shot-tag="discover"] .screenshot-tag')).transform !== initial, initial)
      await page.locator('.hero-phone-discover').hover()
      await assertPaused(page)
      await page.mouse.move(0, 0)
      await state(page, 'playing')
      await page.locator('.hero-phone-reader').focus()
      await assertPaused(page)
      await page.evaluate(() => document.activeElement.blur())
      await state(page, 'playing')
      if (width === 375) await page.locator('.hero-phone-discover').tap()
      else await page.locator('.hero-phone-discover').click()
      await page.locator('dialog[open]').waitFor()
      await assertPaused(page)
      assert.equal(await page.locator('dialog .screenshot-tag').count(), 0, '预览只展示原始截图')
      await page.keyboard.press('Escape')
      await page.locator('dialog[open]').waitFor({ state: 'hidden' })
      await page.evaluate(() => document.activeElement.blur())
      await page.mouse.move(0, 0)
      await state(page, 'playing')

      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await assertPaused(page)
      await page.evaluate(() => {
        delete document.hidden
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await state(page, 'playing')
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
      await assertPaused(page)
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')))
      await state(page, 'playing')

      await page.locator('#experience .comic-spread').scrollIntoViewIfNeeded()
      await state(page, 'playing', 'detail')
      await assertPaused(page)
      for (const id of ['bookmarks', 'comments']) {
        await page.mouse.move(0, 0)
        await page.locator(`#${id}`).scrollIntoViewIfNeeded()
        await state(page, 'playing', id)
        await page.getByRole('button', { name: `放大查看：${labels[id]}`, exact: true }).click()
        await page.locator('dialog[open]').waitFor()
        await page.locator('.image-preview-image').evaluate(image => image.decode())
        await assertPaused(page, id)
        assert.ok(await page.locator('.image-preview-viewport').evaluate(element => element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1))
        await page.keyboard.press('Escape')
        await page.locator('dialog[open]').waitFor({ state: 'hidden' })
        await page.evaluate(() => document.activeElement.blur())
        await page.mouse.move(0, 0)
      }
      await page.locator('.screenshot-study').scrollIntoViewIfNeeded()
      await state(page, 'playing', 'spread')
      await assertPaused(page, 'detail')
      await page.locator('.stack-shot.is-back').focus()
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => !document.querySelector('.screenshot-study.is-switching'))
      await assertPaused(page, 'spread')
      await checkLayout(page)
      await page.mouse.move(0, 0)
      await page.evaluate(() => document.activeElement.blur())
      await page.locator('.novel-spread').scrollIntoViewIfNeeded()
      await state(page, 'playing', 'novels')
      await assertPaused(page, 'spread')
      await page.locator('.novel-phone').first().click()
      await page.locator('dialog[open]').waitFor()
      assert.equal(await page.locator('.screenshot-tag-slot[data-floating="playing"]').count(), 0, '任意截图预览期间所有标签暂停')
      await page.keyboard.press('Escape')
      await page.locator('dialog[open]').waitFor({ state: 'hidden' })
      await page.evaluate(() => document.activeElement.blur())
      await page.mouse.move(0, 0)
      await state(page, 'playing', 'novels')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await assertPaused(page, 'novels')
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await state(page, 'playing', 'novels')
      await page.evaluate(() => {
        window.__tagAnimations = document.getAnimations().filter(animation => animation.animationName === 'screenshot-tag-float')
        location.hash = '#docs/getting-started'
      })
      await page.locator('.screenshot-tag-slot').first().waitFor({ state: 'detached' })
      await frame(page)
      assert.ok(await page.evaluate(() => window.__tagAnimations.every(animation => animation.playState === 'idle')), '卸载后取消全部标签动画')
      await page.getByRole('link', { name: 'Kira 首页', exact: true }).click()
      await page.locator(tagSelector('discover')).scrollIntoViewIfNeeded()
      await state(page, 'playing')
      assert.deepEqual(errors, [])
    } finally { await context.close() }
    console.log(`通过：截图标签 / ${width} 入场、浮动、分区暂停、预览、堆叠切换与卸载`)
  }

  const context = await browser.newContext({ reducedMotion: 'no-preference' })
  try {
    const page = await context.newPage()
    await page.addInitScript(() => { delete window.IntersectionObserver })
    await page.goto(base, { waitUntil: 'networkidle' })
    await assertPaused(page)
    await loadScreenshots(page)
    await checkLayout(page)
  } finally { await context.close() }
  console.log('通过：截图标签 / 无 IntersectionObserver 时静态呈现')
}
