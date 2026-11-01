import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildComicDeepLink, parseComicPathWord } from '../public/c/share-link.js';

const parse = (search, pathname = '/c/') => parseComicPathWord({ search, pathname });

test('合法查询参数保留大小写、数字、下划线与连字符', () => {
  for (const word of ['a', '0', '_', '-', 'AbC_123-xyz']) {
    for (const pathname of ['/c', '/c/']) {
      assert.equal(parse(`?w=${word}`, pathname), word);
    }
  }
});

test('缺失、空值和无值参数均无效', () => {
  assert.equal(parseComicPathWord(), null);
  for (const search of ['', '?', '?w', '?w=', '?word=comic', '?W=comic']) {
    assert.equal(parse(search), null, search);
  }
});

test('校验完整查询值，不截断非法后缀，也不修剪空白', () => {
  for (const word of [
    ' comic', 'comic ', 'comic.', 'comic。', 'comic/extra', 'comic?next',
    'comic#next', 'comic&next', 'comic=next', 'comic+next', 'comic\\extra',
    '漫画', 'ａｂｃ', 'café', 'comic\n', 'comic\r', 'comic\t',
    'comic\u0000', 'comic\u007f',
    ...[0x200b, 0x2028, 0x2029].map((code) => `comic${String.fromCharCode(code)}`),
    '<script>alert(1)</script>',
  ]) {
    assert.equal(parse(`?w=${encodeURIComponent(word)}`), null, JSON.stringify(word));
  }
});

test('查询按表单编码解码一次，编码后的合法 ASCII 可用', () => {
  assert.equal(parse('?w=%41%62%43%5F%31%32%33%2Dxyz'), 'AbC_123-xyz');
  assert.equal(parse('?%77=encoded_key'), 'encoded_key');
  assert.equal(parse('?from=share&w=comic_1&source=app'), 'comic_1');
});

test('拒绝加号空格、损坏的编码及双重编码，不抛出异常', () => {
  for (const value of ['a+b', 'abc%', 'abc%2', 'abc%GG', '%FF', '%C3%28', '%ED%A0%80', 'abc%252D']) {
    assert.equal(parse(`?w=${value}`), null, value);
  }
});

test('完整 ASCII 白名单包括单字符边界，排除尾部换行', () => {
  for (let code = 0; code < 128; code += 1) {
    const char = String.fromCharCode(code);
    const word = `comic${char}`;
    const allowed = /[A-Za-z0-9_-]/.test(char);
    assert.equal(parse(`?w=${encodeURIComponent(word)}`), allowed ? word : null, `ASCII ${code}`);
    assert.equal(buildComicDeepLink(word), allowed ? `kira://open/comic/${word}` : null, `ASCII ${code}`);
  }
});

test('解析兼容路径及可选末尾斜杠，不代表该路径已部署', () => {
  assert.equal(parse('', '/comic/AbC_123-xyz'), 'AbC_123-xyz');
  assert.equal(parse('', '/comic/AbC_123-xyz/'), 'AbC_123-xyz');
  assert.equal(parse('?source=app', '/comic/From_path'), 'From_path');
});

test('兼容路径中的标识仅解码一次，仍须通过完整校验', () => {
  assert.equal(parse('', '/comic/%41%62%43%5F%31%2D/'), 'AbC_1-');
  for (const path of [
    '/comic/abc%2Fmore', '/comic/abc%0A', '/comic/abc%20', '/comic/abc%252D',
    '/comic/%E6%BC%AB%E7%94%BB', '/comic/abc%', '/comic/%FF',
  ]) {
    assert.equal(parse('', path), null, path);
  }
});

test('拒绝残缺、额外层级、非法后缀和大小写不符的兼容路径', () => {
  for (const path of [
    '/', '/comic', '/comic/', '/comic//', '/comic/abc/extra', '/comic/abc//',
    '/comic/abc.', '/comic/abc。', '/comic/漫画', '/comic/abc+def',
    '/comic/abc\n', '/comic/abc/\n', '/Comic/abc', '/prefix/comic/abc',
  ]) {
    assert.equal(parse('', path), null, JSON.stringify(path));
  }
});

test('查询 w 优先于兼容路径，空值或非法值不回退', () => {
  assert.equal(parse('?w=From_query', '/comic/From_path'), 'From_query');
  for (const search of ['?w', '?w=', '?w=bad.suffix', '?w=bad%2Fpath', '?w=%FF']) {
    assert.equal(parse(search, '/comic/From_path'), null, search);
  }
  assert.equal(parse('?W=ignored', '/comic/From_path'), 'From_path');
});

