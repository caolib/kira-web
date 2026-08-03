import * as THREE from 'three'
import {
  createRoundedRectShape,
  createRoundedRectGeometry,
  disposeObject,
} from './phoneMesh.js'

/**
 * 「真机」设备模型：金属边框机身 + 内嵌屏幕 + 打孔前摄 + 侧边按键。
 * 供展台（A）/ 扇形 Cover Flow（C）等场景共用。
 *
 * 坐标约定：机身中心在原点，屏幕朝 +Z，顶部朝 +Y。
 * userData:
 *   screen       屏幕 mesh（材质为 MeshBasicMaterial，可直接换 map）
 *   screenSize   { width, height, radius } 当前屏幕尺寸
 *   bodySize     { width, height, depth } 机身尺寸
 */

const SCREEN_MAX_W = 0.92
const SCREEN_MAX_H = 1.96
/** 边框（ bezel ）宽度 */
const BEZEL = 0.05
const BODY_DEPTH = 0.06
/** 机身挤出 bevel 厚度——屏幕/打孔必须越过  BODY_DEPTH/2 + BEVEL 的前盖 */
const BEVEL = 0.008
/** 屏幕前表面 z（高出机身前盖，避免被实心机身挡住） */
const SCREEN_Z = BODY_DEPTH / 2 + BEVEL + 0.004
const FRAME_COLOR = 0x15151d
const BUTTON_COLOR = 0x0b0b10

export { SCREEN_MAX_W, SCREEN_MAX_H, BEZEL, BODY_DEPTH }

function createBodyGeometry(width, height, radius) {
  const shape = createRoundedRectShape(width, height, radius)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: BODY_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 24,
  })
  geo.translate(0, 0, -BODY_DEPTH / 2)
  geo.computeVertexNormals()
  return geo
}

/**
 * 创建一台设备。默认按 1080x2340 竖屏比例，加载贴图后调用
 * fitDeviceToTexture 按真实比例重建机身与屏幕。
 */
export function createDeviceMesh() {
  const group = new THREE.Group()
  group.name = 'device'

  const frameMat = new THREE.MeshStandardMaterial({
    color: FRAME_COLOR,
    metalness: 0.9,
    roughness: 0.36,
  })

  const body = new THREE.Mesh(new THREE.BufferGeometry(), frameMat)
  body.name = 'body'
  group.add(body)

  const screen = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color: 0x05050a, toneMapped: false }),
  )
  screen.name = 'screen'
  screen.position.z = SCREEN_Z
  group.add(screen)

  // 侧边按键（右侧：音量 + 电源）
  const buttonMat = new THREE.MeshStandardMaterial({
    color: BUTTON_COLOR,
    metalness: 0.85,
    roughness: 0.4,
  })
  const volumeBtn = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.2, 0.028), buttonMat)
  volumeBtn.name = 'btn-volume'
  const powerBtn = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.12, 0.028), buttonMat)
  powerBtn.name = 'btn-power'
  group.add(volumeBtn, powerBtn)

  group.userData.body = body
  group.userData.screen = screen
  group.userData.buttons = [volumeBtn, powerBtn]

  fitDeviceToAspect(group, 1080 / 2340)
  return group
}

/** 按屏幕宽高比重建机身/屏幕几何（截图加载完成后调用） */
export function fitDeviceToAspect(device, aspect) {
  if (!device || !aspect) return
  const maxAspect = SCREEN_MAX_W / SCREEN_MAX_H
  let sw
  let sh
  if (aspect > maxAspect) {
    sw = SCREEN_MAX_W
    sh = SCREEN_MAX_W / aspect
  } else {
    sh = SCREEN_MAX_H
    sw = SCREEN_MAX_H * aspect
  }

  const bw = sw + BEZEL * 2
  const bh = sh + BEZEL * 2
  const bodyR = Math.min(0.17, bw * 0.19, bh * 0.12)
  const screenR = Math.max(0.04, bodyR - BEZEL * 0.7)

  const body = device.userData.body
  const screen = device.userData.screen
  const [volumeBtn, powerBtn] = device.userData.buttons

  body.geometry.dispose()
  body.geometry = createBodyGeometry(bw, bh, bodyR)

  screen.geometry.dispose()
  screen.geometry = createRoundedRectGeometry(sw, sh, screenR)
  screen.position.z = SCREEN_Z

  volumeBtn.position.set(bw / 2 + 0.006, sh * 0.18, 0)
  powerBtn.position.set(bw / 2 + 0.006, sh * 0.18 - 0.3, 0)

  device.userData.screenSize = { width: sw, height: sh, radius: screenR }
  device.userData.bodySize = { width: bw, height: bh, depth: BODY_DEPTH }
}

/** 按贴图真实比例适配设备，并把贴图贴到屏幕上 */
export function applyScreenTexture(device, tex) {
  if (!device || !tex) return
  const img = tex.image
  if (img?.width && img?.height) fitDeviceToAspect(device, img.width / img.height)
  const screen = device.userData.screen
  screen.material.map = tex
  screen.material.color.set(0xffffff)
  screen.material.needsUpdate = true
}

/** 设备压暗/提亮（乘在屏幕颜色上），frame 不变 */
export function setDeviceBrightness(device, v) {
  const screen = device?.userData.screen
  if (screen?.material) screen.material.color.setRGB(v, v, v)
}

/**
 * 椭圆接触阴影：径向渐变 canvas 贴图，贴在 y=0 平面上。
 */
export function createContactShadow({ width = 1.7, depth = 0.85, opacity = 0.6 } = {}) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.9)')
  g.addColorStop(0.5, 'rgba(0,0,0,0.38)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 2
  return mesh
}

/**
 * 预模糊贴图：把已加载的截图画到 canvas 上做高斯模糊，
 * 用于「假景深」——背景/非焦点设备直接贴模糊图，零运行时开销。
 */
export function createBlurredTexture(srcTex, { blur = 9, brightness = 0.62, width = 192 } = {}) {
  const img = srcTex?.image
  if (!img?.width || !img?.height) return null
  const w = width
  const h = Math.round((width * img.height) / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.filter = `blur(${blur}px) brightness(${brightness})`
  // 放大绘制，避免模糊边缘透出透明边
  const bleed = blur * 2.2
  ctx.drawImage(img, -bleed, -bleed, w + bleed * 2, h + bleed * 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

/** 深色反光台面：Reflector 真反射 + 深色半透明罩层压暗，营造抛光黑玻璃感 */
export async function createReflectiveFloor({ size = 14, tint = 0x0a0a14, darkness = 0.72 } = {}) {
  const { Reflector } = await import('three/examples/jsm/objects/Reflector.js')
  const reflector = new Reflector(new THREE.CircleGeometry(size, 64), {
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x808090,
    clipBias: 0.003,
  })
  reflector.rotation.x = -Math.PI / 2
  reflector.position.y = 0

  const veil = new THREE.Mesh(
    new THREE.CircleGeometry(size, 64),
    new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: darkness,
      depthWrite: false,
    }),
  )
  veil.rotation.x = -Math.PI / 2
  veil.position.y = 0.001
  veil.renderOrder = 1

  const group = new THREE.Group()
  group.add(reflector, veil)
  group.userData.reflector = reflector
  return group
}

export { disposeObject }
