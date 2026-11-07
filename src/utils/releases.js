const packages = {
  android: {
    'arm64-v8a': { label: 'ARM64', description: '大多数较新的 Android 手机和平板', order: 0 },
    'armeabi-v7a': { label: 'ARMv7', description: '较旧的 32 位 Android 设备', order: 1 },
    x86_64: { label: 'x86_64', description: '部分 64 位 Android 模拟器', order: 2 },
  },
  windows: {
    x64: { label: 'Windows x64', order: 0 },
  },
}

export function parseReleaseManifest(data, repoUrl) {
  if (data?.schema_version !== 1 || typeof data.version !== 'string' ||
      !/^\d+\.\d+\.\d+$/.test(data.version) || data.tag !== `v${data.version}` ||
      !Number.isSafeInteger(data.build_number) || data.build_number <= 0 ||
      data.release_url !== `${repoUrl}/releases/tag/${encodeURIComponent(data.tag)}` ||
      !Array.isArray(data.assets)) throw new Error('Invalid release manifest')

  const seen = new Set()
  const assets = data.assets.flatMap(asset => {
    if (!asset || typeof asset.platform !== 'string' || typeof asset.arch !== 'string') return []
    const variants = Object.hasOwn(packages, asset.platform) ? packages[asset.platform] : null
    const variant = variants && Object.hasOwn(variants, asset.arch) ? variants[asset.arch] : null
    if (!variant || !Number.isSafeInteger(asset.size) || asset.size <= 0 ||
        typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) return []
    const suffix = asset.platform === 'windows' ? `windows-${asset.arch}-setup.exe` : `${asset.arch}.apk`
    const name = `kira-${data.tag}-${data.build_number}-${suffix}`
    const url = `${repoUrl}/releases/download/${encodeURIComponent(data.tag)}/${encodeURIComponent(name)}`
    if (asset.name !== name || asset.download_url !== url || seen.has(name)) return []
    seen.add(name)
    return [{ name, platform: asset.platform, arch: asset.arch, size: asset.size, url, sha256: asset.sha256, ...variant }]
  }).sort((a, b) => a.order - b.order)

  return { version: data.version, tag: data.tag, assets }
}

export function formatAssetSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
