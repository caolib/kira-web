import { onUnmounted, shallowRef } from 'vue'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import {
  createDeviceMesh,
  fitDeviceToAspect,
  applyScreenTexture,
  setDeviceBrightness,
  createContactShadow,
  createReflectiveFloor,
  disposeObject,
} from '@/lib/deviceMesh'

// 读取 CSS 变量（如 --brand 的 "217 119 87" 三元组或 "#000000"）并转为 0xRRGGBB
function themeHex(varName, fallback) {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  if (raw.startsWith('#')) {
    const hex = raw.length === 4 ? raw.slice(1).replace(/./g, '$&$&') : raw.slice(1)
    const int = parseInt(hex, 16)
    if (!Number.isNaN(int)) return int
  }
  const nums = raw.split(/[\s,/]+/).map(Number).filter((n) => !Number.isNaN(n))
  if (nums.length < 3) return fallback
  const [r, g, b] = nums.slice(0, 3)
  return (r << 16) | (g << 8) | b
}

/** 展台氛围参数：清屏/雾统一取 --stage-bg（两套主题均为纯黑） */
function stagePalette() {
  const base = themeHex('--stage-bg', 0x000000)
  return { base, fog: base }
}

/**
 * 电影感设备展台（方案 A）：
 * 一台主设备立在反光台面正中，屏幕用 ShaderMaterial 做
 * 「RGB 通道错位 + 噪声溶解」换图过渡；其余截图贴在背景浅弧上的
 * 设备群里（预模糊贴图，假景深），配合 Bloom 与缓慢相机漂移。
 */

// —— 屏幕过渡 shader ——
const SCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SCREEN_FRAGMENT = /* glsl */ `
  uniform sampler2D t1;
  uniform sampler2D t2;
  uniform float progress;
  uniform float time;
  varying vec2 vUv;

  void main() {
    float p = clamp(progress, 0.0, 1.0);
    vec3 col;
    if (p <= 0.001) {
      // 干净显示 t1
      col = texture2D(t1, vUv).rgb;
    } else if (p >= 0.999) {
      // 干净显示 t2
      col = texture2D(t2, vUv).rgb;
    } else {
      // 对角柔光扫过 reveal：
      // 沿对角坐标一道宽柔边从旧图揭到新图，前沿贴一道移动高光；
      // 新图 1.05 → 1.0 轻微变焦落定，旧图在扫光到来前微微压暗
      float d = (vUv.x + (1.0 - vUv.y) * 0.4) / 1.4; // 0..1 对角坐标
      float soft = 0.22;
      float w = mix(-soft, 1.0 + soft, p);           // 扫光前沿位置
      float m = 1.0 - smoothstep(w, w + soft, d);    // 1 = 已是新图

      vec3 oldCol = texture2D(t1, vUv).rgb;
      vec2 uv2 = (vUv - 0.5) * mix(1.05, 1.0, m) + 0.5;
      vec3 newCol = texture2D(t2, uv2).rgb;

      // 扫光未到之处，旧图随进程微微压暗，拉出层次
      float ahead = smoothstep(w + soft, w + soft + 0.35, d);
      oldCol *= 1.0 - 0.18 * ahead * sin(p * 3.14159);

      col = mix(oldCol, newCol, m);

      // 移动高光带：贴扫光前沿的高斯窄带，仅过渡中段可见
      float band = exp(-pow((d - w) * 7.0, 2.0));
      col += band * vec3(1.0, 0.97, 0.92) * 0.55 * sin(p * 3.14159);
    }
    // 屏幕整体压暗：暗色展台里满亮度直出像灯箱；
    // 同时把白色 UI 压到 bloom 阈值（0.92）之下，不吃辉光
    gl_FragColor = vec4(col * 0.85, 1.0);
  }
`

const TRANSITION_DURATION = 1.25 // s
const ARC_RADIUS = 3.4
const ARC_CENTER_Z = -1.2
const ARC_SPAN = 1.0 // rad，±1.0
const CAMERA_BASE_Y = 1.0
const CAMERA_RADIUS = 4.1
const CAMERA_RADIUS_MOBILE = 5.0
/** 视线落点：画布延伸到顶栏背后后，落点略高于机身中心（~1.03），
 * 让手机整体下移、顶部让出顶栏高度不与之重叠 */
const LOOK_AT_Y_DESKTOP = 1.06
const LOOK_AT_Y_MOBILE = 0.99
let lookAtY = LOOK_AT_Y_DESKTOP

