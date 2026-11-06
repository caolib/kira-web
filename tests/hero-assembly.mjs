import assert from 'node:assert/strict'
import { captureScreenshot, gotoReady } from './browser-helpers.mjs'

const groupSelector = id => `[data-assembly-group="${id}"]`
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

// 暂停真实 WAAPI 动画以检查任意时刻；不伪造状态、关键帧或生产清理逻辑。
async function installProbe(page, { fontScale = false, pause = true } = {}) {
  await page.addInitScript(({ fontScale, pause }) => {
    const probe = window.__assemblyTest = { pause, animations: [], starts: [], groups: new Set() }
    const original = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const animation = original.apply(this, args)
      queueMicrotask(() => {
        if (!animation.id.startsWith('assembly:')) return
        if (probe.pause) animation.pause()
        probe.animations.push(animation)
        const id = animation.id.split(':')[1]
        if (probe.groups.has(id)) return
        probe.groups.add(id)
        const group = document.querySelector(`[data-assembly-group="${id}"]`)
        const anchor = [...group.querySelectorAll('[data-assembly-anchor]')].find(element => element.closest('[data-assembly-group]') === group) || group
        probe.starts.push({ id, rect: anchor.getBoundingClientRect().toJSON(), height: innerHeight, width: innerWidth, hidden: document.hidden })
      })
      return animation
    }
    if (fontScale) {
      const insert = () => {
        if (!document.documentElement) return false
        const style = document.createElement('style')
        style.textContent = 'html { font-size: 200% !important; }'
        document.documentElement.append(style)
        return true
      }
      if (!insert()) {
        const observer = new MutationObserver(() => { if (insert()) observer.disconnect() })
        observer.observe(document, { childList: true, subtree: true })
      }
    }
  }, { fontScale, pause })
}

async function playing(page, id) {
  await page.waitForFunction(id => {
    const group = document.querySelector(`[data-assembly-group="${id}"]`)
    return group?.dataset.assemblyState === 'playing' && document.getAnimations().some(animation => animation.id.startsWith(`assembly:${id}:`))
  }, id, { timeout: 10000 })
}

async function seek(page, id, time) {
  await page.evaluate(({ id, time }) => {
    for (const animation of document.getAnimations()) {
      if (animation.id.startsWith(id ? `assembly:${id}:` : 'assembly:')) animation.currentTime = time
    }
  }, { id, time })
  await frame(page)
}

async function complete(page, id) {
  await page.evaluate(id => document.getAnimations().filter(animation => animation.id.startsWith(`assembly:${id}:`)).forEach(animation => animation.finish()), id)
  await assertComplete(page, id)
}

async function assertComplete(page, id) {
  await page.locator(`${groupSelector(id)}[data-assembly-state="complete"]`).waitFor({ state: 'attached' })
  assert.equal(await page.locator(`.assembly-selection[data-assembly-owner="${id}"]`).count(), 0, `${id} 完成后删除临时选中框及四角控制点`)
  assert.equal(await page.evaluate(id => document.getAnimations().filter(animation => animation.id.startsWith(`assembly:${id}:`)).length, id), 0, `${id} 完成后取消所有 WAAPI 填充效果`)
  const leftovers = await page.locator(groupSelector(id)).evaluate(group => [group, ...group.querySelectorAll('*')].filter(element => element.closest('[data-assembly-group]') === group && (element.matches('.assembly-outline, [data-assembly-concealed], .assembly-working') || (element.matches('.assembly-positioned') && !element.querySelector('.assembly-selection')))).length)
  assert.equal(leftovers, 0, `${id} 完成后不残留轮廓、隐藏状态或无人使用的临时定位；独立子组仍播放时可共享定位父级`)
}

async function completeActive(page) {
  const ids = await page.locator('[data-assembly-state="playing"]').evaluateAll(groups => groups.map(group => group.dataset.assemblyGroup))
  for (const id of ids) await complete(page, id)
}

async function scrollToGroup(page, id) {
  await page.locator(groupSelector(id)).evaluate(group => {
    const anchor = [...group.querySelectorAll('[data-assembly-anchor]')].find(element => element.closest('[data-assembly-group]') === group) || group
    const header = document.querySelector('.site-header').getBoundingClientRect().bottom
    window.scrollTo({ top: scrollY + anchor.getBoundingClientRect().top - header - 32, behavior: 'instant' })
  })
  await frame(page)
}

async function snapshot(page, selector) {
  return page.locator(selector).evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect()
    return { text: element.textContent, x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }
  }))
}

function sameLayout(actual, expected, label) {
  assert.equal(actual.length, expected.length, label)
  actual.forEach((item, index) => {
    assert.equal(item.text, expected[index].text, `${label} 不得拆改 DOM 文本`)
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(item[key] - expected[index][key]) < 0.75, `${label} ${key} 改变: ${item[key]} / ${expected[index][key]}`)
  })
}

