const screenshot = (id, label, title, width, height) => ({
  id,
  label,
  title,
  src: `/screenshots/reading-edition/${id}.webp`,
  full: `/screenshots/reading-edition/${id}-full.webp`,
  width,
  height,
})

export const site = {
  name: 'Kira',
  tagline: '漫画与轻小说，读得自在。',
  repoUrl: 'https://github.com/caolib/kira',
  releasesUrl: 'https://github.com/caolib/kira/releases',
  qqGroupUrl: 'https://qm.qq.com/q/rezw7xWuK4',
  qqGroupNumber: '1025321453',
  logo: '/logo.png',
  screenshots: [
    screenshot('discover', '漫画发现', '漫画首页的推荐与排行榜', 657, 1285),
    screenshot('reader', '漫画阅读', '全屏漫画阅读界面', 657, 1275),
    screenshot('novels', '轻小说书库', '轻小说分类、筛选与作品封面', 657, 1272),
    screenshot('novel-reader', '轻小说阅读', '浅色背景的轻小说正文阅读', 657, 1275),
    screenshot('detail', '漫画详情', '漫画简介、收藏入口与章节列表', 657, 1278),
    screenshot('bookshelf', '我的书架', '收藏的漫画与更新提醒', 657, 1273),
    screenshot('desktop', '横屏首页', '宽屏布局的漫画首页与侧边导航', 1950, 1262),
    screenshot('spread', '横屏跨页阅读', '横屏完整呈现漫画跨页大图', 1950, 1262),
  ],
  faqs: [
    { question: 'Kira 是什么？', answer: 'Kira 是漫画与轻小说阅读客户端，支持访问拷贝漫画、热辣漫画等第三方内容。它不是内容平台，内容与服务可用性取决于对应来源。' },
    { question: '可以在哪些设备上使用？', answer: '主要维护 Android，GitHub Releases 也提供 Windows 安装包。iOS 等其他平台的构建情况可到交流群了解；社区构建不等同于官方维护与发布。' },
    { question: '朋友分享的漫画，要怎么打开？', answer: '安装 Kira 后，用系统浏览器打开分享链接，再点击“在 Kira 中打开”。如果聊天应用内打不开，换用系统浏览器即可再次尝试。' },
    { question: '遇到登录或使用问题怎么办？', answer: '先查看使用指南中的下载、登录与 AI 配置说明。如果仍然无法解决，可以到 GitHub 提交问题，或加入 QQ 交流群交流。请勿公开账号令牌等敏感信息。' },
  ],
}

export default site
