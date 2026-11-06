import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { browserSuites, parseBrowserOptions, runBrowserSuites } from './browser-options.mjs'

const options = parseBrowserOptions(process.argv.slice(2))
if (options.help || options.list) {
  console.log(options.list ? browserSuites.join('\n') : `用法：pnpm test:browser [分组...] [--screenshots] [--jobs 1–4]
分组：${browserSuites.join(', ')}；默认 all，保留全量覆盖
--quick        仅桌面/手机核心流程，不包含专项与真实时钟轮换
--screenshots  保存视觉取证截图；已有失败诊断截图不受此开关影响
--jobs N       同时运行的分组数，默认 1，建议不超过 2
--list         列出分组`)
  process.exit(0)
}
if (options.screenshots) process.env.TEST_SCREENSHOTS = '1'
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
const executablePath = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(path => path && existsSync(path))
assert.ok(executablePath, '请用 BROWSER_PATH 指定本地 Chromium/Chrome 可执行文件')
const browser = await chromium.launch({ executablePath, headless: true })
const checks = {
  header: async () => (await import('./header-scroll.mjs')).checkAutoHideHeader(browser, base),
  'back-to-top': async () => (await import('./back-to-top.mjs')).checkBackToTop(browser, base),
  tags: async () => (await import('./hero-tags.mjs')).checkHeroTags(browser, base),
  theme: async () => (await import('./theme-browser.mjs')).checkThemes(browser, base),
  assembly: async () => (await import('./hero-assembly.mjs')).checkPageAssembly(browser, base),
  smoke: async () => (await import('./browser-smoke.mjs')).checkBrowserSmoke(browser, base, { quick: options.quick }),
  motion: async () => (await import('./browser-smoke.mjs')).checkScreenshotMotion(browser, base),
}
const started = performance.now()
console.log(`浏览器回归：${options.suites.join(', ')}；并发 ${options.jobs}；截图 ${process.env.TEST_SCREENSHOTS === '1' ? '开启' : '关闭'}`)
try {
  console.table(await runBrowserSuites(options.suites, name => checks[name](), options))
  console.log(`总耗时：${((performance.now() - started) / 1000).toFixed(2)}s`)
} finally {
  await browser.close()
}
