import { onUnmounted, shallowRef } from 'vue'
import * as THREE from 'three'
import {
  createPhoneMesh,
  createRoundedRectGeometry,
  disposeObject,
  DEFAULT_RADIUS,
} from '@/lib/phoneMesh'

/**
 * 圆柱滚筒式手机墙：所有截图围成一圈，可拖拽旋转，带惯性与吸附。
 */
export function usePhoneScene(options = {}) {
  const {
    enableIdle = true,
    enableScrollParallax = true,
    autoRotateSpeed = 0.18, // rad/s 慢速自转
    dragSensitivity = 0.0055,
  } = options

  const webglSupported = shallowRef(true)
  const activeTextureUrl = shallowRef('')
  const activeIndex = shallowRef(0)
  const isDragging = shallowRef(false)
  const focusedIndex = shallowRef(-1)

  let container = null
  let renderer = null
  let scene = null
  let camera = null
  let phoneGroup = null
  let phones = []
  let animationId = 0
  let resizeObserver = null
  let reducedMotion = false
  let isMobile = false
  let disposed = false

  let scrollOffset = 0
  let clock = null
  let textureLoader = null
  const textureCache = new Map()
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  let textureUrls = []
  let groupBaseY = 0
  let groupBaseZ = 0
  let cylinderRadius = 2.4
  let phoneScaleBase = 1

  // 连续旋转角（弧度）。front 的手机角度 = rotationY + i * step ≈ 0 (mod 2π)
  let rotationY = 0
  let velocity = 0
  let targetRotation = null // 吸附目标；null 表示自由
  let lastActiveIndex = -1
  let lastInteractAt = 0
  let autoPausedUntil = 0

  // 拖拽
  let dragging = false
  let dragPointerId = null
  let lastDragX = 0
  let lastDragT = 0
  let dragMoved = false
  let sampleVel = 0

  const TWO_PI = Math.PI * 2
  const FRICTION = 0.94
  const SNAP_STRENGTH = 0.12
  const SNAP_EPS = 0.004
  const AUTO_RESUME_MS = 1000
  const MIN_DRAG_PX = 4

  function detectWebGL() {
    try {
      const canvas = document.createElement('canvas')
      return Boolean(
        canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl'),
      )
    } catch {
      return false
    }
  }

  function setSize() {
    if (!container || !renderer || !camera) return
    const width = container.clientWidth || 1
    const height = container.clientHeight || 1
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function onScroll() {
    if (!enableScrollParallax || reducedMotion) return
    scrollOffset = Math.min((window.scrollY || 0) / 900, 1)
  }

  function loadTexture(url) {
    if (!url) return Promise.resolve(null)
    if (textureCache.has(url)) return Promise.resolve(textureCache.get(url))
    return new Promise((resolve, reject) => {
      textureLoader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          tex.anisotropy = Math.min(
            8,
            renderer?.capabilities.getMaxAnisotropy?.() || 1,
          )
          tex.minFilter = THREE.LinearMipmapLinearFilter
          tex.magFilter = THREE.LinearFilter
          tex.wrapS = THREE.ClampToEdgeWrapping
          tex.wrapT = THREE.ClampToEdgeWrapping
          textureCache.set(url, tex)
          resolve(tex)
        },
        undefined,
        reject,
      )
    })
  }

  /** 按截图比例缩放圆角卡片；正反面共用贴图 */
  function fitScreenToTexture(phone, tex, maxW = 0.96, maxH = 2.04) {
    const img = tex.image
    if (!img?.width || !img?.height) return
    const imgAspect = img.width / img.height
    const maxAspect = maxW / maxH
    let w
    let h
    if (imgAspect > maxAspect) {
      w = maxW
      h = maxW / imgAspect
    } else {
      h = maxH
      w = maxH * imgAspect
    }

    const radius = Math.min(DEFAULT_RADIUS, w * 0.06, h * 0.03)
    const geo = createRoundedRectGeometry(w, h, radius)

    const front = phone.userData.screen
    const back = phone.userData.screenBack
    if (front) {
      front.geometry.dispose()
      front.geometry = geo
    }
    if (back) {
      back.geometry.dispose()
      // 背面独立几何，避免与 front 共享 dispose 冲突
      back.geometry = createRoundedRectGeometry(w, h, radius)
    }

    tex.repeat.set(1, 1)
    tex.offset.set(0, 0)
    tex.center.set(0.5, 0.5)
    tex.rotation = 0
    tex.needsUpdate = true
    phone.userData.screenSize = { width: w, height: h, radius }
  }

  async function applyTextureToPhone(phone, url) {
    if (!phone || !url || disposed) return
    try {
      const tex = await loadTexture(url)
      if (disposed || !tex) return
      const front = phone.userData.screen
      const back = phone.userData.screenBack
      if (!front) return
      fitScreenToTexture(phone, tex)
      front.material.map = tex
      front.material.color.set(0xffffff)
      front.material.needsUpdate = true
      if (back) {
        back.material.map = tex
        back.material.color.set(0xffffff)
        back.material.needsUpdate = true
      }
      phone.userData.textureUrl = url
    } catch (error) {
      console.warn('[HeroScene] texture load failed', url, error)
    }
  }

  function wrapIndex(i, len) {
    if (len <= 0) return 0
    return ((i % len) + len) % len
  }

  function normalizeAngle(a) {
    // (-π, π]
    let x = a % TWO_PI
    if (x > Math.PI) x -= TWO_PI
    if (x <= -Math.PI) x += TWO_PI
    return x
  }

  function stepAngle() {
    const n = phones.length || textureUrls.length || 1
    return TWO_PI / Math.max(n, 1)
  }

  /** 圆柱位姿：angle=0 在正前方（朝向相机） */
  function poseForAngle(angle) {
    const x = Math.sin(angle) * cylinderRadius
    const z = Math.cos(angle) * cylinderRadius
    // 正面最大、侧面略小；背面更小
    const facing = Math.cos(angle) // 1 front, -1 back
    const scale = phoneScaleBase * (0.78 + 0.32 * Math.max(0, (facing + 1) * 0.5))
    // 手机绕 Y，屏幕朝外（面向半径方向）
    const rotY = angle
    return {
      x,
      y: 0,
      z,
      rotX: 0.01,
      rotY,
      rotZ: 0,
      scale,
      facing,
    }
  }

  function applyPose(phone, pose) {
    phone.position.set(pose.x, pose.y, pose.z)
    phone.rotation.set(pose.rotX, pose.rotY, pose.rotZ)
    phone.scale.setScalar(pose.scale)
    phone.renderOrder = 20 + Math.round(pose.facing * 10)
    // 聚焦时整体压暗作为模糊背景，否则按朝向压暗
    const inFocus = focusedIndex.value >= 0
    const dim = inFocus
      ? 0.25
      : THREE.MathUtils.clamp(0.55 + 0.45 * ((pose.facing + 1) * 0.5), 0.55, 1)
    for (const key of ['screen', 'screenBack']) {
      const mesh = phone.userData[key]
      if (mesh?.material) mesh.material.color.setRGB(dim, dim, dim)
    }
  }

  function layoutFromRotation() {
    const step = stepAngle()
    const n = phones.length
    if (!n) return
    for (let i = 0; i < n; i++) {
      const phone = phones[i]
      const angle = rotationY + i * step
      applyPose(phone, poseForAngle(angle))
      phone.userData.baseIndex = i
    }
    updateActiveFromRotation()
  }

  function updateActiveFromRotation() {
    const n = phones.length || textureUrls.length
    if (!n || !textureUrls.length) return
    const step = stepAngle()
    // 前方角 ≈ 0：找使 (rotationY + i*step) 最接近 0 (mod 2π) 的 i
    // 等价：i ≈ -rotationY / step
    let best = 0
    let bestAbs = Infinity
    for (let i = 0; i < n; i++) {
      const a = normalizeAngle(rotationY + i * step)
      const d = Math.abs(a)
      if (d < bestAbs) {
        bestAbs = d
        best = i
      }
    }
    const idx = wrapIndex(best, textureUrls.length)
    if (idx !== lastActiveIndex) {
      lastActiveIndex = idx
      activeIndex.value = idx
      activeTextureUrl.value = textureUrls[idx] || ''
    }
  }

  function snapTargetForIndex(index) {
    const n = phones.length || textureUrls.length
    if (!n) return 0
    const step = stepAngle()
    // 想让 index 在前方：rotationY + index * step ≈ 0 (mod 2π)
    // rotationY ≈ -index * step
    const desired = -index * step
    // 选与当前 rotationY 最近的等价角
    const delta = normalizeAngle(desired - rotationY)
    return rotationY + delta
  }

  function beginSnap() {
    if (!phones.length) return
    const n = phones.length
    const step = stepAngle()
    let best = 0
    let bestAbs = Infinity
    for (let i = 0; i < n; i++) {
      const a = normalizeAngle(rotationY + i * step)
      const d = Math.abs(a)
      if (d < bestAbs) {
        bestAbs = d
        best = i
      }
    }
    targetRotation = snapTargetForIndex(best)
  }

  function nextSlide() {
    if (!textureUrls.length) return
    velocity = 0
    const next = wrapIndex(activeIndex.value + 1, textureUrls.length)
    activate(next)
  }

  function prevSlide() {
    if (!textureUrls.length) return
    velocity = 0
    const next = wrapIndex(activeIndex.value - 1, textureUrls.length)
    activate(next)
  }

  // —— 点击聚焦 ——
  function activate(index) {
    // 先转该卡片到正前方
    targetRotation = snapTargetForIndex(index)
    lastInteractAt = performance.now()
    autoPausedUntil = lastInteractAt + AUTO_RESUME_MS
  }

  /** 触发焦点模式：把点击的卡片转到正中并放大，其余压暗 */
  function focusIndex(index) {
    if (!textureUrls.length || index < 0) return
    velocity = 0
    activate(index)
    focusedIndex.value = index
    layoutFromRotation()
  }

  function exitFocus() {
    if (focusedIndex.value < 0) return
    focusedIndex.value = -1
    layoutFromRotation()
  }

  function isFocused() {
    return focusedIndex.value >= 0
  }

  /** raycast 点击拾取最近的可见侧卡片 */
  function pickAt(clientX, clientY) {
    if (!container || !renderer || !camera || !phones.length) return -1
    const rect = container.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    // 仅检测正面（可见侧）卡片，按 xz 距离取最近
    const candidates = []
    for (let i = 0; i < phones.length; i++) {
      const phone = phones[i]
      const step = stepAngle()
      const a = normalizeAngle(rotationY + i * step)
      // 只点击前方半圈（cos>0）
      if (Math.cos(a) <= 0.05) continue
      const hit = raycaster.intersectObject(phone, true)
      if (hit.length) {
        candidates.push({ index: i, dist: hit[0].distance })
      }
    }
    if (!candidates.length) return -1
    candidates.sort((a, b) => a.dist - b.dist)
    return candidates[0].index
  }

  function goToIndex(index, { animate = true } = {}) {
    if (!textureUrls.length || !phones.length) return
    const next = wrapIndex(index, textureUrls.length)
    const dest = snapTargetForIndex(next)
    if (Math.abs(normalizeAngle(dest - rotationY)) < 0.02 && Math.abs(velocity) < 0.002) {
      return
    }
    velocity = 0
    if (!animate || reducedMotion) {
      rotationY = dest
      targetRotation = null
      layoutFromRotation()
      return
    }
    targetRotation = dest
    lastInteractAt = performance.now()
    autoPausedUntil = lastInteractAt + AUTO_RESUME_MS
  }

  function rebuildPhones(urls) {
    // 清理旧机
    for (const phone of phones) {
      disposeObject(phone)
      phoneGroup?.remove(phone)
    }
    phones = []

    if (!phoneGroup) {
      phoneGroup = new THREE.Group()
      scene.add(phoneGroup)
    }

    const count = urls.length
    if (!count) return

    // 半径随数量：卡片宽约 0.96 * scale；周长 2πr 需容纳 count 张
    const bodyW = 0.96 * phoneScaleBase
    const minR = (count * bodyW) / (TWO_PI * 0.9)
    cylinderRadius = isMobile
      ? Math.max(2.05, minR * 0.95)
      : Math.max(2.4, minR)

    for (let i = 0; i < count; i++) {
      const phone = createPhoneMesh()
      phone.userData.baseIndex = i
      phones.push(phone)
      phoneGroup.add(phone)
      applyTextureToPhone(phone, urls[i])
    }

    layoutFromRotation()
  }

  function setTextureUrls(urls = []) {
    const next = Array.isArray(urls) ? urls.filter(Boolean) : []
    const same =
      next.length === textureUrls.length &&
      next.every((u, i) => u === textureUrls[i])
    textureUrls = next
    if (!textureUrls.length) return
    // 列表变化时退出聚焦，避免索引错位
    if (focusedIndex.value >= 0 && focusedIndex.value >= textureUrls.length) {
      focusedIndex.value = -1
    }

    if (!same || phones.length !== textureUrls.length) {
      if (scene) rebuildPhones(textureUrls)
    } else {
      for (let i = 0; i < phones.length; i++) {
        const url = textureUrls[i]
        if (phones[i].userData.textureUrl !== url) {
          applyTextureToPhone(phones[i], url)
        }
      }
      layoutFromRotation()
    }

    textureUrls.forEach((u) => loadTexture(u))
    updateActiveFromRotation()
  }

  async function setScreenTexture(url, { animate = true } = {}) {
    if (!url) return
    // 避免场景自身 emit → 父级回写 造成吸附打断连续旋转
    if (url === activeTextureUrl.value) return
    if (!textureUrls.length) {
      textureUrls = [url]
      if (scene) rebuildPhones(textureUrls)
      return
    }
    const idx = textureUrls.indexOf(url)
    if (idx >= 0) {
      goToIndex(idx, { animate })
      return
    }
    // 未知 url：只更新当前前台机
    activeTextureUrl.value = url
    const front = phones.find((p) => {
      const step = stepAngle()
      const a = normalizeAngle(rotationY + p.userData.baseIndex * step)
      return Math.abs(a) < step * 0.5
    })
    if (front) await applyTextureToPhone(front, url)
  }

  // —— 拖拽：抓住滚筒转圈 ——
  function onPointerDown(event) {
    if (!container || disposed) return
    if (event.button != null && event.button !== 0) return
    dragging = true
    dragMoved = false
    dragPointerId = event.pointerId
    lastDragX = event.clientX
    lastDragT = performance.now()
    sampleVel = 0
    velocity = 0
    targetRotation = null
    isDragging.value = true
    lastInteractAt = lastDragT
    autoPausedUntil = lastDragT + AUTO_RESUME_MS
    try {
      container.setPointerCapture?.(event.pointerId)
    } catch {
      /* ignore */
    }
    container.classList.add('is-dragging')
  }

  function onPointerUp(event) {
    if (dragPointerId != null && event.pointerId !== dragPointerId) return
    const moved = dragMoved
    // 先结束拖拽状态，再判定点击
    endDragNoSnap(moved)
    try {
      container?.releasePointerCapture?.(event.pointerId)
    } catch {
      /* ignore */
    }
    // 未发生位移 → 判定为点击：拾取卡片进入聚焦
    if (!moved) {
      const idx = pickAt(event.clientX, event.clientY)
      if (idx >= 0) {
        // 已在该焦点 → 退出
        if (focusedIndex.value === idx) exitFocus()
        else focusIndex(idx)
        return
      }
      // 点到空白：聚焦时退出，否则吸附到最近的正前方
      if (focusedIndex.value >= 0) exitFocus()
      else beginSnap()
    } else {
      // 拖拽结束 → 惯性/吸附
      finalizeDrag()
    }
  }

  function onPointerMove(event) {
    if (!dragging || disposed) return
    if (dragPointerId != null && event.pointerId !== dragPointerId) return

    const now = performance.now()
    const dx = event.clientX - lastDragX
    const dt = Math.max(now - lastDragT, 8)

    if (Math.abs(dx) > MIN_DRAG_PX) dragMoved = true

    // 向右拖 → 滚筒向右转（正面机往右走，露出左侧）
    const deltaAngle = dx * dragSensitivity
    rotationY += deltaAngle
    // 速度样本（rad/ms → 后面转 rad/frame 近似）
    sampleVel = (deltaAngle / dt) * 16.67

    lastDragX = event.clientX
    lastDragT = now
    lastInteractAt = now
    autoPausedUntil = now + AUTO_RESUME_MS

    layoutFromRotation()
  }

  function endDragNoSnap() {
    if (!dragging) return
    dragging = false
    dragPointerId = null
    isDragging.value = false
    container?.classList.remove('is-dragging')
  }

  function finalizeDrag() {
    // 甩动惯性
    velocity = THREE.MathUtils.clamp(sampleVel, -0.45, 0.45)
    sampleVel = 0
    if (Math.abs(velocity) < 0.012) {
      velocity = 0
      beginSnap()
    }
  }

  function endDrag() {
    endDragNoSnap()
    finalizeDrag()
  }

  function onPointerCancel() {
    endDragNoSnap()
  }

  function onLostCapture() {
    endDragNoSnap()
  }

  function animate() {
    if (disposed) return
    animationId = requestAnimationFrame(animate)
    if (!renderer || !scene || !camera || !phoneGroup) return

    const t = clock.getElapsedTime()
    const now = performance.now()
    const inFocus = focusedIndex.value >= 0

    if (!dragging) {
      if (targetRotation != null) {
        const delta = normalizeAngle(targetRotation - rotationY)
        if (Math.abs(delta) < SNAP_EPS) {
          rotationY = targetRotation
          targetRotation = null
          velocity = 0
        } else {
          rotationY += delta * (reducedMotion ? 1 : inFocus ? SNAP_STRENGTH * 1.4 : SNAP_STRENGTH)
        }
        layoutFromRotation()
      } else if (!inFocus && Math.abs(velocity) > 0.001) {
        rotationY += velocity
        velocity *= reducedMotion ? 0.7 : FRICTION
        if (Math.abs(velocity) < 0.004) {
          velocity = 0
          beginSnap()
        }
        layoutFromRotation()
      } else if (
        !reducedMotion &&
        !inFocus &&
        autoRotateSpeed > 0 &&
        textureUrls.length > 1 &&
        now >= autoPausedUntil
      ) {
        // 慢速持续转圈（滚筒感），不逐步跳帧
        rotationY += autoRotateSpeed * (1 / 60)
        layoutFromRotation()
      } else {
        // 静止 / 聚焦时仍刷新位姿（缩放/亮度过渡）
        layoutFromRotation()
      }
    }

    // 轻微上下浮动；聚焦时停止浮动以稳定查看
    const idleAmp =
      reducedMotion || !enableIdle || inFocus ? 0 : isMobile ? 0.004 : 0.008
    const floatY = Math.sin(t * 0.9) * idleAmp
    phoneGroup.rotation.x += (0.02 - phoneGroup.rotation.x) * 0.06
    phoneGroup.position.y +=
      (groupBaseY + floatY + scrollOffset * -0.02 - phoneGroup.position.y) * 0.08
    phoneGroup.position.z +=
      (groupBaseZ + scrollOffset * -0.04 - phoneGroup.position.z) * 0.06

    // 滚筒整体不绕 Y 转——旋转由各机圆柱角承担
    phoneGroup.rotation.y = 0

    renderer.render(scene, camera)
  }

  function mount(el, { reduced = false, textureUrl = '', urls = [] } = {}) {
    container = el
    reducedMotion = reduced
    isMobile = window.matchMedia('(max-width: 768px)').matches
    disposed = false
    lastInteractAt = performance.now()
    autoPausedUntil = lastInteractAt + 1200
    velocity = 0
    targetRotation = null
    rotationY = 0
    lastActiveIndex = -1
    dragging = false
    isDragging.value = false

    if (!detectWebGL()) {
      webglSupported.value = false
      return false
    }

    webglSupported.value = true
    clock = new THREE.Clock()
    textureLoader = new THREE.TextureLoader()
    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0f0f23, isMobile ? 0.07 : 0.04)

    // 拉远视角，保证整张截图上下完整可见
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0.02, isMobile ? 6.6 : 6.1)

    renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = !isMobile
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none' // 水平拖不触发页面滚动
    renderer.domElement.setAttribute('aria-hidden', 'true')
    container.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xb8a8ff, 0.62))
    const key = new THREE.DirectionalLight(0xffffff, 1.25)
    key.position.set(2.8, 3.4, 4.2)
    key.castShadow = !isMobile
    if (key.castShadow) {
      key.shadow.mapSize.set(1024, 1024)
      key.shadow.camera.near = 0.5
      key.shadow.camera.far = 24
    }
    scene.add(key)

    const rim = new THREE.DirectionalLight(0x7c3aed, 0.95)
    rim.position.set(-3.2, 1.6, -2.2)
    scene.add(rim)

    const accent = new THREE.PointLight(0xf43f5e, 0.55, 14)
    accent.position.set(1.6, -1.1, 2.4)
    scene.add(accent)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 64),
      new THREE.MeshStandardMaterial({
        color: 0x120f22,
        metalness: 0.2,
        roughness: 0.9,
        transparent: true,
        opacity: 0.22,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -1.85
    ground.receiveShadow = true
    scene.add(ground)

    // 缩放适中：完整露出截图上下，两侧滚筒仍可见
    phoneScaleBase = isMobile ? 1.05 : 1.18
    groupBaseY = 0
    groupBaseZ = -cylinderRadius * 0.08

    phoneGroup = new THREE.Group()
    scene.add(phoneGroup)
    phoneGroup.position.set(0, groupBaseY, groupBaseZ)

    const list = urls.length ? urls : textureUrl ? [textureUrl] : []
    setTextureUrls(list)
    groupBaseZ = isMobile ? -0.45 : -0.58
    phoneGroup.position.z = groupBaseZ

    if (textureUrl && list.includes(textureUrl)) {
      goToIndex(list.indexOf(textureUrl), { animate: false })
    }

    setSize()
    resizeObserver = new ResizeObserver(() => setSize())
    resizeObserver.observe(container)

    // 在 container 上绑指针，便于抓取拖动
    container.style.touchAction = 'none'
    container.style.cursor = 'grab'
    container.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    container.addEventListener('lostpointercapture', onLostCapture)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    animate()
    return true
  }

  function setReducedMotion(value) {
    reducedMotion = value
    if (value) {
      velocity = 0
      if (targetRotation == null) beginSnap()
    }
  }

  function dispose() {
    disposed = true
    cancelAnimationFrame(animationId)
    resizeObserver?.disconnect()
    resizeObserver = null

    container?.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    container?.removeEventListener('lostpointercapture', onLostCapture)
    window.removeEventListener('scroll', onScroll)

    for (const phone of phones) {
      disposeObject(phone)
      phoneGroup?.remove(phone)
    }
    phones = []
    if (phoneGroup) {
      scene?.remove(phoneGroup)
      phoneGroup = null
    }
    if (scene) disposeObject(scene)
    for (const tex of textureCache.values()) tex.dispose()
    textureCache.clear()

    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss?.()
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
    renderer = null
    scene = null
    camera = null
    container = null
  }

  onUnmounted(() => dispose())

  return {
    webglSupported,
    activeTextureUrl,
    activeIndex,
    isDragging,
    focusedIndex,
    mount,
    dispose,
    setScreenTexture,
    setTextureUrls,
    setReducedMotion,
    nextSlide,
    prevSlide,
    goToIndex,
    focusIndex,
    exitFocus,
  }
}
