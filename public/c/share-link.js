// 与 App 的 kira_links.dart 对齐：解码后只接受完整的 ASCII 漫画标识。
// 不 trim、不截断后缀；排除式校验也会拒绝末尾换行（JS 的 $ 可匹配换行前）。
function isValidPathWord(value) {
  return typeof value === 'string' && value.length > 0 && !/[^A-Za-z0-9_-]/.test(value);
}

export function parseComicPathWord({ search = '', pathname = '' } = {}) {
  const values = new URLSearchParams(search).getAll('w');
  if (values.length > 0) {
    // 对齐 Dart 当前 splitQueryString 的后值覆盖行为。
    // w 存在但为空或非法时，不回退到路径里的另一个漫画标识。
    const value = values[values.length - 1];
    return isValidPathWord(value) ? value : null;
  }

  // 只保留解析兼容；/comic/ 是否能到达此页仍取决于部署路由。
  const match = /^\/comic\/([^/]+)\/?$/.exec(pathname);
  if (!match || match[0] !== pathname) return null;

  try {
    const value = decodeURIComponent(match[1]);
    return isValidPathWord(value) ? value : null;
  } catch {
    // 损坏的百分号编码不能作为有效分享链接。
    return null;
  }
}

export function buildComicDeepLink(pathWord) {
  return isValidPathWord(pathWord) ? `kira://open/comic/${pathWord}` : null;
}