async function checkLayers(page, id) {
  const layers = await page.locator(`.assembly-selection[data-assembly-owner="${id}"]`).evaluateAll(elements => elements.map(element => {
    const border = element.querySelector('.assembly-selection-box')
    const box = element.getBoundingClientRect()
    const style = border && getComputedStyle(border)
    return {
      hidden: element.getAttribute('aria-hidden'), pointer: getComputedStyle(element).pointerEvents,
      part: element.dataset.assemblyPart, width: box.width, height: box.height,
      selectionAnimation: document.getAnimations().some(animation => animation.effect.target === element && animation.id.startsWith(`assembly:${element.dataset.assemblyOwner}:`) && animation.id.endsWith('-selection')),
      opacity: Number(getComputedStyle(element).opacity),
      borderWidth: style && parseFloat(style.borderTopWidth), borderColor: style?.borderTopColor,
      background: style?.backgroundColor, radius: style?.borderTopLeftRadius,
      brand: getComputedStyle(element).getPropertyValue('--accent').trim(),
      borderOpacity: style && Number(style.opacity),
      innerWidth: border?.clientWidth, innerHeight: border?.clientHeight,
      handles: [...element.querySelectorAll('.assembly-selection-handle')].map(handle => {
        const rect = handle.getBoundingClientRect()
        const style = getComputedStyle(handle)
        return { classes: [...handle.classList], width: parseFloat(style.width), height: parseFloat(style.height), radius: style.borderRadius, pointer: style.pointerEvents, tabIndex: handle.tabIndex, left: handle.offsetLeft, top: handle.offsetTop, x: rect.x, y: rect.y }
      }),
    }
  }))
  assert.ok(layers.length > 0, `${id} 生成时必须出现编辑器选中框`)
  const rgb = color => color.startsWith('#')
    ? color.slice(1).match(/.{2}/g).map(value => parseInt(value, 16))
    : color.match(/[\d.]+/g).map((value, index) => color.startsWith('color(srgb ') && index < 3 ? Math.round(Number(value) * 255) : Number(value))
  layers.forEach(layer => {
    assert.equal(layer.hidden, 'true')
    assert.equal(layer.pointer, 'none')
    assert.ok(layer.part)
    assert.equal(layer.selectionAnimation, true, '选中框动画应使用对应组的 -selection 标识')
    assert.ok(layer.width > 0 && layer.height > 0)
    assert.equal(layer.borderWidth, 1, `${id} 选中框应使用 1px 细线`)
    assert.equal(layer.radius, '0px', '选中框没有圆角')
    assert.deepEqual(rgb(layer.borderColor).slice(0, 3), rgb(layer.brand).slice(0, 3), '选中框应使用品牌绿色')
    const fill = rgb(layer.background)
    assert.deepEqual(fill.slice(0, 3), rgb(layer.borderColor).slice(0, 3), '淡填充与框线应同色')
    assert.ok(fill[3] >= 0.06 && fill[3] <= 0.1, `填充不透明度应约 8%，实际 ${layer.background}`)
    assert.equal(layer.handles.length, 4, '每个选中框必须恰好有四个控制点')
    for (const corner of ['nw', 'ne', 'se', 'sw']) {
      const handles = layer.handles.filter(handle => handle.classes.includes(corner))
      assert.equal(handles.length, 1, `缺少唯一 ${corner} 控制点`)
      assert.ok(Math.abs(handles[0].left - (corner.endsWith('e') ? layer.innerWidth : 0)) <= 1, `${corner} 控制点应落在真实横向边界`)
      assert.ok(Math.abs(handles[0].top - (corner.startsWith('s') ? layer.innerHeight : 0)) <= 1, `${corner} 控制点应落在真实纵向边界`)
    }
    assert.equal(new Set(layer.handles.map(handle => `${handle.x},${handle.y}`)).size, 4, '控制点不能重叠在一个位置')
    layer.handles.forEach(handle => {
      assert.ok(handle.width >= 3 && handle.width <= 10)
      assert.equal(handle.width, handle.height, '控制点必须是小方形')
      assert.equal(handle.radius, '0px')
      assert.equal(handle.pointer, 'none')
      assert.equal(handle.tabIndex, -1, '控制点不是可聚焦控件')
    })
  })
  assert.ok(layers.some(layer => layer.opacity > 0.1 && layer.borderOpacity > 0.1), `${id} 临时选中框必须实际可见，不能只留 DOM`)
  assert.equal(await page.locator('.assembly-hand, .assembly-pointer, .assembly-size, .assembly-caret').count(), 0, '新动画没有鼠标光标、输入插入点或旧尺寸标签')
  assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith('assembly:') && animation.id.endsWith('-caret')).length), 0, '不能残留输入插入点动画')
}

