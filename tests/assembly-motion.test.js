import assert from 'node:assert/strict'
import test from 'node:test'
import { claimGroupPlayback, hasGroupPlayback, lineClipFrames, settle, strokeFrames } from '../src/utils/assemblyMotion.js'

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`)
const lines = [
  { top: 3, bottom: 23, left: 0, right: 48, ends: [12, 24, 36, 48] },
  { top: 31, bottom: 51, left: 8, right: 44, ends: [20, 32, 44] },
]

function checkOffsets(frames) {
  assert.equal(frames[0].offset, 0)
  assert.equal(frames.at(-1).offset, 1)
  frames.forEach((frame, index) => {
    assert.ok(frame.offset >= 0 && frame.offset <= 1)
    if (index) assert.ok(frame.offset >= frames[index - 1].offset)
  })
}

test('播放记录按 Document 和小组隔离，返回已播组不重播，未见组仍可领取', () => {
  const document = {}
  const refreshed = {}
  assert.equal(hasGroupPlayback(document, 'hero-title'), false)
  assert.equal(claimGroupPlayback(document, 'hero-title'), true)
  assert.equal(hasGroupPlayback(document, 'hero-title'), true)
  assert.equal(claimGroupPlayback(document, 'hero-title'), false)
  assert.equal(hasGroupPlayback(document, 'novel-description'), false)
  assert.equal(claimGroupPlayback(document, 'novel-description'), true)
  assert.equal(hasGroupPlayback(refreshed, 'hero-title'), false)
  assert.equal(claimGroupPlayback(refreshed, 'hero-title'), true)
  assert.equal(hasGroupPlayback(refreshed, 'novel-description'), false)
})

test('边框缓动端点准确、单调、对称，首尾缓停', () => {
  assert.equal(settle(0), 0)
  assert.equal(settle(1), 1)
  assert.ok(settle(0.01) < 0.00001)
  let previous = 0
  for (let index = 0; index <= 100; index++) {
    const value = settle(index / 100)
    assert.ok(value >= previous && value <= 1)
    close(value + settle(1 - index / 100), 1)
    previous = value
  }
  for (const length of [0, 1, 120, 1837.25]) {
    const frames = strokeFrames(length)
    checkOffsets(frames)
    assert.equal(frames[0].strokeDashoffset, length)
    assert.equal(frames.at(-1).strokeDashoffset, 0)
    frames.forEach((frame, index) => {
      assert.equal(frame.strokeDasharray, `${length} ${length}`)
      close(frame.strokeDashoffset, length * (1 - settle(frame.offset)))
      if (index) assert.ok(frame.strokeDashoffset <= frames[index - 1].strokeDashoffset)
    })
  }
})

for (const typed of [true, false]) {
  test(`${typed ? '逐字' : '逐行'}裁剪保持真实行边界与换行进度，最后解除裁剪`, () => {
    const clips = lineClipFrames(lines, 100, 60, typed)
    checkOffsets(clips)
    assert.equal(clips.at(-1).clipPath, 'inset(-4px)')
    const polygons = clips.slice(0, -1).map(clip => ({
      ...clip,
      points: [...clip.clipPath.matchAll(/([-\d.]+)px ([-\d.]+)px/g)].map(match => match.slice(1).map(Number)),
    }))
    polygons.forEach((clip, index) => {
      assert.equal(clip.easing, typed ? 'steps(1, end)' : 'linear')
      const line = lines.find(line => line.bottom + 4 === clip.points[4][1])
      assert.ok(line)
      assert.equal(clip.points[2][1], Math.max(0, line.top - 4))
      assert.ok(clip.points[3][0] >= line.left - 4 && clip.points[3][0] <= line.right + 4)
      if (index && clip.points[2][1] !== polygons[index - 1].points[2][1]) {
        assert.equal(clip.offset, polygons[index - 1].offset, '换行直接跳到下一行，不扫过行间空白')
        assert.equal(clip.points[3][0], line.left - 4)
      }
    })
    if (typed) {
      for (const line of lines) {
        const positions = polygons.filter(clip => clip.points[4][1] === line.bottom + 4).map(clip => clip.points[3][0])
        for (const end of line.ends) assert.ok(positions.includes(end + 1), '逐字裁剪必须覆盖每个真实字形末端')
      }
    }
  })
}

test('空行和不可测量尺寸安全退化，不生成无效坐标', () => {
  assert.deepEqual(lineClipFrames([], 100, 60, true), [])
  for (const width of [0, -1]) assert.deepEqual(lineClipFrames(lines, width, 60), [])
  for (const height of [0, -1]) assert.deepEqual(lineClipFrames(lines, 100, height), [])
  lineClipFrames(lines, 100, 60, true).forEach(frame => assert.doesNotMatch(frame.clipPath, /NaN|Infinity/))
})