test('重复查询键对齐 Dart 当前 splitQueryString 的后值覆盖行为', () => {
  assert.equal(parse('?w=First&w=Last_2'), 'Last_2');
  assert.equal(parse('?w=First&%77=Last_2'), 'Last_2');
  assert.equal(parse('?w=bad.suffix&w=Last_2'), 'Last_2');
  assert.equal(parse('?w=First&w='), null);
  assert.equal(parse('?w=First&w=bad.suffix'), null);
});

test('生成 App 深链前再次校验，不接受任意协议或非字符串', () => {
  assert.equal(buildComicDeepLink('AbC_123-xyz'), 'kira://open/comic/AbC_123-xyz');
  for (const value of [null, undefined, '', 42, {}, [], 'abc/def', 'abc\n', 'javascript:alert(1)']) {
    assert.equal(buildComicDeepLink(value), null);
  }
});

// 运行页面中的实际模块逻辑；仅替换 import，并用最小 DOM / location 桩记录唤起。
// 这里不模拟安装结果，也不代替手机浏览器的协议测试。
const html = await readFile(new URL('../public/c/index.html', import.meta.url), 'utf8');
const pageModule = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(pageModule, '页面必须使用 module 脚本');
const pageScript = pageModule.replace(/import\s*\{[^}]+\}\s*from\s*['"]\/c\/share-link\.js['"];?/, '');

function runPage(search, { pathname = '/c/', blocked = false } = {}) {
  const calls = [];
  const nodes = new Map();
  const events = new Map();
  for (const id of ['status', 'status-title', 'link-state', 'open-app', 'invalid-home']) {
    nodes.set(id, {
      textContent: '',
      disabled: id === 'open-app',
      hidden: id === 'invalid-home',
      addEventListener(event, handler) { events.set(`${id}:${event}`, handler); },
    });
  }
  const location = {
    search,
    pathname,
    set href(value) {
      calls.push(value);
      if (blocked) throw new Error('Navigation blocked');
    },
  };
  runInNewContext(pageScript, {
    parseComicPathWord,
    buildComicDeepLink,
    document: { getElementById: (id) => nodes.get(id) },
    window: { location },
  });
  return { calls, nodes, events };
}

test('合法页面自动尝试恰好一次，并提供手动再次打开', () => {
  const page = runPage('?w=AbC_123');
  assert.deepEqual(page.calls, ['kira://open/comic/AbC_123']);
  assert.equal(page.nodes.get('open-app').disabled, false);
  assert.match(page.nodes.get('status').textContent, /已尝试/);
  assert.doesNotMatch(page.nodes.get('status').textContent, /已打开|已安装|成功/);
  page.events.get('open-app:click')();
  assert.deepEqual(page.calls, ['kira://open/comic/AbC_123', 'kira://open/comic/AbC_123']);
});

test('无效页面禁用打开，不发起自动或手动唤起，提供恢复说明', () => {
  for (const search of ['', '?w=', '?w=valid.invalid', '?w=valid%0A']) {
    const page = runPage(search);
    assert.deepEqual(page.calls, []);
    assert.equal(page.nodes.get('open-app').disabled, true);
    assert.equal(page.events.has('open-app:click'), false);
    assert.equal(page.nodes.get('invalid-home').hidden, false);
    assert.match(page.nodes.get('status-title').textContent, /无效/);
    assert.match(page.nodes.get('status').textContent, /重新获取完整链接/);
  }
});

test('浏览器阻止跳转时仍保留手动入口，不重试循环或检测安装', () => {
  const page = runPage('?w=comic', { blocked: true });
  assert.equal(page.calls.length, 1);
  assert.equal(page.nodes.get('open-app').disabled, false);
  assert.match(page.nodes.get('status').textContent, /未能发起打开请求/);
  page.events.get('open-app:click')();
  assert.equal(page.calls.length, 2);
});

test('静态页面保留安全默认态、下载入口与 noscript 兜底', () => {
  assert.match(html, /<button\b[^>]*id="open-app"[^>]*\bdisabled/);
  assert.match(html, /<a\b[^>]*id="invalid-home"[^>]*href="\/"/);
  assert.match(html, /href="https:\/\/github\.com\/caolib\/kira\/releases"/);
  assert.match(html, /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/);
  assert.match(html, /src="\/logo\.png"/);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(html, /自动识别|navigator\.clipboard|setInterval|setTimeout|visibilitychange/);
});
