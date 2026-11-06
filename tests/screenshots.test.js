import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { site } from '../src/content/site.js'
import { resolveScreenshot } from '../src/utils/screenshots.js'

test('十个界面具有展示图与原图，八组配对主题，仅两个漫画阅读界面共用图片', () => {
  assert.equal(site.screenshots.length, 10)
  assert.equal(new Set(site.screenshots.map(shot => shot.id)).size, 10)
  assert.equal(site.screenshots.filter(shot => shot.dark).length, 8)
  assert.deepEqual(site.screenshots.filter(shot => shot.dimInDark).map(shot => shot.id).sort(), ['reader', 'spread'])
  for (const shot of site.screenshots) {
    for (const source of [shot.light, shot.dark].filter(Boolean)) {
      for (const path of [source.src, source.full]) assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), path)
    }
  }
})

test('主题解析同时切换展示图和高清原图，不改变标签、比例或原始元数据', () => {
  for (const shot of site.screenshots) {
    const dark = resolveScreenshot(shot, 'dark')
    assert.equal(dark.src, (shot.dark || shot.light).src)
    assert.equal(dark.full, (shot.dark || shot.light).full)
    assert.equal(dark.width, shot.width)
    assert.equal(dark.height, shot.height)
    assert.equal(dark.label, shot.label)
    assert.equal(shot.src, shot.light.src)
    assert.equal(resolveScreenshot(dark, 'light').src, shot.light.src, '从已解析的深色截图切回浅色，不能继续使用深色地址')
    assert.equal(resolveScreenshot(dark, 'light').full, shot.light.full)
  }
})

test('没有主题版本的指南图片与空预览仍沿用原地址', () => {
  const image = { label: '指南图片', src: '/guide.png', full: '/guide-full.png', width: 500, height: 800 }
  assert.deepEqual(resolveScreenshot(image, 'dark'), image)
  assert.equal(resolveScreenshot(null, 'dark'), null)
})
