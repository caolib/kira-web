# Kira Web

Kira 漫画与轻小说阅读器官网。Vue 3 + Vite，原生 CSS，纸感编辑式布局；首页、使用指南与静态分享页均适配手机。

## 开发与构建

需要 Node.js 20.19+ 或 22.12+，使用 pnpm。

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

部署目录是 `dist/`。网站不依赖后端服务。旧 Three.js 展台与相关依赖已移除。

## 内容与素材

- 文案、外链、截图元数据：`src/content/site.js`
- 首页：`src/components/HomePage.vue`
- 使用指南：`src/content/docs/*.md`，frontmatter 的 `order` 控制顺序
- 页面样式与设计变量：`src/styles/main.css`
- Logo：`public/logo.png`
- 最新截图：`public/screenshots/reading-edition/`，由产品提供的八张截图生成
  - `.webp` 为压缩展示图，`-full.webp` 为原尺寸无损预览
  - 高清图仅在打开预览时加载；非首屏图片懒加载
  - 漫画详情与书架直接并排；横屏阅读与宽屏首页堆叠露边，每 5 秒交换前后位置，也可手动切换或暂停
  - 截图堆叠在视口外、后台、鼠标悬停、键盘聚焦或预览打开时暂停；系统减少动态效果偏好下仅手动切换
- 字体：`public/fonts/`，中文汉仪有圆 55W，英文 Cascadia Code，均本地加载

字体按字形拆分为当前内容子集及扩展集，避免首屏加载完整中文字体。原字体文件不在仓库中；更新文案后可用 Python、fontTools 和 Brotli 重新生成：

```bash
python -I scripts/build_fonts.py --chinese /path/to/HYYouYuan-55W.ttf --latin /path/to/CascadiaCode.woff2
```

字体许可说明见 `public/fonts/NOTICE.txt`。**汉仪字体由用户提供，正式发布前必须确认网页嵌入授权。**

## 页面与交互

- 首页：`/`，章节链接 `#experience`、`#download`
- 指南：`#docs/getting-started`、`#docs/login`、`#docs/AI`；兼容旧 `#docs` 入口
- 首页和指南图片均支持键盘操作、原生 dialog 预览、整图适配与原始像素查看
- 动效使用短时 transform / opacity；章节通过 IntersectionObserver 进入一次后解绑，截图堆叠按间隔交换，无常驻逐帧动画
- 尊重 `prefers-reduced-motion`，不接管滚动、不使用持续逐帧监听

## 测试

```bash
pnpm test
# 先启动 pnpm dev 或 pnpm preview，再运行浏览器回归
pnpm test:browser
```

浏览器测试使用 `playwright-core`，不下载浏览器。自动寻找系统 Chrome / Edge / Chromium，也可通过 `BROWSER_PATH` 指定可执行文件，通过 `TEST_BASE_URL` 指定服务地址。

覆盖 320/375/768/812/1024/1440/1920 宽度、横屏、200% 字号、预览焦点与整图适配、指南深链与历史导航、下载选择、分享页、减少动态效果和空闲动画停止。截图输出到被 Git 忽略的 `artifacts/`。

## 漫画分享落地页

- `public/c/index.html` 是独立静态页，不经过 Vue 路由。正式地址：`https://kirakira.dpdns.org/c/?w={pathWord}`。
- `public/c/share-link.js` 对标识进行完整 ASCII 校验，对齐 App 解码行为，不截断非法后缀。
- 合法链接自动尝试一次 `kira://open/comic/{pathWord}`，同时提供手动打开与 GitHub Releases 下载；不声称能检测安装或已成功打开。
- 保留 `/comic/{pathWord}` 的解析兼容，但**未配置该旧路径的部署重写**。
- 使用真实 `/c/` 静态目录，避免 Cloudflare Pages 的 SPA 回退与 `_redirects` 200 重写冲突。Vite 配置也为本地开发/预览保留了这个入口。
- `public/.well-known/assetlinks.json` 是 Android App Links 验证文件（`io.github.caolib.kira` + release 证书指纹），**换签名证书后必须更新**。
- 网站域名须与产品仓库 `lib/utils/kira_links.dart` 的 `KiraLinks.webHost` 及 Android HTTPS intent-filter host 保持一致。
- 浏览器测试不替代 Android 真机上的应用唤起验证。

产品仓库与下载：<https://github.com/caolib/kira> · <https://github.com/caolib/kira/releases>