async function checkTextProgress(page, id, selector, { multiline = false } = {}) {
  const timeline = await page.locator(selector).evaluate((element, id) => {
    const animations = document.getAnimations().filter(animation => animation.id.startsWith(`assembly:${id}:`))
    const text = animations.find(animation => animation.effect.target === element && animation.effect.getKeyframes().some(frame => frame.clipPath))
    if (!text) return { missing: true, ids: animations.map(animation => animation.id) }
    const timing = text.effect.getTiming()
    const unique = [...new Map(text.effect.getKeyframes().filter(frame => frame.clipPath?.startsWith('polygon')).map(frame => [frame.computedOffset, frame])).values()]
    const times = unique.filter((frame, index) => index && frame.computedOffset < 1).map(keyframe => {
      const next = unique.find(frame => frame.computedOffset > keyframe.computedOffset)?.computedOffset ?? 1
      return timing.delay + timing.duration * (keyframe.computedOffset + (next - keyframe.computedOffset) * 0.25)
    })
    return { missing: false, textId: text.id, timing, times }
  }, id)
  assert.equal(timeline.missing, false, `${id} 必须有真实文字 clip 动画: ${JSON.stringify(timeline)}`)
  assert.ok(timeline.times.length >= 3, `${id} 应逐步输入，不能仅淡入最终文字`)
  const states = []
  for (const time of timeline.times) {
    await seek(page, id, time)
    states.push(await page.evaluate(({ textId }) => {
      const text = document.getAnimations().find(animation => animation.id === textId).effect.target
      const clip = getComputedStyle(text).clipPath
      const coordinates = [...clip.matchAll(/([-\d.]+)px ([-\d.]+)px/g)].map(match => match.slice(1).map(Number))
      const textBox = text.getBoundingClientRect()
      const glyphs = []
      const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT)
      const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' })
      const range = document.createRange()
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim() || node.parentElement.closest('svg, .assembly-selection')) continue
        for (const { index, segment } of segmenter.segment(node.textContent)) {
          range.setStart(node, index)
          range.setEnd(node, index + segment.length)
          for (const rect of range.getClientRects()) if (rect.width && rect.height) glyphs.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
        }
      }
      return { clip, edge: coordinates[3], textX: textBox.left, textY: textBox.top, glyphs }
    }, timeline))
  }
  assert.ok(new Set(states.map(state => state.clip)).size > 2, '实际文字裁剪应持续推进')
  states.forEach(state => {
    assert.ok(state.edge, '生成中应保持多行 polygon 裁剪')
    assert.ok(state.glyphs.some(glyph => Math.abs(Math.max(0, glyph.top - state.textY - 4) - state.edge[1]) <= 1 && Math.min(Math.abs(glyph.right + 1 - state.textX - state.edge[0]), Math.abs(glyph.left - state.textX - state.edge[0])) <= 5), '逐字裁剪应贴合真实 DOM 字形位置，而不是仅淡入整块文字')
  })
  if (multiline) {
    assert.ok(new Set(states.map(state => Math.round(state.edge[1]))).size > 1, '必须实际检查换行后的文字生成')
    assert.ok(states.some((state, index) => index && state.edge[1] > states[index - 1].edge[1] + 5 && state.edge[0] < states[index - 1].edge[0]), '换行时应从下一行开头继续生成')
  }
  await seek(page, id, timeline.timing.delay + timeline.timing.duration * 0.45)
  await checkLayers(page, id)
}

async function checkImageStages(page, id) {
  const info = await page.evaluate(id => {
    const animations = document.getAnimations().filter(animation => animation.id.startsWith(`assembly:${id}:`))
    const image = animations.find(animation => animation.effect.target.matches('[data-build~="image"]'))
    const stroke = animations.find(animation => animation.effect.target.closest('.assembly-outline') && animation.effect.getKeyframes().some(frame => frame.strokeDashoffset !== undefined))
    return image && stroke ? { image: image.id, stroke: stroke.id, imageTiming: image.effect.getTiming(), strokeTiming: stroke.effect.getTiming() } : null
  }, id)
  assert.ok(info, `${id} 必须同时生成实际图片和轮廓描边`)
  assert.ok(info.strokeTiming.delay < info.imageTiming.delay, `${id} 应先有轮廓，再出现画面`)
  const read = () => page.evaluate(info => {
    const image = document.getAnimations().find(animation => animation.id === info.image).effect.target
    const stroke = document.getAnimations().find(animation => animation.id === info.stroke).effect.target
    return { clip: getComputedStyle(image).clipPath, dash: parseFloat(getComputedStyle(stroke).strokeDashoffset), length: stroke.getTotalLength(), naturalWidth: image.naturalWidth }
  }, info)
  await seek(page, id, info.strokeTiming.delay + info.strokeTiming.duration * 0.45)
  const early = await read()
  assert.ok(early.dash > 0 && early.dash < early.length, '轮廓必须真实描绘，而不只是切换状态')
  assert.match(early.clip, /100%/, '轮廓阶段尚不展示图片')
  await checkLayers(page, id)
  await seek(page, id, info.imageTiming.delay + info.imageTiming.duration * 0.5)
  const middle = await read()
  assert.notEqual(middle.clip, early.clip)
  assert.match(middle.clip, /50%/, '图片应在生成中期展示半幅真实画面')
  assert.ok(middle.naturalWidth > 0)
  await checkLayers(page, id)
}

async function checkStroke(page, id) {
  const stroke = await page.evaluate(id => {
    const animation = document.getAnimations().find(animation => animation.id.startsWith(`assembly:${id}:`) && animation.effect.target.closest('.assembly-outline') && animation.effect.getKeyframes().some(frame => frame.strokeDashoffset !== undefined))
    return animation ? { id: animation.id, ...animation.effect.getTiming() } : null
  }, id)
  assert.ok(stroke, `${id} 卡片/标签/列表必须有实际轮廓动画`)
  await seek(page, id, stroke.delay + stroke.duration * 0.5)
  const shape = await page.evaluate(id => {
    const element = document.getAnimations().find(animation => animation.id === id).effect.target
    return { dash: parseFloat(getComputedStyle(element).strokeDashoffset), length: element.getTotalLength() }
  }, stroke.id)
  assert.ok(shape.dash > 0 && shape.dash < shape.length, `${id} 的边框应正在绘制`)
  await checkLayers(page, id)
}

