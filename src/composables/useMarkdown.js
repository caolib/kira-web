import { marked } from 'marked'
import DOMPurify from 'dompurify'

/**
 * Markdown 渲染器（单例）。
 *
 * - marked 18：开启 GFM，不自动断行
 * - 通过 walkTokens + 自定义 blockquote renderer 实现 GFM 风格警告框
 *   （> [!NOTE/TIP/IMPORTANT/WARNING/CAUTION]）
 * - DOMPurify 消毒输出 HTML，class 默认在白名单内，确保 alert 样式类保留
 */

// 匹配 blockquote 首行的 [!TYPE] 标记（大小写不敏感）
const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*?\n?/i

// 五种 alert 的类名与标题文案
const ALERT_META = {
  note: { cls: 'note', label: 'Note' },
  tip: { cls: 'tip', label: 'Tip' },
  important: { cls: 'important', label: 'Important' },
  warning: { cls: 'warning', label: 'Warning' },
  caution: { cls: 'caution', label: 'Caution' },
}

// 内联 SVG 图标，随 alert 类型变化（lucide 风格，stroke=currentColor）
const ALERT_ICON = {
  note: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7H8a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V8.5h-.25a.75.75 0 0 1-.75-.75ZM8 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>',
  tip: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5A5.5 5.5 0 0 0 2.5 7c0 2.04 1.11 3.66 2.5 4.68V12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-.32c1.39-1.02 2.5-2.64 2.5-4.68A5.5 5.5 0 0 0 8 1.5ZM5.5 12.5v.25h5v-.25h-5Zm5.25 1.25h-5.5a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5Z"/></svg>',
  important: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0V3.75a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  warning: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.687a.25.25 0 0 0-.44 0L1.7 13.112a.25.25 0 0 0 .22.363h12.16a.25.25 0 0 0 .22-.363Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
  caution: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
}

marked.use({
  gfm: true,
  breaks: false,
  walkTokens(token) {
    if (token.type !== 'blockquote' || !token.tokens?.length) return
    const first = token.tokens[0]
    if (first?.type !== 'paragraph') return

    const m = first.text.match(ALERT_RE)
    if (!m) return

    const type = m[1].toLowerCase()
    token._alert = type
    // 从首段移除 [!TYPE] 标记行，使正文不再包含该标记
    first.text = first.text.replace(ALERT_RE, '')
    first.raw = first.raw.replace(ALERT_RE, '')
    if (first.tokens) {
      for (const t of first.tokens) {
        if (typeof t.text === 'string') t.text = t.text.replace(ALERT_RE, '')
        if (typeof t.raw === 'string') t.raw = t.raw.replace(ALERT_RE, '')
      }
    }
  },
  renderer: {
    blockquote(token) {
      // marked 18：renderer 接收完整 token 对象，用 this.parser 渲染子 tokens
      const body = this.parser.parse(token.tokens)
      if (token._alert && ALERT_META[token._alert]) {
        const meta = ALERT_META[token._alert]
        const icon = ALERT_ICON[token._alert] || ''
        return (
          `<blockquote class="markdown-alert markdown-alert-${meta.cls}">` +
          `<p class="markdown-alert-title"><span class="markdown-alert-icon">${icon}</span>${meta.label}</p>` +
          `${body}</blockquote>\n`
        )
      }
      return `<blockquote>${body}</blockquote>\n`
    },
  },
})

/**
 * 将 Markdown 文本渲染为已消毒的 HTML 字符串。
 * @param {string} mdText
 * @returns {string}
 */
export function renderMarkdown(mdText) {
  if (!mdText) return ''
  let rawHtml = marked.parse(mdText)
  // 外部链接在新标签打开，保持站内导航不被打断
  rawHtml = rawHtml.replace(
    /<a\s+(?![^>]*\btarget=)/gi,
    '<a target="_blank" rel="noopener noreferrer" ',
  )
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['target', 'rel'],
  })
}

export { marked }
