import assert from 'node:assert/strict'
import test from 'node:test'
import { createHeaderScroll } from '../src/utils/header-scroll.js'

const height = 88

test('顶部区域始终显示，越过顶部后累计下滚 16px 隐藏', () => {
  const scroll = createHeaderScroll()
  assert.equal(scroll.update(88, height), false)
  assert.equal(scroll.update(89, height), false)
  assert.equal(scroll.update(103, height), false)
  assert.equal(scroll.update(104, height), true)
})

test('上滚累计 8px 恢复，轻微上滚不切换', () => {
  const scroll = createHeaderScroll()
  assert.equal(scroll.update(300, height), true)
  assert.equal(scroll.update(299, height), true)
  assert.equal(scroll.update(295, height), true)
  assert.equal(scroll.update(292, height), false)
})

test('方向改变会清空累计距离，零距离事件不干扰判断', () => {
  const scroll = createHeaderScroll()
  scroll.reset(200)
  assert.equal(scroll.update(210, height), false)
  assert.equal(scroll.update(205, height), false)
  assert.equal(scroll.update(205, height), false)
  assert.equal(scroll.update(215, height), false)
  assert.equal(scroll.update(221, height), true)
})

test('菜单或交互锁定时保持显示，解锁后重新累计', () => {
  const scroll = createHeaderScroll()
  assert.equal(scroll.update(300, height), true)
  assert.equal(scroll.update(320, height, true), false)
  assert.equal(scroll.update(335, height), false)
  assert.equal(scroll.update(336, height), true)
})

test('回到顶部与顶部回弹均恢复显示', () => {
  const scroll = createHeaderScroll()
  assert.equal(scroll.update(300, height), true)
  assert.equal(scroll.update(88, height), false)
  assert.equal(scroll.update(-20, height), false)
})

test('路由或窗口变化可重置为显示态，不保留上一页滚动距离', () => {
  const scroll = createHeaderScroll()
  assert.equal(scroll.update(300, height), true)
  assert.equal(scroll.reset(200), false)
  assert.equal(scroll.update(215, height), false)
  assert.equal(scroll.update(216, height), true)
})
