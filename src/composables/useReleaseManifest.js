import { onScopeDispose, ref } from 'vue'
import { parseReleaseManifest } from '../utils/releases.js'

export function useReleaseManifest(url, repoUrl) {
  const release = ref(null)
  const status = ref('loading')
  let controller = null
  let timer = null
  let disposed = false

  async function reload() {
    if (controller || disposed) return
    release.value = null
    status.value = 'loading'
    controller = new AbortController()
    const request = controller
    timer = setTimeout(() => request.abort(), 12000)
    try {
      const response = await fetch(url, { signal: request.signal, credentials: 'omit', cache: 'no-store' })
      if (!response.ok) throw new Error(`Release manifest: HTTP ${response.status}`)
      const manifest = parseReleaseManifest(await response.json(), repoUrl)
      if (!disposed) {
        release.value = manifest
        status.value = 'ready'
      }
    } catch {
      // 网络、跨域、超时或清单错误均不展示旧链接，也不回退到发布页。
      if (!disposed) status.value = 'error'
    } finally {
      clearTimeout(timer)
      controller = null
    }
  }

  onScopeDispose(() => {
    disposed = true
    clearTimeout(timer)
    controller?.abort()
  })
  void reload()

  return { release, status, reload }
}
