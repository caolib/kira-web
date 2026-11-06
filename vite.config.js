import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 本地开发/预览与静态部署保持一致，避免 /c/ 被首页回退吞掉。
function shareEntry(server) {
  server.middlewares.use((request, response, next) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname === '/c/' || url.pathname === '/c') {
      request.url = `/c/index.html${url.search}`
    }
    next()
  })
}

export default defineConfig({
  plugins: [vue(), {
    name: 'static-share-entry',
    configureServer: shareEntry,
    configurePreviewServer: shareEntry,
  }],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // 保留 Vite 7 的兼容范围，升级构建工具不提高浏览器最低版本。
    target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
    cssTarget: ['chrome107', 'edge107', 'firefox104', 'safari16'],
  },
})
