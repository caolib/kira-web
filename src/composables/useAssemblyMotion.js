import { onBeforeUnmount, onMounted, ref } from 'vue'
import { claimGroupPlayback, hasGroupPlayback, lineClipFrames, strokeFrames } from '@/utils/assemblyMotion'

const groupSelector = '[data-assembly-group]'
const interactive = 'a, button, input, select, textarea, summary, [contenteditable]'
const svgNS = 'http://www.w3.org/2000/svg'
const positions = new WeakMap()

// 每个区域共用一个观察器，页头、正文、页脚共享定位租约。
export function useAssemblyMotion(root, { belowHeader = true } = {}) {
  const wideBuilding = ref(true)
  const completedGroups = ref(new Set())
  const groups = new Map()
  let observer
  let events
  let preference
  let disposed = false

  function ownParts(element) {
    return [element, ...element.querySelectorAll('[data-build]')]
      .filter(part => part.hasAttribute('data-build') && part.closest(groupSelector) === element)
      .flatMap(element => element.dataset.build.split(' ').map(kind => ({ element, kind })))
  }

  function conceal(group, enabled) {
    for (const { element, kind } of group.parts) {
      if (['type', 'lines', 'image', 'draw'].includes(kind)) {
        // 控件和它们的祖先绝不裁剪；控件内部的图片仍可以构建。
        if (element.matches(interactive) || element.querySelector(interactive)) continue
        element.toggleAttribute('data-assembly-concealed', enabled)
      } else if (kind === 'frame' || kind === 'rule') {
        if (enabled) { element.classList.add('assembly-working'); group.working.add(element) }
        element.classList.toggle(`assembly-${kind}-pending`, enabled)
      } else if (kind === 'slots') {
        for (const label of element.children) {
          if (enabled) { label.classList.add('assembly-working'); group.working.add(label) }
          label.classList.toggle('assembly-label-pending', enabled)
        }
      }
    }
  }

  function setState(group, state, reason) {
    group.state = state
    group.element.dataset.assemblyState = state
    if (reason) group.element.dataset.assemblyReason = reason
    if (state === 'complete') completedGroups.value.add(group.id)
    if (group.id === 'wide-stack' && state === 'complete') wideBuilding.value = false
  }

  function releaseIfComplete() {
    if ([...groups.values()].some(group => group.state !== 'complete')) return
    observer?.disconnect()
    events?.abort()
  }

  function position(group, element) {
    if (group.positioned.has(element)) return
    if (positions.has(element)) positions.set(element, positions.get(element) + 1)
    else if (getComputedStyle(element).position === 'static') {
      element.classList.add('assembly-positioned')
      positions.set(element, 1)
    } else return
    group.positioned.add(element)
  }

  function releasePosition(element) {
    const remaining = positions.get(element) - 1
    if (remaining) positions.set(element, remaining)
    else {
      positions.delete(element)
      element.classList.remove('assembly-positioned')
    }
  }

  function finish(group, reason = 'finished') {
    if (!group || group.state === 'complete') return
    setState(group, 'complete', reason)
    clearTimeout(group.timer)
    group.animations.forEach(animation => animation.cancel())
    group.animations.length = 0
    group.overlays.forEach(element => element.remove())
    group.overlays.length = 0
    group.positioned.forEach(releasePosition)
    group.positioned.clear()
    conceal(group, false)
    group.working.forEach(element => element.classList.remove('assembly-working'))
    observer?.unobserve(group.anchor)
    releaseIfComplete()
  }

  function finishActive(reason) {
    groups.forEach(group => {
      if (group.state === 'playing' || group.state === 'preparing') finish(group, reason)
    })
  }

  function inViewport(element) {
    const box = element.getBoundingClientRect()
    const header = belowHeader ? document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0 : 0
    const top = Math.max(0, header) + 8
    const bottom = window.innerHeight - 24
    const required = Math.min(48, box.height * 0.25, (bottom - top) * 0.25)
    return box.width > 0 && box.height > 0 && box.right > 0 && box.left < window.innerWidth &&
      Math.min(box.bottom, bottom) - Math.max(box.top, top) >= required
  }

  // 动态内容更新前可同步完成所在组；不可见的小组不因此失去演出资格。
  function finishGroup(id, reason = 'interaction') {
    const group = groups.get(id)
    if (!group || group.state === 'complete') return
    if (group.state === 'waiting') {
      if (!inViewport(group.anchor)) return
      claimGroupPlayback(document, id)
    }
    finish(group, reason)
  }

  function animate(group, element, frames, duration, delay, part) {
    if (!frames.length) return
    const animation = element.animate(frames, { duration, delay, fill: 'both', easing: 'linear' })
    animation.id = `assembly:${group.id}:${part}`
    animation.startTime = group.clock
    animation.finished.catch(() => {})
    group.animations.push(animation)
    group.duration = Math.max(group.duration, delay + duration)
    return animation
  }

  function measureLines(element, typed) {
    const bounds = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const lines = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    const segmenter = typed && typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('svg')) continue
      const segments = typed
        ? (segmenter ? [...segmenter.segment(node.textContent)] : Array.from(node.textContent).map((segment, index, characters) => ({ segment, index: characters.slice(0, index).join('').length })))
        : [{ index: 0, segment: node.textContent }]
      for (const { index, segment } of segments) {
        range.setStart(node, index)
        range.setEnd(node, index + segment.length)
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height) continue
          const top = rect.top - bounds.top
          let line = lines.find(line => Math.abs(line.top - top) < 5)
          if (!line) {
            line = { top, bottom: rect.bottom - bounds.top, left: rect.left - bounds.left, right: 0, ends: [] }
            lines.push(line)
          }
          line.left = Math.min(line.left, rect.left - bounds.left)
          line.right = Math.max(line.right, rect.right - bounds.left)
          line.bottom = Math.max(line.bottom, rect.bottom - bounds.top)
          line.ends.push(rect.right - bounds.left)
        }
      }
    }
    range.detach()
    lines.sort((a, b) => a.top - b.top)
    lines.forEach(line => line.ends.sort((a, b) => a - b))
    return { lines, width: parseFloat(style.width) || bounds.width, height: parseFloat(style.height) || bounds.height }
  }

  function measureText(element) {
    if (!element.closest('.reading-note')) return measureLines(element, true)
    // 旋转便签只借用一个不可见测量副本，避免把旋转包围盒误当成本地字形坐标。
    const style = getComputedStyle(element)
    const copy = element.cloneNode(true)
    copy.setAttribute('aria-hidden', 'true')
    Object.assign(copy.style, { position: 'fixed', left: '-10000px', top: '0', display: 'block', visibility: 'hidden', transform: 'none', width: style.width, padding: '0', border: '0', margin: '0' })
    for (const name of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'whiteSpace', 'textAlign']) copy.style[name] = style[name]
    document.body.append(copy)
    try { return measureLines(copy, true) }
    finally { copy.remove() }
  }

  function selectionFrame(group, element, delay, duration, part) {
    const parent = element.offsetParent || element.parentElement
    position(group, parent)
    const style = getComputedStyle(element)
    const layer = document.createElement('span')
    layer.className = 'assembly-selection'
    layer.dataset.assemblyOwner = group.id
    layer.dataset.assemblyPart = part
    layer.setAttribute('aria-hidden', 'true')
    Object.assign(layer.style, {
      left: `${element.offsetLeft}px`, top: `${element.offsetTop}px`,
      width: `${parseFloat(style.width) || element.offsetWidth}px`,
      height: `${parseFloat(style.height) || element.offsetHeight}px`,
      transform: style.transform, transformOrigin: style.transformOrigin,
      translate: style.translate, rotate: style.rotate, scale: style.scale,
    })
    const border = document.createElement('span')
    border.className = 'assembly-selection-box'
    for (const corner of ['nw', 'ne', 'se', 'sw']) {
      const handle = document.createElement('span')
      handle.className = `assembly-selection-handle ${corner}`
      border.append(handle)
    }
    layer.append(border)
    parent.append(layer)
    group.overlays.push(layer)
    const lead = Math.min(70, delay)
    const length = lead + duration + 180
    animate(group, layer, [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 70 / length },
      { opacity: 1, offset: (lead + duration) / length },
      { opacity: 0, offset: 1 },
    ], length, delay - lead, `${part}-selection`)
    return layer
  }

  function text(group, element, headline, delay, part) {
    if (element.matches(interactive) || element.querySelector(interactive)) return
    const measured = measureText(element)
    const frames = lineClipFrames(measured.lines, measured.width, measured.height, true)
    if (!frames.length) return
    const duration = headline ? 1450 : Math.min(1500, 620 + measured.lines.length * 180)
    animate(group, element, frames, duration, delay, part)
    selectionFrame(group, element, delay, duration, part)
  }

  function outline(group, element, rule, delay, part) {
    const style = getComputedStyle(element)
    const width = parseFloat(style.width)
    const height = parseFloat(style.height)
    if (!width || !height) return
    position(group, element)
    // SVG 在元素自己的坐标系内，圆角、旋转、缩放都由浏览器共同变换。
    const svg = document.createElementNS(svgNS, 'svg')
    svg.classList.add('assembly-outline')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('focusable', 'false')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    Object.assign(svg.style, { left: `${-parseFloat(style.borderLeftWidth)}px`, top: `${-parseFloat(style.borderTopWidth)}px`, width: `${width}px`, height: `${height}px` })
    const sides = ['Top', 'Right', 'Bottom', 'Left']
    const borders = sides.map(side => ({ side, width: parseFloat(style[`border${side}Width`]), color: style[`border${side}Color`] }))
    const uniform = !rule && borders.every(border => border.width === borders[0].width && border.color === borders[0].color)
    const paths = []
    if (uniform && borders[0].width) {
      const stroke = borders[0].width
      const rect = document.createElementNS(svgNS, 'rect')
      const radius = Math.max(0, parseFloat(style.borderTopLeftRadius) - stroke / 2)
      for (const [name, value] of Object.entries({ x: stroke / 2, y: stroke / 2, width: width - stroke, height: height - stroke, rx: radius, fill: 'none', stroke: borders[0].color, 'stroke-width': stroke })) rect.setAttribute(name, value)
      paths.push(rect)
    } else {
      borders.filter(border => border.width).forEach(border => {
        const half = border.width / 2
        const points = { Top: [0, half, width, half], Right: [width - half, 0, width - half, height], Bottom: [0, height - half, width, height - half], Left: [half, 0, half, height] }[border.side]
        const line = document.createElementNS(svgNS, 'line')
        for (const [index, name] of ['x1', 'y1', 'x2', 'y2'].entries()) line.setAttribute(name, points[index])
        line.setAttribute('stroke', border.color)
        line.setAttribute('stroke-width', border.width)
        paths.push(line)
      })
    }
    paths.forEach(path => svg.append(path))
    element.append(svg)
    group.overlays.push(svg)
    const duration = rule ? 560 : 440
    paths.forEach((path, index) => animate(group, path, strokeFrames(path.getTotalLength()), duration, delay, `${part}-stroke-${index}`))
    // 原边框始终占据布局；描绘完成后交还原样式，不改变按钮命中区。
    animate(group, element, [{ borderColor: 'transparent' }, { borderColor: 'transparent' }, { borderColor: style.borderColor }], duration, delay, `${part}-border`)
    if (!rule) animate(group, element, [{ backgroundColor: 'transparent', boxShadow: 'none' }, { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow }], 500, delay + 360, `${part}-paper`)
    animate(group, svg, [{ opacity: 1 }, { opacity: 0 }], 180, delay + duration + 40, `${part}-handoff`)
  }

  function play(group) {
    conceal(group, false)
    group.clock = document.timeline.currentTime
    group.duration = 0
    setState(group, 'playing')
    const framed = []
    group.parts.forEach(({ element, kind }, index) => {
      const part = element.dataset.buildPart || `${kind}-${index}`
      const delay = Number(element.dataset.buildDelay || 0)
      if (kind === 'frame' || kind === 'rule') {
        outline(group, element, kind === 'rule', delay, part)
        framed.push({ element, delay, part })
      } else if (kind === 'highlight') {
        framed.push({ element, delay, part, duration: 850 })
      } else if (kind === 'lines' || kind === 'type') text(group, element, kind === 'type', delay + 90, part)
      else if (kind === 'image') {
        const frameStyle = getComputedStyle(element.parentElement)
        const radius = Math.max(0, parseFloat(frameStyle.borderTopLeftRadius) - parseFloat(frameStyle.borderTopWidth))
        animate(group, element, [
          { clipPath: `inset(0 0 100% 0 round ${radius}px)` },
          { clipPath: `inset(0 0 0% 0 round ${radius}px)` },
        ], 760, delay + 360, part)
      } else if (kind === 'draw') {
        element.querySelectorAll('path, line, polyline, circle, rect').forEach((path, index) => {
          animate(group, path, strokeFrames(path.getTotalLength()), 360, delay + index * 100, `${part}-${index}`)
        })
      } else if (kind === 'slots') {
        for (const [index, label] of [...element.children].entries()) {
          outline(group, label, false, delay + index * 150, `${part}-${index}`)
          framed.push({ element: label, delay: delay + index * 150, part: `${part}-${index}` })
          animate(group, label, [{ color: 'transparent' }, { color: getComputedStyle(label).color }], 260, delay + 420 + index * 150, `${part}-${index}-label`)
        }
      }
    })
    const builtAt = group.duration
    framed.forEach(({ element, delay, part, duration }) => selectionFrame(group, element, delay, duration ?? Math.max(120, builtAt - delay), part))
    group.element.dataset.assemblyDuration = String(group.duration)
    if (!group.animations.length) return finish(group, 'empty')
    Promise.all(group.animations.map(animation => animation.finished)).then(() => finish(group), () => finish(group, 'cancelled'))
  }

  async function prepare(group) {
    if (disposed || group.state !== 'waiting' || document.hidden || !inViewport(group.anchor)) return
    if (!claimGroupPlayback(document, group.id)) return finish(group, 'already-played')
    setState(group, 'preparing')
    group.timer = window.setTimeout(() => finish(group, 'resources-timeout'), 900)
    try {
      // 只 decode 当前可见小组里的图片，不触发页面下方懒加载资源。
      const images = group.parts.filter(part => part.kind === 'image').map(part => part.element)
      await Promise.all([document.fonts.ready, ...images.map(image => {
        // Chromium 会延后完全被裁剪的 lazy 图片；仅进入视口后才解除这张图的延后加载。
        if (image.loading === 'lazy') image.loading = 'eager'
        return image.decode()
      })])
      if (disposed || group.state !== 'preparing') return
      clearTimeout(group.timer)
      if (!inViewport(group.anchor) || document.hidden) return finish(group, 'offscreen')
      play(group)
    } catch {
      finish(group, 'resources-unavailable')
    }
  }

  function observe() {
    observer?.disconnect()
    if (disposed || !events || events.signal.aborted) return
    const header = belowHeader ? Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0) : 0
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const group = [...groups.values()].find(group => group.anchor === entry.target)
        if (!group || group.state === 'complete') continue
        if (entry.isIntersecting && inViewport(group.anchor)) prepare(group)
        else if (!entry.isIntersecting && group.state !== 'waiting') finish(group, 'offscreen')
      }
    }, { rootMargin: `-${header + 8}px 0px -24px 0px`, threshold: [0, 0.05, 0.15, 0.25, 0.5, 1] })
    groups.forEach(group => {
      if (group.state !== 'complete') observer.observe(group.anchor)
    })
  }

  function initialize() {
    if (disposed) return
    observer?.disconnect()
    events?.abort()
    groups.forEach(group => finish(group, 'refresh'))
    groups.clear()
    completedGroups.value.clear()
    wideBuilding.value = true
    const element = root.value
    if (!element) return
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const capable = Boolean(element.animate && window.IntersectionObserver && document.fonts &&
      window.CSS?.supports('clip-path', 'inset(0)') && window.SVGGeometryElement &&
      typeof SVGGeometryElement.prototype.getTotalLength === 'function' && typeof HTMLImageElement.prototype.decode === 'function')
    element.querySelectorAll(groupSelector).forEach(element => {
      const id = element.dataset.assemblyGroup
      const anchor = [...element.querySelectorAll('[data-assembly-anchor]')].find(anchor => anchor.closest(groupSelector) === element) || element
      const group = { id, element, anchor, parts: ownParts(element), animations: [], overlays: [], positioned: new Set(), working: new Set(), state: 'waiting' }
      groups.set(id, group)
      if (hasGroupPlayback(document, id) || !capable || preference.matches) setState(group, 'complete', hasGroupPlayback(document, id) ? 'already-played' : 'static')
      else {
        setState(group, 'waiting')
        conceal(group, true)
      }
    })
    if (!capable || preference.matches) { wideBuilding.value = false; return }
    events = new AbortController()
    const options = { signal: events.signal }
    const interaction = event => {
      finishActive('interaction')
      const target = event.target.closest?.(groupSelector)
      if (target) finishGroup(target.dataset.assemblyGroup)
    }
    document.addEventListener('pointerdown', interaction, { ...options, capture: true, passive: true })
    document.addEventListener('focusin', interaction, { ...options, capture: true })
    document.addEventListener('click', interaction, { ...options, capture: true })
    document.addEventListener('beforematch', interaction, { ...options, capture: true })
    preference.addEventListener('change', () => {
      if (!preference.matches) return
      finishActive('reduced-motion')
      // 尚未见过的组只在本次挂载中静态显示，不写入 Document 的播放记录。
      groups.forEach(group => finish(group, 'reduced-motion'))
    }, options)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) finishActive('background')
      else { observe(); groups.forEach(prepare) }
    }, options)
    window.addEventListener('pagehide', () => finishActive('pagehide'), options)
    let viewportWidth = window.innerWidth
    let viewportHeight = window.innerHeight
    const resize = () => {
      if (viewportWidth === window.innerWidth && viewportHeight === window.innerHeight) return
      viewportWidth = window.innerWidth
      viewportHeight = window.innerHeight
      // 手机初始化也会发出视口事件；尚未测量的组继续按最新布局准备。
      groups.forEach(group => { if (group.state === 'playing') finish(group, 'resize') })
      observe()
    }
    window.addEventListener('resize', resize, options)
    window.visualViewport?.addEventListener('resize', resize, options)
    observe()
    // 同步领取首屏，避免首帧已显示完整文字后才被观察器收起。
    groups.forEach(prepare)
    releaseIfComplete()
  }

  onMounted(initialize)

  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    events?.abort()
    groups.forEach(group => finish(group, 'unmount'))
  })

  return { wideBuilding, completedGroups, finishGroup, refresh: initialize }
}