export async function checkPageAssembly(browser, base) {
  const open = page => page.goto(base, { waitUntil: 'domcontentloaded' })
  let scenarioNumber = 0
  async function withPage(label, check, options = {}, probeOptions = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', ...options })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await installProbe(page, probeOptions)
    const number = ++scenarioNumber
    try {
      await check(page, context)
      const starts = await page.evaluate(() => window.__assemblyTest?.starts || [])
      for (const start of starts) {
        assert.equal(start.hidden, false, `${start.id} 不应在后台启动`)
        assert.ok(start.rect.bottom > 0 && start.rect.top < start.height && start.rect.right > 0 && start.rect.left < start.width, `${start.id} 必须真正进入视口才启动`)
      }
      assert.deepEqual(errors, [], `${label} 浏览器异常`)
      console.log(`通过：分组生成 / ${label}`)
    } catch (error) {
      await captureScreenshot(page, { path: `artifacts/assembly-failure-${number}.png` }, { force: true }).catch(() => {})
      console.error(`失败：分组生成 / ${label}`)
      console.error(JSON.stringify(await page.locator('[data-assembly-group]').evaluateAll(groups => groups.map(group => ({ id: group.dataset.assemblyGroup, state: group.dataset.assemblyState, reason: group.dataset.assemblyReason, duration: group.dataset.assemblyDuration }))), null, 2))
      throw error
    } finally {
      await context.close()
    }
  }

  await withPage('手机同尺寸 resize 不跳过准备和播放，真实旋转才完成', async page => {
    const pending = []
    let hold = true
    await page.route('**/fonts/**', route => {
      if (hold && route.request().resourceType() === 'font') pending.push(route)
      else return route.continue()
    })
    const dispatchResize = () => page.evaluate(() => {
      window.dispatchEvent(new Event('resize'))
      window.visualViewport?.dispatchEvent(new Event('resize'))
    })
    await open(page)
    await page.locator(`${groupSelector('hero-title')}[data-assembly-state="preparing"]`).waitFor()
    await dispatchResize()
    await frame(page)
    assert.equal(await page.locator(groupSelector('hero-title')).getAttribute('data-assembly-state'), 'preparing', '初始同尺寸 resize 不能跳过准备')
    hold = false
    await Promise.all(pending.map(route => route.continue()))
    await playing(page, 'hero-title')
    await seek(page, 'hero-title', 550)
    await dispatchResize()
    await frame(page)
    assert.equal(await page.locator(groupSelector('hero-title')).getAttribute('data-assembly-state'), 'playing', '播放中的同尺寸 resize 不能结束演出')
    await checkLayers(page, 'hero-title')
    await page.setViewportSize({ width: 812, height: 375 })
    await assertComplete(page, 'hero-title')
    assert.equal(await page.locator(groupSelector('hero-title')).getAttribute('data-assembly-reason'), 'resize')
  }, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  for (const width of [1440, 375]) {
    await withPage(`${width} 导航、手机菜单及页脚分组生成与可操作性`, async page => {
      await open(page)
      await playing(page, 'header-brand')
      await checkTextProgress(page, 'header-brand', `${groupSelector('header-brand')} [data-build="lines"]`)
      await playing(page, 'header-theme')
      await seek(page, 'header-theme', 450)
      await checkLayers(page, 'header-theme')
      const themeButton = page.locator(groupSelector('header-theme'))
      const control = await themeButton.evaluate(element => ({ clip: getComputedStyle(element).clipPath, opacity: getComputedStyle(element).opacity, background: getComputedStyle(element).backgroundColor, label: element.getAttribute('aria-label'), text: element.textContent.trim() }))
      assert.equal(control.clip, 'none', '主题按钮不能被生成动画裁剪')
      assert.equal(control.opacity, '1')
      assert.doesNotMatch(control.background, /rgba\([^)]*,\s*0\)$/)
      assert.match(control.label, /主题：自动/)
      assert.equal(control.text, '', '主题按钮只显示图标')
      await playing(page, 'header-qq')
      await seek(page, 'header-qq', 450)
      await checkLayers(page, 'header-qq')
      const qq = page.locator('.nav-qq')
      assert.ok(await qq.isVisible(), 'QQ 图标在生成期间保持可见')
      assert.equal(await qq.evaluate(element => getComputedStyle(element).clipPath), 'none', 'QQ 按钮不能被生成动画裁剪')
      assert.equal(await qq.evaluate(element => getComputedStyle(element).opacity), '1')
      await captureScreenshot(page, { path: `artifacts/assembly-header-${width}-middle.png` })
      if (width === 375) {
        await playing(page, 'header-menu')
        const menu = page.getByRole('button', { name: '打开导航', exact: true })
        await menu.focus()
        await page.keyboard.press('Enter')
        await page.locator('#mobile-nav').waitFor()
        await assertComplete(page, 'hero-title')
        const ids = ['header-mobile-experience', 'header-mobile-docs']
        for (const id of ids) {
          await playing(page, id)
          await checkTextProgress(page, id, `${groupSelector(id)} [data-build="lines"]`)
          await checkLayers(page, id)
        }
        await captureScreenshot(page, { path: 'artifacts/assembly-mobile-menu-middle.png' })
        for (const id of ids) await complete(page, id)
        const before = await page.evaluate(() => window.__assemblyTest.animations.filter(animation => animation.id.startsWith('assembly:header-mobile-')).length)
        await page.keyboard.press('Escape')
        await page.locator('#mobile-nav').waitFor({ state: 'detached' })
        assert.ok(await menu.evaluate(element => element === document.activeElement))
        await page.keyboard.press('Enter')
        await page.locator('#mobile-nav').waitFor()
        for (const id of ids) await assertComplete(page, id)
        assert.equal(await page.evaluate(() => window.__assemblyTest.animations.filter(animation => animation.id.startsWith('assembly:header-mobile-')).length), before, '同一 Document 内再次展开菜单不能重播')
        await page.locator(groupSelector('header-mobile-docs')).click()
      } else {
        await playing(page, 'header-docs')
        await checkTextProgress(page, 'header-docs', `${groupSelector('header-docs')} [data-build="lines"]`)
        await page.locator(groupSelector('header-docs')).click()
      }
      await page.locator('.prose-docs').waitFor()
      await assertComplete(page, 'header-brand')
      await page.getByRole('link', { name: 'Kira 首页', exact: true }).click()
      await page.locator('.home-page').waitFor()
      await assertComplete(page, 'header-brand')
      // 指南自身可能已经展示过页脚；首次进入的断言从新 Document 的首页开始。
      await page.reload({ waitUntil: 'domcontentloaded' })
      await playing(page, 'hero-title')
      for (const id of ['footer-brand', 'footer-disclaimer', 'footer-colophon-en']) assert.equal(await page.locator(groupSelector(id)).getAttribute('data-assembly-state'), 'waiting', '未见页脚不能随导航或正文提前播放')
      await scrollToGroup(page, 'footer-brand')
      await playing(page, 'footer-brand')
      await checkTextProgress(page, 'footer-brand', `${groupSelector('footer-brand')} [data-build="lines"]`)
      await playing(page, 'footer-rule')
      await checkStroke(page, 'footer-rule')
      await scrollToGroup(page, 'footer-disclaimer')
      await playing(page, 'footer-disclaimer')
      await checkTextProgress(page, 'footer-disclaimer', groupSelector('footer-disclaimer'), { multiline: width === 375 })
      await seek(page, null, 550)
      await captureScreenshot(page, { path: `artifacts/assembly-footer-${width}-middle.png` })
      await completeActive(page)
      await captureScreenshot(page, { path: `artifacts/assembly-footer-${width}-complete.png` })
      const before = await page.evaluate(() => window.__assemblyTest.animations.filter(animation => animation.id.startsWith('assembly:footer-')).length)
      await page.locator(groupSelector('footer-docs')).click()
      await page.locator('.prose-docs').waitFor()
      await page.getByRole('link', { name: 'Kira 首页', exact: true }).click()
      await page.locator('.home-page').waitFor()
      await scrollToGroup(page, 'footer-brand')
      await assertComplete(page, 'footer-brand')
      assert.equal(await page.evaluate(() => window.__assemblyTest.animations.filter(animation => animation.id.startsWith('assembly:footer-')).length), before, '指南往返后已播页脚不能重播')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      // 下载锚点的平滑滚动放在最后，不与页脚逐帧测量争用滚动位置。
      await page.locator('.hero-actions a[href="#download"]').click()
      await page.waitForFunction(() => location.hash === '#download')
    }, { viewport: { width, height: width === 375 ? 812 : 1000 }, isMobile: width === 375, hasTouch: width === 375 })
  }

  for (const [width, height] of [[1440, 1000], [768, 1024], [375, 812]]) {
    await withPage(`${width} 首屏逐字、选中框、几何、刷新重播`, async page => {
      await open(page)
      await playing(page, 'hero-title')
      const selector = '#hero-title, .hero-description, .hero-phone'
      const original = await snapshot(page, selector)
      const initialText = await page.locator('.home-page').textContent()
      assert.equal(await page.locator(groupSelector('faq-01')).getAttribute('data-assembly-state'), 'waiting')
      await checkTextProgress(page, 'hero-title', '#hero-title', { multiline: true })
      await seek(page, null, 680)
      await captureScreenshot(page, { path: `artifacts/assembly-${width}-middle.png` })
      await completeActive(page)
      sameLayout(await snapshot(page, selector), original, `${width} 完成态`)
      assert.equal(await page.locator('.home-page').textContent(), initialText, '全部临时层不应增删页面文案')
      await captureScreenshot(page, { path: `artifacts/assembly-${width}-complete.png` })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '生成动画不能引入横向溢出')

      const staticContext = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', isMobile: width < 768, hasTouch: width < 768 })
      try {
        const staticPage = await staticContext.newPage()
        await gotoReady(staticPage, base)
        sameLayout(await snapshot(page, selector), await snapshot(staticPage, selector), `${width} 与无动画布局一致`)
      } finally { await staticContext.close() }
      await page.reload({ waitUntil: 'domcontentloaded' })
      await playing(page, 'hero-title')
      await seek(page, 'hero-title', 550)
      await checkLayers(page, 'hero-title')
      assert.ok(await page.evaluate(() => window.__assemblyTest.animations.some(animation => animation.id.startsWith('assembly:hero-title:'))), '完整刷新必须创建新一轮真实动画')
      await completeActive(page)
    }, { viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768 })
  }

  for (const width of [1440, 375]) {
    for (const section of ['comic', 'reading-flow', 'flow-notes', 'wide', 'novel', 'download', 'faq']) {
      await withPage(`${width} 下方 ${section} 独立生成`, async page => {
        await open(page)
        await playing(page, 'hero-title')
        await completeActive(page)
        const ids = { comic: ['comic-detail', 'comic-bookshelf'], 'reading-flow': ['bookmarks-shot', 'comments-shot'], 'flow-notes': ['flow-01-heading', 'flow-02-heading', 'flow-03-heading', 'flow-04-heading'], wide: ['wide-stack'], novel: ['novel-tags', 'novel-library'], download: ['download-frame', 'download-description'], faq: ['faq-01', 'faq-02'] }[section]
        for (const id of ids) assert.equal(await page.locator(groupSelector(id)).getAttribute('data-assembly-state'), 'waiting', `${id} 未见时不得提前完成`)
        for (const id of ids) {
          await scrollToGroup(page, id)
          await playing(page, id)
          const original = await snapshot(page, `${groupSelector(id)}, ${groupSelector(id)} [data-build]`)
          if (id.startsWith('comic-') || id.endsWith('-shot') || id === 'wide-stack' || id === 'novel-library') await checkImageStages(page, id)
          else if (id === 'download-description') await checkTextProgress(page, id, '.platform-description p', { multiline: true })
          else {
            await checkStroke(page, id)
            if (id.startsWith('flow-')) await checkTextProgress(page, id, `${groupSelector(id)} h3`)
          }
          if (id === 'wide-stack') {
            assert.equal(await page.locator('.screenshot-study').getAttribute('data-rotation'), 'paused', '宽屏截图生成时不能自动轮换')
            assert.equal(await page.locator('.stack-shot').count(), 2)
          }
          await captureScreenshot(page, { path: `artifacts/assembly-${width}-${id}-middle.png` })
          await complete(page, id)
          sameLayout(await snapshot(page, `${groupSelector(id)}, ${groupSelector(id)} [data-build]`), original, `${width} ${id}`)
          await captureScreenshot(page, { path: `artifacts/assembly-${width}-${id}-complete.png` })
        }
        if (section === 'download') {
          await page.locator('input[value="windows"]').focus()
          await page.keyboard.press('Space')
          assert.match(await page.locator('.platform-description').innerText(), /大一点的屏幕/)
          assert.equal(await page.locator('.platform-description [data-assembly-concealed]').count(), 0)
          assert.match(await page.locator('.download-cta').getAttribute('href'), /github\.com\/caolib\/kira\/releases/)
        }
        if (section === 'faq') {
          await page.locator('.faq-list summary').first().focus()
          await page.keyboard.press('Enter')
          assert.equal(await page.locator('.faq-list details[open]').count(), 1)
          await page.keyboard.press('Space')
          assert.equal(await page.locator('.faq-list details[open]').count(), 0)
        }
      }, { viewport: { width, height: width === 375 ? 812 : 1000 }, hasTouch: width === 375, isMobile: width === 375 })
    }
  }

  for (const width of [1440, 375]) {
    await withPage(`${width} 只向下分步滚动即可生成小说标题和段落`, async page => {
      await open(page)
      await playing(page, 'hero-title')
      await completeActive(page)
      for (const id of ['novel-heading', 'novel-description']) {
        const initial = await page.locator(groupSelector(id)).evaluate(element => ({ state: element.dataset.assemblyState, clip: getComputedStyle(element).clipPath, opacity: getComputedStyle(element).opacity }))
        assert.deepEqual(initial, { state: 'waiting', clip: 'none', opacity: '0' }, '直接作为观察目标的待播文字必须保留完整相交几何')
        const edge = await page.locator(groupSelector(id)).evaluate(element => {
          const before = scrollY
          window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight + 1, behavior: 'instant' })
          return { before, after: scrollY, visiblePixels: innerHeight - element.getBoundingClientRect().top }
        })
        assert.ok(edge.after >= edge.before, '仅向下接近文字，不得上滚补触发')
        assert.ok(Math.abs(edge.visiblePixels - 1) <= 1, '从视口底边只露出 1px 的位置开始')
        await frame(page)
        assert.equal(await page.locator(groupSelector(id)).getAttribute('data-assembly-state'), 'waiting')
        let reached = false
        let previousY = edge.after
        for (let step = 0; step < 30; step++) {
          await page.mouse.wheel(0, 10)
          await frame(page)
          const visible = await page.locator(groupSelector(id)).evaluate(element => {
            const top = document.querySelector('.site-header').getBoundingClientRect().bottom + 8
            const bottom = innerHeight - 24
            const rect = element.getBoundingClientRect()
            const required = Math.min(48, rect.height * 0.25, (bottom - top) * 0.25)
            return { scrollY, reached: Math.min(rect.bottom, bottom) - Math.max(rect.top, top) >= required }
          })
          assert.ok(visible.scrollY >= previousY, '每一步只允许下滑10px，不能回滚补触发')
          previousY = visible.scrollY
          if (!visible.reached) continue
          reached = true
          await playing(page, id)
          await checkTextProgress(page, id, groupSelector(id), { multiline: true })
          await captureScreenshot(page, { path: `artifacts/assembly-${width}-${id}-downscroll-middle.png` })
          await complete(page, id)
          const final = await page.locator(groupSelector(id)).evaluate(element => ({ clip: getComputedStyle(element).clipPath, opacity: getComputedStyle(element).opacity }))
          assert.deepEqual(final, { clip: 'none', opacity: '1' }, '完成后小说文字必须完全显示')
          break
        }
        assert.equal(reached, true, `${id} 应在下滑300px以内到达可见阈值并播放`)
      }
      const before = await page.evaluate(() => window.__assemblyTest.animations.filter(animation => /assembly:novel-(heading|description):/.test(animation.id)).length)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await frame(page)
      await scrollToGroup(page, 'novel-heading')
      for (const id of ['novel-heading', 'novel-description']) await assertComplete(page, id)
      assert.equal(await page.evaluate(() => window.__assemblyTest.animations.filter(animation => /assembly:novel-(heading|description):/.test(animation.id)).length), before, '离开再回来不能重播已生成文字')
    }, { viewport: { width, height: width === 375 ? 812 : 1000 }, isMobile: width === 375, hasTouch: width === 375 })
  }

  await withPage('手机下方段落首次真实进入视口才播放', async page => {
    await open(page)
    await playing(page, 'hero-title')
    await completeActive(page)
    const id = 'note-03-body'
    await page.locator(groupSelector(id)).evaluate(element => {
      window.scrollTo({ top: scrollY + element.getBoundingClientRect().top - innerHeight - 12, behavior: 'instant' })
    })
    await frame(page)
    assert.equal(await page.locator(groupSelector(id)).getAttribute('data-assembly-state'), 'waiting', '同一阅读卡片的下方段落尚未可见，不能跟随标题提前播完')
    assert.equal(await page.evaluate(id => window.__assemblyTest.starts.some(start => start.id === id), id), false)
    await scrollToGroup(page, id)
    await playing(page, id)
    await checkTextProgress(page, id, groupSelector(id), { multiline: true })
    await complete(page, id)
    const count = await page.evaluate(id => window.__assemblyTest.animations.filter(animation => animation.id.startsWith(`assembly:${id}:`)).length, id)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await frame(page)
    await scrollToGroup(page, id)
    assert.equal(await page.locator(groupSelector(id)).getAttribute('data-assembly-state'), 'complete')
    assert.equal(await page.evaluate(id => window.__assemblyTest.animations.filter(animation => animation.id.startsWith(`assembly:${id}:`)).length, id), count, '滚回已播组不新增动画')
  }, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  for (const width of [1440, 375]) {
    await withPage(`${width} 指南返回保留已播记录、未见组可播`, async page => {
      await open(page)
      await playing(page, 'hero-title')
      await completeActive(page)
      const before = await page.evaluate(() => window.__assemblyTest.animations.filter(animation => animation.id.startsWith('assembly:hero-title:')).length)
      assert.equal(await page.locator(groupSelector('wide-stack')).getAttribute('data-assembly-state'), 'waiting')
      if (width < 768) {
        await page.getByRole('button', { name: '打开导航', exact: true }).click()
        await page.locator('#mobile-nav').getByRole('link', { name: /使用指南/ }).click()
      } else await page.locator('.desktop-nav').getByRole('link', { name: '使用指南', exact: true }).click()
      await page.locator('.prose-docs').waitFor()
      assert.equal(await page.locator('.assembly-selection, .assembly-outline').count(), 0, '卸载首页必须删除所有演出层')
      assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith('assembly:')).length), 0)
      await page.getByRole('link', { name: 'Kira 首页', exact: true }).click()
      await page.locator(groupSelector('hero-title')).waitFor()
      assert.equal(await page.locator(groupSelector('hero-title')).getAttribute('data-assembly-state'), 'complete')
      assert.equal(await page.evaluate(() => window.__assemblyTest.animations.filter(animation => animation.id.startsWith('assembly:hero-title:')).length), before, '指南往返不能创建已播标题动画')
      assert.equal(await page.locator(groupSelector('wide-stack')).getAttribute('data-assembly-state'), 'waiting')
      await scrollToGroup(page, 'wide-stack')
      await playing(page, 'wide-stack')
      await checkImageStages(page, 'wide-stack')
      await complete(page, 'wide-stack')
    }, { viewport: { width, height: width === 375 ? 812 : 1000 }, isMobile: width === 375, hasTouch: width === 375 })
  }

  for (const storage of ['old-marker', 'disabled']) {
    await withPage(`${storage} 不影响播放与刷新`, async page => {
      await page.addInitScript(storage => {
        if (storage === 'old-marker') sessionStorage.setItem('kira:hero-assembly:v1', '1')
        else for (const property of ['sessionStorage', 'localStorage']) Object.defineProperty(window, property, {
          configurable: true, get() { throw new DOMException('Storage disabled', 'SecurityError') },
        })
      }, storage)
      await open(page)
      await playing(page, 'hero-title')
      await checkTextProgress(page, 'hero-title', '#hero-title', { multiline: true })
      await completeActive(page)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await playing(page, 'hero-title')
      await completeActive(page)
    })
  }

  for (const interaction of ['pointer', 'keyboard']) {
    await withPage(`${interaction} 生成中打开预览、清理及焦点恢复`, async page => {
      await open(page)
      await playing(page, 'hero-discover')
      await seek(page, 'hero-discover', 550)
      await checkLayers(page, 'hero-discover')
      const button = page.getByRole('button', { name: '放大查看：漫画首页', exact: true })
      if (interaction === 'pointer') await button.click()
      else { await button.focus(); await page.keyboard.press('Enter') }
      await page.locator('dialog[open]').waitFor()
      await assertComplete(page, 'hero-discover')
      await page.locator('.image-preview-image').evaluate(image => image.decode())
      await page.keyboard.press('Escape')
      await page.locator('dialog[open]').waitFor({ state: 'hidden' })
      assert.ok(await button.evaluate(element => element === document.activeElement), '中断生成后预览应恢复焦点')
    })
  }

  for (const interruption of ['download', 'resize', 'background', 'fast-scroll', 'pagehide', 'reduced-motion', 'cancel']) {
    await withPage(`${interruption} 中断清理且保留未见组`, async page => {
      await open(page)
      await playing(page, 'hero-title')
      await seek(page, 'hero-title', 550)
      await checkLayers(page, 'hero-title')
      const active = await page.locator('[data-assembly-state="playing"], [data-assembly-state="preparing"]').evaluateAll(groups => groups.map(group => group.dataset.assemblyGroup))
      if (interruption === 'download') await page.locator('.hero-actions .button').click()
      else if (interruption === 'resize') await page.setViewportSize({ width: 812, height: 375 })
      else if (interruption === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' })
      else if (interruption === 'fast-scroll') await scrollToGroup(page, 'wide-stack')
      else if (interruption === 'pagehide') await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
      else if (interruption === 'cancel') await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith('assembly:')).forEach(animation => animation.cancel()))
      else await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      for (const id of active) await assertComplete(page, id)
      if (interruption === 'fast-scroll') assert.ok(await page.locator('.site-header').evaluate(element => element.classList.contains('is-hidden')), '下滚隐藏导航前应完成其生成动画')
      if (interruption === 'reduced-motion') {
        assert.equal(await page.locator('[data-assembly-state]:not([data-assembly-state="complete"])').count(), 0)
        assert.equal(await page.locator('.assembly-selection, [data-assembly-concealed]').count(), 0)
      } else assert.equal(await page.locator(groupSelector('faq-01')).getAttribute('data-assembly-state'), 'waiting', '中断当前动画不能标记未见小组已播')
      if (interruption === 'background') await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await frame(page)
      assert.equal(await page.locator(groupSelector('hero-title')).getAttribute('data-assembly-state'), 'complete')
    })
  }

  await withPage('减少动态效果直接呈现完整静态页面', async page => {
    await open(page)
    await page.locator(groupSelector('hero-title')).waitFor()
    assert.equal(await page.locator('[data-assembly-state]:not([data-assembly-state="complete"])').count(), 0)
    assert.equal(await page.locator('.assembly-selection, .assembly-outline, [data-assembly-concealed]').count(), 0)
    assert.equal(await page.evaluate(() => window.__assemblyTest.animations.length), 0)
    assert.equal(await page.locator('#hero-title').evaluate(element => getComputedStyle(element).clipPath), 'none')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await scrollToGroup(page, 'novel-library')
    assert.equal(await page.evaluate(() => window.__assemblyTest.animations.length), 0)
  }, { reducedMotion: 'reduce' })

  for (const layout of ['landscape', 'text-200']) {
    await withPage(`${layout} 不删减文字输入和图像生成`, async page => {
      await open(page)
      await scrollToGroup(page, 'hero-title')
      await playing(page, 'hero-title')
      await checkTextProgress(page, 'hero-title', '#hero-title', { multiline: true })
      await captureScreenshot(page, { path: `artifacts/assembly-${layout}-middle.png` })
      await completeActive(page)
      await scrollToGroup(page, 'novel-library')
      await playing(page, 'novel-library')
      await checkImageStages(page, 'novel-library')
      await complete(page, 'novel-library')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    }, { viewport: layout === 'landscape' ? { width: 812, height: 375 } : { width: 375, height: 812 }, isMobile: true, hasTouch: true }, { fontScale: layout === 'text-200' })
  }

  for (const scenario of ['timeout', 'unmount']) {
    await withPage(`慢字体 ${scenario} 不遗留异步动画`, async page => {
      const pending = []
      let hold = true
      await page.route('**/fonts/**', route => {
        if (hold && route.request().resourceType() === 'font') pending.push(route)
        else return route.continue()
      })
      await open(page)
      await page.locator(`${groupSelector('hero-title')}[data-assembly-state="preparing"]`).waitFor()
      if (scenario === 'unmount') {
        await page.locator('.desktop-nav').getByRole('link', { name: '使用指南', exact: true }).click()
        await page.locator('.prose-docs').waitFor()
      } else {
        await page.locator(`${groupSelector('hero-title')}[data-assembly-state="complete"]`).waitFor()
        assert.equal(await page.locator(groupSelector('hero-title')).getAttribute('data-assembly-reason'), 'resources-timeout')
      }
      assert.ok(pending.length > 0, '慢字体测试必须实际拦截字体请求')
      hold = false
      await Promise.all(pending.map(route => route.continue()))
      await page.evaluate(() => document.fonts.ready)
      await frame(page)
      assert.equal(await page.locator('.assembly-selection, .assembly-outline').count(), 0)
      assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith('assembly:')).length), 0, '字体迟到不能复活已结束或已卸载的动画')
      if (scenario === 'unmount') await page.getByRole('link', { name: 'Kira 首页', exact: true }).click()
      await page.locator(`${groupSelector('hero-title')}[data-assembly-state="complete"]`).waitFor()
      assert.equal(await page.locator(groupSelector('faq-01')).getAttribute('data-assembly-state'), 'waiting')
      await scrollToGroup(page, 'faq-01')
      await playing(page, 'faq-01')
      await checkStroke(page, 'faq-01')
      await complete(page, 'faq-01')
    })
  }

  await withPage('正常时钟自然结束后清理全部临时层', async page => {
    await open(page)
    await page.locator(`${groupSelector('hero-title')}[data-assembly-state="complete"]`).waitFor()
    assert.ok(await page.evaluate(() => window.__assemblyTest.animations.some(animation => animation.id.startsWith('assembly:hero-title:'))))
    await page.waitForFunction(() => !document.querySelector('[data-assembly-state="playing"], [data-assembly-state="preparing"]'))
    assert.equal(await page.locator('.assembly-selection, .assembly-outline').count(), 0)
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith('assembly:')).length), 0)
    assert.equal(await page.locator('.assembly-positioned').count(), 0, '全部可见组结束后必须释放共享定位引用')
    assert.ok(await page.evaluate(() => window.__assemblyTest.animations.every(animation => animation.playState === 'idle')), '自然完成后包括填充动画在内的对象都应取消')
  }, {}, { pause: false })
}
