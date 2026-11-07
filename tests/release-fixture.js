import { site } from '../src/content/site.js'

export const releaseManifest = {
  schema_version: 1,
  version: '1.7.6',
  tag: 'v1.7.6',
  build_number: 629,
  release_url: `${site.repoUrl}/releases/tag/v1.7.6`,
  assets: [
    ['android', 'arm64-v8a', 30070797],
    ['android', 'armeabi-v7a', 28448785],
    ['android', 'x86_64', 31746407],
    ['windows', 'x64', 14471240],
  ].map(([platform, arch, size]) => {
    const suffix = platform === 'windows' ? `windows-${arch}-setup.exe` : `${arch}.apk`
    const name = `kira-v1.7.6-629-${suffix}`
    return { name, platform, arch, size, download_url: `${site.repoUrl}/releases/download/v1.7.6/${name}`, sha256: 'a'.repeat(64) }
  }),
}

export function mockReleaseManifest(page) {
  return page.route(site.releaseManifestUrl, route => route.fulfill({ json: releaseManifest }))
}
