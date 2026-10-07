import { buildApp } from './app.js'
import { openDatabase } from './db/index.js'
import { SCHEMA_VERSION } from './db/migrate.js'

/** 启动仅检查 schema；禁止将数据库缺失误当成可覆盖的空数据。 */
async function main(): Promise<void> {
  const { database } = openDatabase()
  const version = database.prepare('PRAGMA user_version').get() as { user_version: number }
  if (version.user_version !== SCHEMA_VERSION) throw new Error('请先运行 pnpm db:migrate')
  // 单写实例重启后不自动重试付费请求，也不自动释放无法确认的额度。
  database.prepare("UPDATE ai_calls SET status='UNCERTAIN' WHERE status='RUNNING'").run()
  const origin = process.env.WEB_ORIGIN || 'http://127.0.0.1:5173'
  const app = await buildApp(database, origin)
  app.addHook('onClose', async () => database.close())
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close().catch(() => {
        process.exitCode = 1
      })
    })
  }
  await app.listen({
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000)
  })
}

void main().catch((error: unknown) => {
  console.error('后端启动失败:', error instanceof Error ? error.message : '未知错误')
  process.exitCode = 1
})
