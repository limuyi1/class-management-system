import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => vi.unstubAllEnvs())
it('服务器教学路由直接复用原页面，保留通知子路由和设置链接，页面草稿守卫可访问', async () => {
  vi.stubEnv('VITE_STORAGE_MODE', 'server')
  const router = (await import('@/router')).default
  for (const path of [
    '/overview',
    '/score',
    '/student-info',
    '/tools',
    '/setting?tab=ai-config',
    '/tools/paper-layout',
    '/tools/attachments'
  ]) {
    const target = router.resolve(path)
    expect(target.matched).toHaveLength(1)
    expect(target.matched[0].components?.default).toBeTypeOf('function')
  }
  expect(router.resolve('/tools/notice-awards/custom').matched).toHaveLength(2)
  expect(router.resolve('/devices').matched).toHaveLength(1)
  router.options.history.destroy()
})
