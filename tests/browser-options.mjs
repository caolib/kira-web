export const browserSuites = ['header', 'back-to-top', 'tags', 'theme', 'assembly', 'smoke', 'motion']
export const browserViewports = [[1440, 1000], [1920, 1080], [1024, 768], [768, 1024], [375, 812], [320, 740], [812, 375]]
export const quickViewports = [[1440, 1000], [375, 812]]

export function parseBrowserOptions(args) {
  const options = { suites: [], quick: false, screenshots: false, jobs: 1, help: false, list: false }
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--') continue
    if (argument === '--quick') options.quick = true
    else if (argument === '--screenshots') options.screenshots = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--list') options.list = true
    else if (argument === '--jobs' || argument.startsWith('--jobs=')) {
      const value = argument === '--jobs' ? args[++index] : argument.slice('--jobs='.length)
      if (!/^[1-4]$/.test(value || '')) throw new Error('--jobs 必须是 1–4 的整数')
      options.jobs = Number(value)
    } else if (browserSuites.includes(argument) || argument === 'all') {
      options.suites.push(argument)
    } else throw new Error(`未知参数或分组：${argument}；使用 --help 查看用法`)
  }
  if (options.quick && options.suites.length) throw new Error('--quick 不能与分组名同时使用')
  options.suites = options.quick ? ['smoke'] : !options.suites.length || options.suites.includes('all')
    ? [...browserSuites] : [...new Set(options.suites)]
  return options
}

export async function runBrowserSuites(suites, run, { jobs = 1, log = console.log } = {}) {
  let next = 0
  let failed = false
  const results = new Array(suites.length)
  async function worker() {
    while (!failed && next < suites.length) {
      const index = next++
      const name = suites[index]
      const started = performance.now()
      log(`开始：${name}`)
      try {
        await run(name)
        results[index] = { suite: name, seconds: Number(((performance.now() - started) / 1000).toFixed(2)) }
        log(`完成：${name} / ${results[index].seconds}s`)
      } catch (error) {
        failed = true
        log(`失败：${name} / ${((performance.now() - started) / 1000).toFixed(2)}s`)
        throw error
      }
    }
  }
  const workers = await Promise.allSettled(Array.from({ length: Math.min(jobs, suites.length) }, () => worker()))
  const failure = workers.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
  return results
}
