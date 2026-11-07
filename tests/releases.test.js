import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { site } from '../src/content/site.js'
import { useReleaseManifest } from '../src/composables/useReleaseManifest.js'
import { formatAssetSize, parseReleaseManifest } from '../src/utils/releases.js'
import { releaseManifest } from './release-fixture.js'

const flush = () => new Promise(resolve => setImmediate(resolve))
const response = () => ({ ok: true, json: async () => structuredClone(releaseManifest) })

function setup(t, fetcher) {
  t.mock.method(globalThis, 'fetch', fetcher)
  const scope = effectScope()
  const state = scope.run(() => useReleaseManifest(site.releaseManifestUrl, site.repoUrl))
  t.after(() => scope.stop())
  return { ...state, stop: () => scope.stop() }
}

test('读取发布清单，按平台识别安装包并优先展示 ARM64', () => {
  const data = { ...releaseManifest, assets: [...releaseManifest.assets].reverse() }
  const release = parseReleaseManifest(data, site.repoUrl)
  assert.equal(release.tag, 'v1.7.6')
  assert.deepEqual(release.assets.filter(asset => asset.platform === 'android').map(asset => asset.arch), ['arm64-v8a', 'armeabi-v7a', 'x86_64'])
  assert.equal(release.assets.find(asset => asset.platform === 'windows').label, 'Windows x64')
  assert.equal(formatAssetSize(30070797), '28.7 MB')
})

test('不接受错误的协议、版本或安装包列表', () => {
  for (const data of [null, {}, { ...releaseManifest, schema_version: 2 },
    { ...releaseManifest, version: '1.7.6-beta' }, { ...releaseManifest, tag: 'v1.7.5' },
    { ...releaseManifest, build_number: 0 }, { ...releaseManifest, build_number: '629' },
    { ...releaseManifest, build_number: 1.5 }, { ...releaseManifest, build_number: Number.MAX_SAFE_INTEGER + 1 },
    { ...releaseManifest, release_url: `${site.repoUrl}/releases/tag/v1.7.5` },
    { ...releaseManifest, release_url: 'https://example.com/releases/tag/v1.7.6' },
    { ...releaseManifest, assets: null }]) {
    assert.throws(() => parseReleaseManifest(data, site.repoUrl), /Invalid release manifest/)
  }
})

test('仅使用该仓库和版本的有效安装包直链，忽略未知平台、非法资产和重复项', () => {
  const valid = releaseManifest.assets[0]
  const assets = [valid, valid, null,
    ...['javascript:alert(1)', valid.download_url.replace('github.com', 'example.com'),
      valid.download_url.replace('v1.7.6/', 'v1.7.5/'),
      valid.download_url.replace('/caolib/kira/', '/other/kira/')].map(download_url => ({ ...valid, download_url })),
    { ...valid, platform: '__proto__' }, { ...valid, arch: 'constructor' },
    { ...valid, platform: 'macos' }, { ...valid, size: 0 }, { ...valid, size: '30070797' },
    { ...valid, name: 'kira-checksums.txt' }, { ...valid, name: {} },
  ]
  const release = parseReleaseManifest({ ...releaseManifest, assets }, site.repoUrl)
  assert.equal(release.assets.length, 1)
  assert.equal(release.assets[0].url, valid.download_url)
  assert.deepEqual(parseReleaseManifest({ ...releaseManifest, assets: [] }, site.repoUrl).assets, [])
})

test('安装包文件名必须与版本、构建号、平台和架构一致', () => {
  const android = releaseManifest.assets[0]
  const windows = releaseManifest.assets[3]
  const renamed = [
    [android, android.name.replace('v1.7.6', 'v1.7.5')],
    [android, android.name.replace('-629-', '-628-')],
    [android, android.name.replace('arm64-v8a', 'armeabi-v7a')],
    [android, 'kira-other.apk'],
    [windows, windows.name.replace('-setup', '')],
    [windows, windows.name.replace('x64', 'arm64')],
  ].map(([asset, name]) => ({ ...asset, name, download_url: `${site.repoUrl}/releases/download/v1.7.6/${name}` }))
  const release = parseReleaseManifest({ ...releaseManifest, assets: renamed }, site.repoUrl)
  assert.deepEqual(release.assets, [])
})

test('SHA-256 字段只接受完整的小写十六进制值，异常条目不影响其他安装包', () => {
  const asset = releaseManifest.assets[0]
  const invalid = [undefined, null, 123, '', 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), 'A'.repeat(64), `sha256:${'a'.repeat(64)}`]
    .map(sha256 => ({ ...asset, sha256 }))
  const windows = releaseManifest.assets[3]
  const release = parseReleaseManifest({ ...releaseManifest, assets: [...invalid, windows] }, site.repoUrl)
  assert.equal(release.assets.length, 1)
  assert.equal(release.assets[0].name, windows.name)
  assert.equal(release.assets[0].sha256, windows.sha256)
})

test('浏览器只请求配置的清单地址，成功前不提供安装包数据', async t => {
  const requests = []
  const state = setup(t, async (url, options) => { requests.push({ url, options }); return response() })
  assert.equal(state.status.value, 'loading')
  assert.equal(state.release.value, null)
  await flush()
  assert.equal(state.status.value, 'ready')
  assert.equal(state.release.value.assets.length, 4)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, site.releaseManifestUrl)
  assert.equal(requests[0].options.credentials, 'omit')
  assert.equal(requests[0].options.cache, 'no-store')
})

test('网络、HTTP、JSON 或协议错误均不留下下载数据，也不另请求兜底接口', async t => {
  const cases = {
    network: async () => { throw new TypeError('Failed to fetch') },
    http: async () => ({ ok: false, status: 404 }),
    json: async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token') } }),
    schema: async () => ({ ok: true, json: async () => ({ schema_version: 2 }) }),
  }
  for (const [name, fetcher] of Object.entries(cases)) {
    await t.test(name, async t => {
      let requests = 0
      const state = setup(t, (...args) => { requests++; return fetcher(...args) })
      await flush()
      assert.equal(state.status.value, 'error')
      assert.equal(state.release.value, null)
      assert.equal(requests, 1)
    })
  }
})

test('可以手动重试，不并发请求；再次读取失败时不沿用旧链接', async t => {
  let requests = 0
  const state = setup(t, async () => {
    if (++requests !== 2) throw new TypeError('Failed to fetch')
    return response()
  })
  await flush()
  assert.equal(state.status.value, 'error')
  const retry = state.reload()
  await state.reload()
  await retry
  assert.equal(requests, 2)
  assert.equal(state.status.value, 'ready')
  const failedRetry = state.reload()
  assert.equal(state.release.value, null)
  await failedRetry
  assert.equal(state.status.value, 'error')
  assert.equal(state.release.value, null)
})

test('12 秒超时中止请求，不显示下载数据', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal
  const state = setup(t, (_, options) => new Promise((_, reject) => {
    signal = options.signal
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  }))
  t.mock.timers.tick(12000)
  await flush()
  assert.equal(signal.aborted, true)
  assert.equal(state.status.value, 'error')
  assert.equal(state.release.value, null)
})

test('离开页面时中止请求，忽略迟到的响应', async t => {
  let resolve
  let signal
  const state = setup(t, (_, options) => {
    signal = options.signal
    return new Promise(done => { resolve = done })
  })
  state.stop()
  assert.equal(signal.aborted, true)
  resolve(response())
  await flush()
  assert.equal(state.release.value, null)
  assert.equal(state.status.value, 'loading')
})
