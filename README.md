# Kira Web

Kira 漫画阅读器产品展示站（单页）：Vue 3 + Vite + Three.js + Tailwind CSS。

## 开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
pnpm preview
```

## 内容

- 文案与链接：`src/content/site.js`
- 截图：`public/screenshots/`（来自产品 README 公开截图）
- Logo：`public/logo.png`

## 外链

- 仓库：https://github.com/caolib/kira
- Releases：https://github.com/caolib/kira/releases

## 漫画分享落地页

- `public/c/index.html`：独立的漫画分享落地页（不走 Vue 构建，纯静态 HTML/JS），
  分享链接形如 `https://{域名}/c/?w={pathWord}`。故意使用「静态页 + 查询参数」
  而非 `_redirects` 重写——CF Pages 对 SPA 项目的扩展名less 路径默认回落到
  `index.html`，会抢在 `_redirects` 的 200 proxying 之前，实测不可靠。
  页面自动尝试拉起 `kira://open/comic/{pathWord}` 深链，未安装时展示下载入口。
- `public/.well-known/assetlinks.json`：Android App Links 校验文件
  （包名 `io.github.caolib.kira` + release 签名 SHA-256）。**换签名证书后必须更新此文件**。
- App 侧域名常量在 kira 仓库 `lib/utils/kira_links.dart` 的 `KiraLinks.webHost`，
  与 `AndroidManifest.xml` 的 https intent-filter host 需保持一致。
