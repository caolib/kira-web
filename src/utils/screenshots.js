export function resolveScreenshot(shot, theme) {
  if (!shot) return null
  const source = theme === 'dark' && shot.dark ? shot.dark : shot.light || shot
  return { ...shot, src: source.src, full: source.full }
}

const preloads = new Map()

function preloadScreenshot(src) {
  if (preloads.has(src)) return preloads.get(src)
  const ready = new Promise(resolve => {
    const image = new Image()
    const finish = success => {
      image.onload = image.onerror = null
      resolve(success)
    }
    if (typeof image.decode === 'function') {
      image.src = src
      image.decode().then(() => finish(true), () => finish(false))
    } else {
      image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0)
      image.onerror = () => finish(false)
      image.src = src
    }
  }).catch(() => false).then(success => {
    if (!success) preloads.delete(src)
    return success
  })
  preloads.set(src, ready)
  return ready
}

export async function preloadScreenshotTheme(theme) {
  const sources = new Set([...document.querySelectorAll('img[data-theme-light]')]
    .filter(image => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
    })
    .map(image => {
      const src = theme === 'dark' ? image.dataset.themeDark || image.dataset.themeLight : image.dataset.themeLight
      if (!src) return null
      const url = new URL(src, document.baseURI).href
      return url === (image.currentSrc || image.src) ? null : url
    })
    .filter(Boolean))
  return Promise.all([...sources].map(preloadScreenshot))
}
