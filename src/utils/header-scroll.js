export function createHeaderScroll() {
  let lastY = 0
  let direction = 0
  let distance = 0
  let hidden = false

  function reset(y) {
    lastY = Math.max(0, y)
    direction = 0
    distance = 0
    hidden = false
    return hidden
  }

  function update(y, headerHeight, locked = false) {
    y = Math.max(0, y)
    if (locked || y <= headerHeight) return reset(y)
    const delta = y - lastY
    lastY = y
    if (!delta) return hidden
    const nextDirection = Math.sign(delta)
    if (nextDirection !== direction) distance = 0
    direction = nextDirection
    distance = Math.min(16, distance + Math.abs(delta))
    if (direction > 0 && distance >= 16) hidden = true
    if (direction < 0 && distance >= 8) hidden = false
    return hidden
  }

  return { reset, update }
}
