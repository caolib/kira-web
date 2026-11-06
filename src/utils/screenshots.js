export function resolveScreenshot(shot, theme) {
  if (!shot) return null
  const source = theme === 'dark' && shot.dark ? shot.dark : shot.light || shot
  return { ...shot, src: source.src, full: source.full }
}

export async function preloadScreenshotTheme(theme) {
  const sources = new Set([...document.querySelectorAll('img[data-theme-light]')]
    .filter(image => {
      const box = image.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
    })
    .map(image => theme === 'dark' ? image.dataset.themeDark || image.dataset.themeLight : image.dataset.themeLight))
  let timer
  try {
    await Promise.race([
      Promise.all([...sources].map(src => {
        const image = new Image()
        image.src = src
        return image.decode?.().catch(() => {})
      })),
      new Promise(resolve => { timer = window.setTimeout(resolve, 600) }),
    ])
  } finally { clearTimeout(timer) }
}
