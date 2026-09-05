import * as THREE from 'three'

export function disposeMaterial(material) {
  if (!material) return
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial)
    return
  }
  for (const key of [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
  ]) {
    if (material[key]?.dispose) material[key].dispose()
  }
  material.dispose?.()
}

export function disposeObject(object) {
  if (!object) return
  object.traverse?.((child) => {
    // 带 cached 标记的几何由 clearDeviceGeometryCache 统一释放，拆单个对象时跳过
    if (child.geometry && !child.geometry.userData?.cached) {
      child.geometry.dispose()
    }
    if (child.material) disposeMaterial(child.material)
  })
}

export function createRoundedRectShape(width, height, radius) {
  const x = -width / 2
  const y = -height / 2
  const r = Math.min(radius, width / 2, height / 2)
  const shape = new THREE.Shape()
  shape.moveTo(x + r, y)
  shape.lineTo(x + width - r, y)
  shape.quadraticCurveTo(x + width, y, x + width, y + r)
  shape.lineTo(x + width, y + height - r)
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  shape.lineTo(x + r, y + height)
  shape.quadraticCurveTo(x, y + height, x, y + height - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  return shape
}

/** 带正确 UV 的圆角矩形平面，贴图完整显示且不裁切圆角区域 */
export function createRoundedRectGeometry(width, height, radius, curveSegments = 24) {
  const shape = createRoundedRectShape(width, height, radius)
  const geo = new THREE.ShapeGeometry(shape, curveSegments)
  // Shape 已以原点为中心，无需 center()；补 UV
  const pos = geo.attributes.position
  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i)
    const py = pos.getY(i)
    uvs[i * 2] = (px + width / 2) / width
    uvs[i * 2 + 1] = (py + height / 2) / height
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.computeVertexNormals()
  return geo
}

export function createRoundedEdgeGeometry(width, height, radius, segments = 48) {
  const shape = createRoundedRectShape(width, height, radius)
  const points = shape.getPoints(segments)
  return new THREE.BufferGeometry().setFromPoints(
    points.map((p) => new THREE.Vector3(p.x, p.y, 0.003)),
  )
}

const DEFAULT_W = 0.96
const DEFAULT_H = 2.04
/** 圆角半径（世界单位），轻微圆角 */
const DEFAULT_RADIUS = 0.055

/**
 * 纯截图卡片：正反面同图 + 圆角 + 细描边
 */
export function createPhoneMesh() {
  const group = new THREE.Group()
  const width = DEFAULT_W
  const height = DEFAULT_H
  const radius = DEFAULT_RADIUS

  const matOpts = {
    color: 0x1a1630,
    toneMapped: false,
    side: THREE.FrontSide,
  }

  const front = new THREE.Mesh(
    createRoundedRectGeometry(width, height, radius),
    new THREE.MeshBasicMaterial(matOpts),
  )
  front.name = 'screen'
  front.position.z = 0.001
  group.add(front)

  // 背面独立 mesh：同贴图，绕 Y 翻转朝外，避免黑色背面
  const back = new THREE.Mesh(
    createRoundedRectGeometry(width, height, radius),
    new THREE.MeshBasicMaterial({ ...matOpts }),
  )
  back.name = 'screen-back'
  back.rotation.y = Math.PI
  back.position.z = -0.001
  group.add(back)

  group.userData.screen = front
  group.userData.screenBack = back
  group.userData.screenSize = { width, height, radius }
  return group
}

export { DEFAULT_W, DEFAULT_H, DEFAULT_RADIUS }
