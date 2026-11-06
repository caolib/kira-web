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
- 页面布局与动效：`src/styles/main.css`；主站与分享页共享深浅主题色板：`public/theme.css`
- Logo：`public/logo.png`
- 图标：统一从 `src/icons.js` 导入。该文件直接引用 lucide 的单个图标文件，避免打包时遍历整包上千个 ESM 模块（EdgeOne 构建沙箱句柄上限较低，会触发 EMFILE）；新增图标时在 `src/icons.js` 中补充对应路径
- 最新截图：`public/screenshots/reading-edition/`，10 个界面、18 张源图，共 36 个 WebP 文件
  - `.webp` 为压缩展示图，`-full.webp` 为原尺寸无损预览；八个界面另有 `-dark.webp` / `-dark-full.webp`，只有竖屏漫画阅读和横屏跨页共用深浅截图
  - `ScreenshotImage.vue` 与 `resolveScreenshot()` 按实际主题选择展示图；打开中的预览也同步切换对应原图，不使用颜色反转模拟深色
  - 展示图最大 1200×2400；同一界面的深浅展示画布尺寸统一，不裁剪或拉伸，较短的漫画首页浅色图仅补齐底部。高清图保留各自原始尺寸
  - 高清图仅在打开预览时加载；非首屏图片懒加载。手动主题动画前预载视口内目标展示图，最多等待 600ms
  - 漫画详情与书架直接并排；书签与章节评论也在同一部分并排展示。横屏阅读与宽屏首页堆叠露边，每 5 秒交换前后位置，可点击后方截图或聚焦后按 Enter 切换，也可暂停；不显示「换一张」按钮
  - 截图堆叠在视口外、后台、鼠标悬停、键盘聚焦或预览打开时暂停；系统减少动态效果偏好下仅手动切换

使用 Python 和 Pillow 从源 PNG 重新生成截图（文件名映射见脚本；源图不修改）：

```bash
python -I scripts/build_screenshots.py --source /path/to/screenshots
```
- 字体：`public/fonts/`，中文汉仪有圆 55W，英文 Cascadia Code，均本地加载

字体按字形拆分为当前内容子集及扩展集，避免首屏加载完整中文字体。原字体文件不在仓库中；更新文案后可用 Python、fontTools 和 Brotli 重新生成：

```bash
python -I scripts/build_fonts.py --chinese /path/to/HYYouYuan-55W.ttf --latin /path/to/CascadiaCode.woff2
```

字体许可说明见 `public/fonts/NOTICE.txt`。**汉仪字体由用户提供，正式发布前必须确认网页嵌入授权。**

## 页面与交互

- 首页：`/`，章节链接 `#experience`、`#reading-flow`、`#download`。主标语为「翻开故事，让平凡的日常闪闪发光」，文字列顶对齐，避免被右侧高截图挤出大块顶部留白
- 「阅读，不被打断」将书签与章节评论合并展示，沿用编号、图标、短标题和细分隔线，强调续读、同文合并、AI 总结与疑似剧透遮挡。AI 功能需用户配置并开启；剧透遮挡依赖总结中的标记、可以点开，不保证识别全部剧透
- 右下角低调的回顶按钮由 `BackToTop.vue` 提供，滚动超过 600px 或视口高度的 80%（取较大值）才出现；保留 44px 点击区域和安全区，回顶后焦点返回导航，不改变路由。减少动态效果时立即回顶
- 指南：`#docs/getting-started`、`#docs/login`、`#docs/AI`；兼容旧 `#docs` 入口
- 顶部 GitHub 和主题入口均为纯图标按钮，桌面与手机直接可见；首页保留下载入口。主题按“自动 → 深色 → 浅色”循环，默认自动并实时跟随系统，使用 `localStorage` 的 `kira:theme` 保存偏好；存储不可用不影响当前页切换
- `public/theme.js` 在首屏绘制前恢复配色，主站与独立分享页共用初始化与色板，并同步跨标签页选择及浏览器 `theme-color`；分享页不另设主题按钮
- 手动改变实际明暗时，通过 View Transition + WAAPI 将新主题从按钮中心向外展开，两个方向均为 1000ms、`ease-out`；键盘操作使用同一圆心。实际明暗不变、系统更新、减少动态效果或 API 不可用时直接切换；动画异常安全降级，连点不叠加，结束或离页后清理快照动画和监听
- 深色主题为柔和深灰；八组应用界面使用原生深色截图、不叠加亮度滤镜。仅共用素材的两个漫画阅读界面及指南配图压暗至 85%；所有放大预览保持对应原图亮度，Logo 不变
- 首页和指南图片均支持键盘操作、原生 dialog 预览、整图适配与原始像素查看；预览内可用鼠标滚轮或 `+` / `-` 围绕光标缩放（100%–800%），放大后可拖动或滚动查看，按钮可一键回到整图或原始像素
- 首页十张截图展示 17 个用户选定的特点标签，文案由 `src/content/site.js` 的 `tags` 独立维护，不再用图片名称充当特点。桌面和手机均保留所有标签；名称仅用于图片替代文本、操作名称及放大预览，不再另外显示图名
  - 标签由 `ScreenshotTag.vue` 统一呈现，使用共享主题色；绝对定位到截图周围现有留白，不参与截图宽高、排版及区块高度计算。保留原有大截图和并排布局，不为标签缩图或增大间距；首屏左上标签利用倾斜截图角落的空白，宽屏标签不随图片换位
  - 生成动画选框同步标签的独立 translate、rotate、scale 与 transform，避免选框和标签错位
  - 截图和标签生成完成后，标签以 5.8 / 6.4 秒错峰轻浮动，仅动画化 transform；桌面幅度 6px、手机 3px。这是持续装饰动效的局部例外，无常驻 JS 帧循环或定时器
  - 首屏、漫画、书签与评论组合、小说各自管理可见性与交互暂停，宽屏标签复用截图轮换的暂停状态。对应区域离屏、页面后台、指针悬停、键盘聚焦或任意预览打开时暂停；系统减少动态效果或缺少 IntersectionObserver 时静态展示。离开首页时清理观察器、监听及 CSS 动画；标签不拦截图片点击，也不进入原图预览