export function useStageScene(options = {}) {
  const { autoCycleMs = 4500 } = options

  const webglSupported = shallowRef(true)
  const activeIndex = shallowRef(0)
  const activeTextureUrl = shallowRef('')

  let container = null
  let renderer = null
  let scene = null
  let camera = null
  let composer = null
  let bloomPass = null
  let clock = null
  let textureLoader = null
  let animationId = 0
  let resizeObserver = null
  let themeObserver = null
  let reducedMotion = false
  let isMobile = false
  let disposed = false

  let mainDevice = null
  let screenMaterial = null
  let screenUniforms = null
  let bgGroup = null
  let bgDevices = []
  let floor = null
  let contactShadow = null

  // 点击主设备回调 + 射线拾取（点击屏幕放大预览）
  let onScreenClickCb = null
  let autoCyclePaused = false
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()

  const textureCache = new Map()

  let textureUrls = []
  let currentTex = null // 主屏当前稳定显示的贴图
  let elapsedTime = 0
  let nextAutoAt = 0
  let switchSeq = 0

  // 过渡状态
  let trans = { active: false, toTex: null, start: 0 }

  // 相机漂移 / 视差
  let mouseX = 0
  let mouseY = 0
  let camAz = 0
  let camY = CAMERA_BASE_Y
  let camRadius = CAMERA_RADIUS

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
    if (composer) {
      composer.setPixelRatio?.(renderer.getPixelRatio())
      composer.setSize(width, height)
    }
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
            16,
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

  function wrapIndex(i, len) {
    if (len <= 0) return 0
    return ((i % len) + len) % len
  }

  /** 立即完成当前过渡：t1 = t2，progress = 0 */
  function completeTransition() {
    if (!trans.active) return
    trans.active = false
    currentTex = trans.toTex
    if (screenUniforms && trans.toTex) {
      screenUniforms.t1.value = trans.toTex
      screenUniforms.t2.value = trans.toTex
      screenUniforms.progress.value = 0
    }
  }

  /** 加载 url 并开始向它过渡（instant 或 reducedMotion 时瞬时完成） */
  async function startTransition(url, { instant = false } = {}) {
    if (!url || !mainDevice || !screenUniforms) return
    const seq = ++switchSeq
    try {
      const tex = await loadTexture(url)
      if (disposed || seq !== switchSeq || !tex) return

      // 按截图真实比例重建机身/屏幕几何，并重新落地
      const img = tex.image
      if (img?.width && img?.height) {
        fitDeviceToAspect(mainDevice, img.width / img.height)
      }
      mainDevice.position.y =
        (mainDevice.userData.bodySize?.height || 2.06) / 2

      // 进行中再切换：立即完成旧过渡，从新起点开始
      completeTransition()

      if (instant || reducedMotion) {
        currentTex = tex
        screenUniforms.t1.value = tex
        screenUniforms.t2.value = tex
        screenUniforms.progress.value = 0
        return
      }
      screenUniforms.t1.value = currentTex || tex
      screenUniforms.t2.value = tex
      screenUniforms.progress.value = 0
      trans = { active: true, toTex: tex, start: elapsedTime }
    } catch (error) {
      console.warn('[StageScene] texture load failed', url, error)
    }
  }

  function setDeviceOpacity(dev, opacity) {
    const { body, screen, buttons } = dev.userData
    for (const m of [body, screen, ...buttons]) {
      if (!m?.material) continue
      m.material.transparent = true
      m.material.opacity = opacity
    }
  }

  function updateBackgroundVisibility() {
    const activeUrl = textureUrls[activeIndex.value] || ''
    for (const dev of bgDevices) {
      dev.userData.targetOpacity = dev.userData.url !== activeUrl ? 1 : 0
    }
  }

  /** 给背景机贴清晰原图，仅靠压暗 + 距离做出层次感 */
  async function applyTextureToDevice(dev, url) {
    try {
      const src = await loadTexture(url)
      if (disposed || !src) return
      if (!bgDevices.includes(dev)) return // 背景已重建，放弃
      applyScreenTexture(dev, src)
      setDeviceBrightness(dev, 0.72)
      // fit 之后重新计算站位（底部落在 y=0，加错落抖动）
      dev.position.y =
        (dev.userData.bodySize?.height || 2.06) / 2 + dev.userData.yJitter
    } catch (error) {
      console.warn('[StageScene] background texture failed', url, error)
    }
  }

  /** 背景浅弧：每台设备对应一张截图，均匀分布在 ±ARC_SPAN 上 */
  function rebuildBackground() {
    if (!bgGroup) return
    for (const dev of bgDevices) {
      bgGroup.remove(dev)
      disposeObject(dev)
    }
    bgDevices = []

    const n = textureUrls.length
    if (!n) return
    for (let i = 0; i < n; i++) {
      const url = textureUrls[i]
      const dev = createDeviceMesh()
      dev.userData.url = url
      const theta = n > 1 ? -ARC_SPAN + (2 * ARC_SPAN * i) / (n - 1) : 0
      const jitter = Math.sin(i * 2.39) * 0.06
      dev.userData.yJitter = jitter
      dev.position.set(
        Math.sin(theta) * ARC_RADIUS,
        1.03 + jitter,
        ARC_CENTER_Z - Math.cos(theta) * ARC_RADIUS,
      )
      // 水平朝向相机（保持竖直）
      dev.lookAt(0, dev.position.y, camRadius)
      setDeviceBrightness(dev, 0.7)
      const isActive = url === (textureUrls[activeIndex.value] || '')
      dev.userData.targetOpacity = isActive ? 0 : 1
      dev.userData.currentOpacity = dev.userData.targetOpacity
      dev.visible = !isActive
      if (isActive) setDeviceOpacity(dev, 0)
      bgGroup.add(dev)
      bgDevices.push(dev)
      applyTextureToDevice(dev, url)
    }
    updateBackgroundVisibility()
  }

  function setTextureUrls(urls = []) {
    const next = Array.isArray(urls) ? urls.filter(Boolean) : []
    const same =
      next.length === textureUrls.length &&
      next.every((u, i) => u === textureUrls[i])
    textureUrls = next
    if (!textureUrls.length) return
    if (activeIndex.value >= textureUrls.length) activeIndex.value = 0

    if (scene && (!same || !currentTex)) {
      rebuildBackground()
      const url = textureUrls[activeIndex.value]
      if (url !== activeTextureUrl.value || !currentTex) {
        activeTextureUrl.value = url
        // 首次贴图瞬时完成，之后列表变化走过渡动画
        startTransition(url, { instant: !currentTex })
      }
    }
    textureUrls.forEach((u) => loadTexture(u))
    updateBackgroundVisibility()
  }

  function goToIndex(index) {
    if (!textureUrls.length) return
    const next = wrapIndex(index, textureUrls.length)
    if (next === activeIndex.value) return
    activeIndex.value = next
    activeTextureUrl.value = textureUrls[next] || ''
    nextAutoAt = performance.now() + autoCycleMs
    updateBackgroundVisibility()
    startTransition(textureUrls[next])
  }

  function nextSlide() {
    if (!textureUrls.length) return
    goToIndex(activeIndex.value + 1)
  }

  function prevSlide() {
    if (!textureUrls.length) return
    goToIndex(activeIndex.value - 1)
  }

  function onPointerMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1
    mouseY = -((event.clientY / window.innerHeight) * 2 - 1)
  }

  /** 射线检测点击/悬停是否落在主设备上 */
  function pickMainDevice(event) {
    if (!renderer || !camera || !mainDevice) return false
    const rect = renderer.domElement.getBoundingClientRect()
    if (!rect.width || !rect.height) return false
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointerNdc, camera)
    return raycaster.intersectObject(mainDevice, true).length > 0
  }

  function onCanvasClick(event) {
    if (pickMainDevice(event)) onScreenClickCb?.()
  }

  function onCanvasPointerMove(event) {
    if (event.pointerType && event.pointerType !== 'mouse') return
    renderer.domElement.style.cursor = pickMainDevice(event) ? 'pointer' : ''
  }

  function animate() {
    if (disposed) return
    animationId = requestAnimationFrame(animate)
    if (!renderer || !scene || !camera) return

    elapsedTime = clock.getElapsedTime()
    const now = performance.now()

    // 推进屏幕过渡
    if (trans.active) {
      const p = Math.min(1, (elapsedTime - trans.start) / TRANSITION_DURATION)
      // smootherstep 缓动：起步/收尾更稳，扫光中段匀速
      const eased = p * p * p * (p * (p * 6 - 15) + 10)
      screenUniforms.progress.value = reducedMotion ? 1 : eased
      if (p >= 1 || reducedMotion) completeTransition()
    }
    if (screenUniforms) screenUniforms.time.value = elapsedTime

    // 背景设备渐隐渐显（lerp 透明度，避免硬切）
    for (const dev of bgDevices) {
      if (!dev) continue
      const target = dev.userData.targetOpacity ?? 1
      const current = dev.userData.currentOpacity ?? 1
      if (current === target) continue
      const next = current + (target - current) * 0.06
      dev.userData.currentOpacity = next
      // 接近 0 时隐藏，避免渲染无意义对象
      dev.visible = next > 0.01
      setDeviceOpacity(dev, next)
    }

    // 自动轮播（预览打开时暂停）
    if (
      !reducedMotion &&
      !autoCyclePaused &&
      textureUrls.length > 1 &&
      !trans.active &&
      now >= nextAutoAt
    ) {
      nextSlide()
    }

    // 相机：缓慢环绕漂移 + 呼吸俯仰 + 鼠标视差，全部 lerp 平滑
    let azTarget = 0
    let yTarget = CAMERA_BASE_Y
    if (!reducedMotion) {
      azTarget = Math.sin(elapsedTime * 0.07) * 0.22 + mouseX * 0.12
      yTarget =
        CAMERA_BASE_Y + Math.sin(elapsedTime * 0.45) * 0.03 + mouseY * 0.08
    }
    camAz += (azTarget - camAz) * 0.04
    camY += (yTarget - camY) * 0.04
    camera.position.set(
      Math.sin(camAz) * camRadius,
      camY,
      Math.cos(camAz) * camRadius,
    )
    camera.lookAt(0, lookAtY, 0)

    if (composer) composer.render()
    else renderer.render(scene, camera)
  }

  function mount(el, { reduced = false, urls = [], onScreenClick = null } = {}) {
    container = el
    reducedMotion = reduced
    onScreenClickCb = onScreenClick
    isMobile = window.matchMedia('(max-width: 768px)').matches
    camRadius = isMobile ? CAMERA_RADIUS_MOBILE : CAMERA_RADIUS
    lookAtY = isMobile ? LOOK_AT_Y_MOBILE : LOOK_AT_Y_DESKTOP
    disposed = false
    nextAutoAt = performance.now() + 1500

    if (!detectWebGL()) {
      webglSupported.value = false
      return false
    }

    webglSupported.value = true
    clock = new THREE.Clock()
    textureLoader = new THREE.TextureLoader()
    scene = new THREE.Scene()
    // 雾色/清屏色统一取 --stage-bg（纯黑）
    const palette = stagePalette()
    scene.fog = new THREE.FogExp2(palette.fog, 0.055)

    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, CAMERA_BASE_Y, camRadius)
    camera.lookAt(0, lookAtY, 0)

    renderer = new THREE.WebGLRenderer({
      // 移动端没有 composer，靠这里开 MSAA；桌面端走 composer，
      // 由下方带 samples 的渲染目标负责抗锯齿
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    // 画布空区直接填 --stage-bg：canvas 经 composer 输出后实际不透明，
    // 用背景色填充可与 DOM 背景无缝衔接，顶栏透明浮在画布上也不出分界
    renderer.setClearColor(palette.base, 1)
    // 主题切换时同步清屏色与雾色（data-theme 属性变化）
    themeObserver = new MutationObserver(() => {
      const p = stagePalette()
      renderer?.setClearColor(p.base, 1)
      if (scene?.fog) scene.fog.color.setHex(p.fog)
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    container.appendChild(renderer.domElement)

    // —— 灯光（跟随主题色）——
    const rimColor = themeHex('--brand', 0xd97757)
    const accentColor = themeHex('--color-accent', 0xf43f5e)
    scene.add(new THREE.AmbientLight(0xffe2cc, 0.35))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(2.5, 4, 3)
    scene.add(key)
    const rim = new THREE.DirectionalLight(rimColor, 1.2)
    rim.position.set(-3, 1.5, -2)
    scene.add(rim)
    const accent = new THREE.PointLight(accentColor, 0.5, 12)
    accent.position.set(1.8, 0.4, 2.5)
    scene.add(accent)

    // —— 反光台面（异步 import Reflector）——
    createReflectiveFloor({
      size: 12,
      tint: 0x0d0b09,
      darkness: 0.72,
      // 倒影分辨率加倍，压掉倒影里手机边缘的锯齿
      textureSize: isMobile ? 1024 : 2048,
    })
      .then((f) => {
        if (disposed) {
          disposeObject(f)
          return
        }
        floor = f
        scene.add(f)
      })
      .catch((error) => {
        console.warn('[StageScene] reflective floor failed', error)
      })

    // 主设备正下方接触阴影
    contactShadow = createContactShadow({ width: 1.6, depth: 0.9, opacity: 0.55 })
    contactShadow.position.y = 0.005
    scene.add(contactShadow)

    // —— 主设备：屏幕换成过渡 ShaderMaterial ——
    mainDevice = createDeviceMesh()
    const screenMesh = mainDevice.userData.screen
    screenUniforms = {
      t1: { value: null },
      t2: { value: null },
      progress: { value: 0 },
      time: { value: 0 },
    }
    screenMaterial = new THREE.ShaderMaterial({
      uniforms: screenUniforms,
      vertexShader: SCREEN_VERTEX,
      fragmentShader: SCREEN_FRAGMENT,
    })
    screenMesh.material.dispose()
    screenMesh.material = screenMaterial
    mainDevice.position.y =
      (mainDevice.userData.bodySize?.height || 2.06) / 2
    scene.add(mainDevice)

    bgGroup = new THREE.Group()
    scene.add(bgGroup)

    // —— Bloom 后处理（移动端直出）——
    if (!isMobile) {
      try {
        // EffectComposer 默认渲染目标不带多重采样，renderer 的 antialias
        // 不生效，几何边缘会出锯齿；传入带 samples 的目标恢复 MSAA
        const aaTarget = new THREE.WebGLRenderTarget(1, 1, {
          type: THREE.HalfFloatType,
          samples: 4,
        })
        composer = new EffectComposer(renderer, aaTarget)
        composer.addPass(new RenderPass(scene, camera))
        bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.4, 0.92)
        composer.addPass(bloomPass)
        composer.addPass(new OutputPass())
      } catch (error) {
        console.warn('[StageScene] bloom init failed, fallback to direct render', error)
        composer = null
        bloomPass = null
      }
    }

    const list = urls.length ? urls : textureUrls
    if (list.length) setTextureUrls(list)

    setSize()
    resizeObserver = new ResizeObserver(() => setSize())
    resizeObserver.observe(container)

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    renderer.domElement.addEventListener('click', onCanvasClick)
    renderer.domElement.addEventListener('pointermove', onCanvasPointerMove, {
      passive: true,
    })
    animate()
    return true
  }

  function setReducedMotion(value) {
    reducedMotion = value
    if (value) completeTransition()
  }

  /** 大图预览打开时暂停自动轮播，关闭后重新计时再恢复 */
  function setAutoCyclePaused(value) {
    autoCyclePaused = value
    nextAutoAt = performance.now() + autoCycleMs
  }

  function dispose() {
    disposed = true
    cancelAnimationFrame(animationId)
    resizeObserver?.disconnect()
    resizeObserver = null
    themeObserver?.disconnect()
    themeObserver = null
    window.removeEventListener('pointermove', onPointerMove)
    renderer?.domElement.removeEventListener('click', onCanvasClick)
    renderer?.domElement.removeEventListener('pointermove', onCanvasPointerMove)

    if (mainDevice) {
      scene?.remove(mainDevice)
      disposeObject(mainDevice)
      mainDevice = null
    }
    for (const dev of bgDevices) {
      bgGroup?.remove(dev)
      disposeObject(dev)
    }
    bgDevices = []
    if (bgGroup) {
      scene?.remove(bgGroup)
      bgGroup = null
    }
    if (floor) {
      scene?.remove(floor)
      disposeObject(floor)
      floor = null
    }
    if (contactShadow) {
      scene?.remove(contactShadow)
      disposeObject(contactShadow)
      contactShadow = null
    }
    if (scene) disposeObject(scene)

    for (const tex of textureCache.values()) tex.dispose()
    textureCache.clear()

    composer?.dispose?.()
    composer = null
    bloomPass = null

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
    screenMaterial = null
    screenUniforms = null
    currentTex = null
    trans = { active: false, toTex: null, start: 0 }
  }

  onUnmounted(() => dispose())

  return {
    webglSupported,
    activeIndex,
    activeTextureUrl,
    mount,
    dispose,
    setTextureUrls,
    setReducedMotion,
    setAutoCyclePaused,
    nextSlide,
    prevSlide,
    goToIndex,
  }
}
