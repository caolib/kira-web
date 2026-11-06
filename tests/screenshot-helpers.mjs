export const screenshotRegions = [
  ['hero', '.hero-art'], ['comic', '#experience .comic-spread'],
  ['reading-flow', '#reading-flow'],
  ['wide', '.screenshot-study'], ['novel', '.novel-spread'],
]

export async function loadScreenshots(page) {
  for (const [, selector] of screenshotRegions) {
    await page.locator(selector).scrollIntoViewIfNeeded()
    await page.locator(`${selector} img`).evaluateAll(images => Promise.all(images.map(image => image.decode())))
  }
}