- 顶部导航、首页正文和页脚采用无鼠标光标的全页分组生成动画：标题与文字逐字/逐行生成，截图先描绘轮廓再展开画面，卡片、标签和列表分别生成；生成期间显示 Figma 式编辑器选中框：品牌绿色 1px 直角细线、约 8% 不透明度同色填充和四角小方形控制点，不显示输入插入点
  - 每个小组第一次真正进入视口才开始；手机下方尚未可见的段落不会随同一章节提前播放。桌面、平板、手机和手机横屏使用相同效果，仅适配尺寸、换行和触发位置
  - 播放记录只保存在当前 Document 内：滚回或从指南返回时已播组不重播，未见组仍可播放；完整刷新创建新 Document 并重播，不依赖 sessionStorage 或 localStorage，旧存储标记和禁用存储不影响动画
  - 正在播放的组离屏、页面进入后台、视口变化或用户操作时直接完成，未见组不因此丢失播放资格；字体或图片准备失败、超时则静态呈现，不阻塞导航、下载或预览
  - 临时选中框、四角控制点和 SVG 描边仅作装饰，不接收指针事件，不进入无障碍树；完成或中断后删除临时层、取消动画填充效果，不改动最终文字内容和布局
- 顶部导航、首页正文、页脚各自共用一个 IntersectionObserver，并共享 Document 播放记录和临时定位引用；按真实文字与组件几何生成短时 WAAPI 裁剪、描边和选中框动画，已完成组停止观察，无常驻逐帧测量或滚动接管。手机导航菜单首次展开后登记新组，同一 Document 内再次打开不重播；导航 GitHub、主题和菜单按钮始终保留可见图标及点击区域。宽屏截图在生成期间暂停自动轮换，生成结束后仍遵守离屏、后台、悬停、聚焦和预览暂停规则
- 尊重 `prefers-reduced-motion`，直接显示完整静态内容；离开首页时清理观察器、动画、定时器和事件监听，迟到的字体或图片不会重新启动已结束的演出

## 测试

```bash
pnpm test
# 先启动 pnpm dev 或 pnpm preview，再运行浏览器回归
pnpm test:browser
```

浏览器测试使用 `playwright-core`，不下载浏览器。自动寻找系统 Chrome / Edge / Chromium，也可通过 `BROWSER_PATH` 指定可执行文件，通过 `TEST_BASE_URL` 指定服务地址。

覆盖 320/375/768/812/1024/1440/1920 宽度、横屏、200% 字号、预览焦点、整图适配、滚轮缩放与拖动平移、指南深链与历史导航、下载选择、分享页、减少动态效果和空闲动画停止。

分组生成回归在 `tests/hero-assembly.mjs` 中运行（沿用文件名，覆盖范围已是全页），由 `pnpm test:browser` 一并执行。测试暂停并定位真实 WAAPI 时间线，检查文字 clip 的逐字推进、换行及真实字形位置，临时选中框的绿色细线、淡填充、四角控制点、可见性和删除，以及无输入插入点、图片轮廓到画面的阶段、完成态 DOM 文字与几何不变；另覆盖顶部导航、手机菜单、页脚及漫画、书签与评论、宽屏、小说、下载、FAQ 独立生成，菜单重复展开、头尾链接可操作性、同尺寸 resize 与真实旋转的区别、桌面/手机仅向下分步滚动时小说标题与段落及时生成、手机未见段落、完整刷新、指南往返、旧存储标记与禁用存储、交互中断、后台/快速滚动/resize、慢字体与卸载异步清理，并用正常时钟验证自然结束。

标签回归在 `tests/hero-tags.mjs` 中执行，覆盖各断点十图十七个特点标签、深浅色、200% 字号、旋转后实际图形不重叠（含浮动最高点）、隐藏标签前后截图尺寸与页面高度不变、标签选框定位、入场后飘动、分区暂停、预览及堆叠切换、减少动态效果与卸载清理；截图保存为 `artifacts/screenshot-tags-*.png` 和 `artifacts/tag-frame-alignment-*.png`。

主题回归在 `tests/theme-browser.mjs` 中执行，覆盖三态循环、系统实时变化、刷新/跨标签页/分享页同步、原生深浅截图和压暗边界、预览打开时切换主题与尺寸稳定、首屏恢复、键盘圆心、双向圆形快照、连点、API 和存储失败降级、动态减少效果与自然结束清理，并保存 `theme-*.png`。主浏览器回归还检查切换主题后横屏截图继续自动轮换。状态与深浅色对比度单元测试位于 `tests/theme.test.js`；截图元数据、变体文件存在性及解析往返在 `tests/screenshots.test.js` 中验证。

回顶回归在 `tests/back-to-top.mjs` 中执行，覆盖桌面和手机、显隐阈值、稳定态点击区域、鼠标和键盘、焦点恢复、指南路由保持，以及减少动态效果下的立即回顶。

截图保存在被 Git 忽略的 `artifacts/`：`assembly-{1440,768,375}-{middle,complete}.png` 为首屏生成中期/完成态，`assembly-{1440,375}-{分组名}-{middle,complete}.png` 为桌面及手机的下方区块，另保存导航/手机菜单、页脚、横屏和 200% 字号的生成态。原响应式、指南、预览和分享页截图仍保留。

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
