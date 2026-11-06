import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { browserSuites, browserViewports, quickViewports, parseBrowserOptions, runBrowserSuites } from './browser-options.mjs'
import { captureScreenshot, gotoReady } from './browser-helpers.mjs'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('默认保留全部浏览器分组与七个断点，快速模式只执行两个代表尺寸的烟测', () => {
  assert.deepEqual(parseBrowserOptions([]).suites, browserSuites)
  assert.equal(browserViewports.length, 7)
  assert.ok(browserSuites.includes('motion'))
  assert.deepEqual(parseBrowserOptions(['--quick']).suites, ['smoke'])
  assert.deepEqual(quickViewports.map(([width]) => width), [1440, 375])
  assert.equal(parseBrowserOptions([]).screenshots, false)
  assert.equal(parseBrowserOptions([]).jobs, 1)
})

test('支持组合分组、去重、截图开关及两种并发参数写法', () => {
  const options = parseBrowserOptions(['theme', 'tags', 'theme', '--', '--screenshots', '--jobs', '2'])
  assert.deepEqual(options.suites, ['theme', 'tags'])
  assert.equal(options.screenshots, true)
  assert.equal(options.jobs, 2)
  assert.equal(parseBrowserOptions(['--jobs=4']).jobs, 4)
  assert.deepEqual(parseBrowserOptions(['header', 'all']).suites, browserSuites)
  assert.equal(parseBrowserOptions(['--list']).list, true)
  assert.equal(parseBrowserOptions(['-h']).help, true)
})

test('拒绝未知分组、不合法并发和含混的快速模式组合', () => {
  for (const args of [['unknown'], ['--jobs'], ['--jobs', '0'], ['--jobs=5'], ['--jobs=1.5'], ['--jobs=NaN'], ['--quick', 'theme']]) {
    assert.throws(() => parseBrowserOptions(args))
  }
})

test('默认串行运行，并按分组记录耗时与开始/结束日志', async () => {
  const order = [], logs = []
  const results = await runBrowserSuites(['header', 'theme'], async name => {
    order.push(`start:${name}`)
    await Promise.resolve()
    order.push(`end:${name}`)
  }, { log: line => logs.push(line) })
  assert.deepEqual(order, ['start:header', 'end:header', 'start:theme', 'end:theme'])
  assert.deepEqual(results.map(result => result.suite), ['header', 'theme'])
  assert.ok(results.every(result => result.seconds >= 0))
  assert.equal(logs.length, 4)
})

test('并发不超过指定数量，结果仍保持请求顺序', async () => {
  const gate = deferred(), started = deferred()
  let active = 0, maximum = 0
  const running = runBrowserSuites(['header', 'theme', 'tags'], async () => {
    active++
    maximum = Math.max(maximum, active)
    if (active === 2) started.resolve()
    await gate.promise
    active--
  }, { jobs: 2, log() {} })
  await started.promise
  assert.equal(active, 2)
  gate.resolve()
  assert.deepEqual((await running).map(result => result.suite), ['header', 'theme', 'tags'])
  assert.equal(maximum, 2)
})

test('失败后停止分配新分组，等正在运行的分组清理后才返回错误', async () => {
  const gate = deferred(), failed = deferred()
  const visited = []
  let finished = false, settled = false
  const error = new Error('test failure')
  const running = runBrowserSuites(['header', 'theme', 'tags'], async name => {
    visited.push(name)
    if (name === 'header') {
      await Promise.resolve()
      failed.resolve()
      throw error
    }
    await gate.promise
    finished = true
  }, { jobs: 2, log() {} })
  const checked = assert.rejects(running, actual => actual === error).then(() => { settled = true })
  await failed.promise
  await Promise.resolve()
  assert.equal(settled, false)
  gate.resolve()
  await checked
  assert.equal(finished, true)
  assert.deepEqual(visited, ['header', 'theme'])
})

test('截图默认不执行、不创建目录；显式开启或失败取证时才调用 Playwright', async t => {
  const previous = process.env.TEST_SCREENSHOTS
  const directory = mkdtempSync(join(tmpdir(), 'kira-browser-test-'))
  t.after(() => {
    if (previous === undefined) delete process.env.TEST_SCREENSHOTS
    else process.env.TEST_SCREENSHOTS = previous
    rmSync(directory, { recursive: true, force: true })
  })
  const calls = []
  const target = { screenshot: async options => { calls.push(options); return Buffer.from('capture') } }
  const options = { path: join(directory, 'captures', 'example.png'), fullPage: true }
  delete process.env.TEST_SCREENSHOTS
  await captureScreenshot(target, options)
  assert.equal(calls.length, 0)
  assert.equal(existsSync(join(directory, 'captures')), false)
  process.env.TEST_SCREENSHOTS = '1'
  assert.equal((await captureScreenshot(target, options)).toString(), 'capture')
  delete process.env.TEST_SCREENSHOTS
  await captureScreenshot(target, options, { force: true })
  assert.deepEqual(calls, [options, options])
  assert.equal(existsSync(join(directory, 'captures')), true)
})

test('页面就绪等待具体内容、字体和可见图片，不等待网络静默或离屏懒加载图', async () => {
  for (const [url, selector] of [
    ['http://localhost/', '#hero-title'],
    ['http://localhost/#docs/login', '.prose-docs h1'],
    ['http://localhost/c/?w=invalid.value', '#status-title'],
  ]) {
    const events = []
    const image = (top, complete) => ({
      complete,
      getBoundingClientRect: () => ({ width: 100, height: 100, top, bottom: top + 100, left: 0, right: 100 }),
      decode: async () => { events.push(`decode:${top}`) },
    })
    const sandbox = {
      document: { fonts: { status: 'loaded', ready: Promise.resolve() }, images: [image(0, true), image(1000, false)], querySelector: () => ({ textContent: '链接已就绪' }) },
      innerWidth: 1440, innerHeight: 900,
      requestAnimationFrame: callback => { events.push('frame'); callback() },
    }
    const page = {
      url: () => url,
      goto: async (actual, options) => { assert.equal(actual, url); assert.deepEqual(options, { waitUntil: selector === '#status-title' ? 'commit' : 'domcontentloaded' }) },
      locator: actual => ({ waitFor: async () => { assert.equal(actual, selector); events.push('content') } }),
      waitForFunction: async (check, argument, options) => {
        assert.equal(options.timeout, 10000)
        assert.equal(runInNewContext(`(${check.toString()})()`, sandbox), true)
        if (check.toString().includes('link-state')) {
          sandbox.document.querySelector = () => ({ textContent: '等待验证' })
          assert.equal(runInNewContext(`(${check.toString()})()`, sandbox), false)
          sandbox.document.querySelector = () => ({ textContent: '链接无效' })
          assert.equal(runInNewContext(`(${check.toString()})()`, sandbox), true)
          return
        }
        sandbox.document.images[0].complete = false
        assert.equal(runInNewContext(`(${check.toString()})()`, sandbox), false)
        sandbox.document.images[0].complete = true
      },
      evaluate: check => runInNewContext(`(${check.toString()})()`, sandbox),
    }
    await gotoReady(page, url)
    assert.deepEqual(events, ['content', 'decode:0', 'frame', 'frame'])
  }
})
