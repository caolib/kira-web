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
    rollupOptions: {
      // 限制并发文件读取，兼容构建沙箱较低的句柄上限。
      maxParallelFileOps: 4,
    },
  },
})
