// 只记录真正进入视口的组；刷新创建新 Document，路由往返沿用旧记录。
const playedDocuments = new WeakMap()

export function hasGroupPlayback(document, id) {
  return playedDocuments.get(document)?.has(id) || false
}

export function claimGroupPlayback(document, id) {
  if (hasGroupPlayback(document, id)) return false
  if (!playedDocuments.has(document)) playedDocuments.set(document, new Set())
  playedDocuments.get(document).add(id)
  return true
}

export function settle(t) {
  return t * t * t * (10 + t * (-15 + 6 * t))
}

export function strokeFrames(length) {
  return Array.from({ length: 17 }, (_, index) => ({
    offset: index / 16,
    strokeDasharray: `${length} ${length}`,
    strokeDashoffset: length * (1 - settle(index / 16)),
  }))
}

function lineProgress(lines, typed) {
  const points = []
  const total = typed ? lines.reduce((count, line) => count + line.ends.length + 2, 0) : lines.length
  let cursor = 0
  const point = (line, offset, edge) => ({ line, offset, edge, easing: typed ? 'steps(1, end)' : 'linear' })
  for (const line of lines) {
    points.push(point(line, cursor / total, line.left - 4))
    if (typed) {
      for (const x of line.ends) {
        cursor++
        points.push(point(line, cursor / total, x + 1))
      }
      cursor += 2
    } else {
      points.push(point(line, (cursor + 0.84) / total, line.right + 4))
      cursor++
    }
    points.push(point(line, cursor / total, line.right + 4))
  }
  return points
}

// 已完成的行保留，当前行逐字显现；换行停顿不拆改真实文字节点。
export function lineClipFrames(lines, width, height, typed = false) {
  if (!lines.length || width <= 0 || height <= 0) return []
  const pad = 4
  const frames = lineProgress(lines, typed).map(({ line, offset, edge, easing }) => {
    const top = Math.max(0, line.top - pad)
    const bottom = Math.min(height + pad, line.bottom + pad)
    return {
      offset, easing,
      clipPath: `polygon(${-pad}px ${-pad}px, ${width + pad}px ${-pad}px, ${width + pad}px ${top}px, ${edge}px ${top}px, ${edge}px ${bottom}px, ${-pad}px ${bottom}px)`,
    }
  })
  frames.push({ offset: 1, clipPath: `inset(${-pad}px)` })
  return frames
}

