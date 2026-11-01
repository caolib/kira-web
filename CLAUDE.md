# Kira Web

漫画与轻小说阅读器官网。详细工程说明以 README.md 为准，命令与依赖以 package.json 为准。

## 按任务查阅

- 页面、素材、字体或部署变更：先读 README.md 对应章节。
- 路由与导航：查看 src/App.vue；首页和指南使用 hash，漫画分享使用独立静态入口。
- 指南内容：查看 src/content/docs/；图片加载与净化分别由 src/composables/useDocs.js、src/composables/useMarkdown.js 处理。
- 产品功能、平台及登录文案：核验 Kira App 仓库，本机位置 C:/code/Flutter/kira；先读取该仓库自己的指令。令牌登录是补充方式，不代表 App 缺少普通账号登录。

## 兼容边界

- 保持 /c/?w={pathWord} 静态入口、应用深链、手动打开及下载兜底。分享解析调整须同步更新 tests/share-link.test.js。
- /.well-known/assetlinks.json、网站域名及 App 的链接配置相互关联；调整前阅读 README.md 的分享章节。
- 指南 HTML 沿用 Markdown 净化和图片路径改写流程。
- 图片预览默认整图适配，包括手机横屏；仅原始像素模式允许滚动。
- 动效保持短时、低开销；自动截图切换在不可见或交互期间暂停，尊重系统 reduced-motion，并清理定时器和监听器。
- 改文案或字体时，按 README.md 更新字体子集；保留字体许可说明，发布前确认汉仪字体网页嵌入授权。

## 验证

- 改动后运行 pnpm build 和 pnpm test。
- UI 或交互变更：启动网站后运行 pnpm test:browser，查看受影响页面的截图；生产产物可通过 TEST_BASE_URL=http://127.0.0.1:4173 指向预览服务。
- 浏览器回归不替代 Android 真机应用唤起验证；artifacts/ 是本地测试输出，不纳入提交。
