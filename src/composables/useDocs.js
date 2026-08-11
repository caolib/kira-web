import { ref, computed } from 'vue'
import { renderMarkdown } from './useMarkdown'

/**
 * 使用说明文档加载器。
 *
 * 构建时通过 import.meta.glob 扫描 src/content/docs/ 下所有 .md 文件
 * （eager + raw），按 frontmatter 的 order 字段升序排序后渲染为 HTML 缓存。
 * 在 md 文件顶部写 frontmatter 即可手动指定顺序：
 *   ---
 *   order: 1
 *   ---
 * 未写 order 的文档追加在最后，并按文件名兜底排序。
 * 新增 md 文件无需改动代码，侧边栏会自动出现条目。
 *
 * 本地图片：md 中以相对路径引用 assets/xxx.png，构建时通过 glob 以 url
 * 形式导入，渲染前替换为 Vite 解析出的资源 URL，否则浏览器会按页面 URL
 * 解析为 /assets/xxx 命中 SPA 回退，加载到 index.html 而非图片。
 */

const mdModules = import.meta.glob('@/content/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// 以 url 形式导入本地图片，得到构建后可访问的资源地址
const assetModules = import.meta.glob('@/content/docs/assets/*', {
  query: '?url',
  import: 'default',
  eager: true,
})

// 文件名 -> URL 映射，用于改写 md 中的相对图片路径
const assetMap = {}
for (const [path, url] of Object.entries(assetModules)) {
  const name = path.split('/').pop()
  assetMap[name] = url
}

// 把 md 中的 assets/<name> 改写为 Vite 解析出的真实 URL。
// 同时覆盖两种写法：markdown 图片 ![alt](assets/xxx) 与
// HTML <img src="assets/xxx" ...>（Typora 缩放图片导出为 <img>）
function rewriteImages(raw) {
  const rewrite = (m, prefix, name, suffix) => {
    const url = assetMap[name]
    return url ? `${prefix}${url}${suffix}` : m
  }
  return raw
    .replace(/!\[([^\]]*)\]\(assets\/([^)]+)\)/g, (m, alt, name) =>
      rewrite(m, `![${alt}](`, name, ')'),
    )
    .replace(/(<img[^>]*\bsrc=["'])assets\/([^"']+)(["'])/gi, (m, pre, name, post) =>
      rewrite(m, pre, name, post),
    )
}

// 匹配文件开头的 frontmatter 块（--- ... ---），支持 CRLF
const FRONTMATTER_RE = /^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/

// 解析 frontmatter：仅识别简单 key: value，提取数字/字符串
function parseFrontmatter(raw) {
  const m = raw.match(FRONTMATTER_RE)
  if (!m) return { meta: {}, body: raw }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.+?)\s*$/)
    if (!kv) continue
    const v = kv[2].trim()
    const num = Number(v)
    meta[kv[1]] = Number.isFinite(num) && v !== '' ? num : v
  }
  return { meta, body: raw.slice(m[0].length) }
}

// 从文件首行 # 标题提取文档名；无则用文件名（去扩展名）
function extractTitle(body, fileName) {
  const m = body.match(/^\s*#\s+(.+?)\s*$/m)
  return m ? m[1].trim() : fileName.replace(/\.md$/i, '')
}

// 组装文档列表：按 frontmatter order 升序，无 order 者追加在后并按文件名兜底
const docs = ref(
  Object.entries(mdModules)
    .map(([path, raw]) => {
      const fileName = path.split('/').pop() || path
      const id = fileName.replace(/\.md$/i, '')
      const { meta, body } = parseFrontmatter(raw)
      const processed = rewriteImages(body)
      return {
        id,
        fileName,
        path,
        order: Number.isFinite(meta.order) ? meta.order : Infinity,
        title: extractTitle(body, fileName),
        raw,
        html: renderMarkdown(processed),
      }
    })
    .sort(
      (a, b) =>
        a.order - b.order ||
        (Number.isFinite(a.order) === Number.isFinite(b.order)
          ? a.fileName.localeCompare(b.fileName, 'zh-CN')
          : 0),
    ),
)

const currentId = ref(docs.value[0]?.id || '')

const currentDoc = computed(
  () => docs.value.find((d) => d.id === currentId.value) || docs.value[0] || null,
)

export function useDocs() {
  function select(id) {
    if (docs.value.some((d) => d.id === id)) currentId.value = id
  }

  return { docs, currentId, currentDoc, select }
}
