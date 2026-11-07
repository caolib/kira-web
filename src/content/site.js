const screenshot = (id, label, title, width, height, tags, hasDark = true) => {
  const base = `/screenshots/reading-edition/${id}`
  const light = { src: `${base}.webp`, full: `${base}-full.webp` }
  return {
    id, label, title, width, height, tags,
    ...light,
    light,
    dark: hasDark ? { src: `${base}-dark.webp`, full: `${base}-dark-full.webp` } : null,
    dimInDark: !hasDark,
  }
}

export const site = {
  name: 'Kira',
  tagline: '漫画与轻小说，读得自在。',
  repoUrl: 'https://github.com/caolib/kira',
  releasesUrl: 'https://github.com/caolib/kira/releases',
  releaseManifestUrl: 'https://gh-proxy.org/https://github.com/caolib/kira/releases/latest/download/release.json',
  downloadMirrorPrefix: 'https://gh-proxy.org/',
  qqGroupUrl: 'https://qm.qq.com/q/rezw7xWuK4',
  qqGroupNumber: '1025321453',
  logo: '/logo.png',
  screenshots: [
    screenshot('discover', '漫画首页', '漫画首页的推荐与排行榜', 656, 1317, ['双源切换', '发现下一部喜欢']),
    screenshot('reader', '漫画阅读', '全屏漫画阅读界面', 656, 1317, ['全屏沉浸', '状态显示'], false),
    screenshot('novels', '轻小说书库', '轻小说分类、筛选与作品封面', 656, 1317, ['按喜好发现新作']),
    screenshot('novel-reader', '轻小说阅读', '轻小说正文阅读界面', 656, 1317, ['字号排版自己定', '沉浸字里行间']),
    screenshot('detail', '漫画详情', '漫画简介、收藏入口与章节列表', 656, 1317, ['本地下载', '精确进度']),
    screenshot('bookshelf', '我的书架', '收藏的漫画与更新提醒', 656, 1317, ['留一格给喜欢', '更新不错过']),
    screenshot('desktop', '横屏首页', '宽屏布局的漫画首页与侧边导航', 1967, 1233, ['大屏浏览更从容']),
    screenshot('spread', '横屏跨页阅读', '横屏完整呈现漫画跨页大图', 1967, 1233, ['大场面一眼看全'], false),
    screenshot('bookmarks', '阅读书签', '按作品和章节整理的漫画与轻小说书签', 656, 1317, ['一键续读', '喜欢的片段随时重温']),
    screenshot('comments', '章节评论', '阅读器内的章节评论与下一话入口', 656, 1317, ['疑似剧透先遮挡', '热门讨论一眼看到']),
  ],
  faqs: [
    { question: 'Kira 是什么？', answer: 'Kira 是漫画与轻小说阅读客户端，支持访问拷贝漫画、热辣漫画等第三方内容。它不是内容平台，内容与服务可用性取决于对应来源。' },
    { question: '可以在哪些设备上使用？', answer: '主要维护 Android，GitHub Releases 也提供 Windows 安装包。iOS 等其他平台的构建情况可到交流群了解；社区构建不等同于官方维护与发布。' },
    { question: '朋友分享的漫画，要怎么打开？', answer: '安装 Kira 后，用系统浏览器打开分享链接，再点击“在 Kira 中打开”。如果聊天应用内打不开，换用系统浏览器即可再次尝试。' },
    { question: '遇到登录或使用问题怎么办？', answer: '先查看使用指南中的下载、登录与 AI 配置说明。如果仍然无法解决，可以到 GitHub 提交问题，或加入 QQ 交流群交流。请勿公开账号令牌等敏感信息。' },
  ],
}

export default site
