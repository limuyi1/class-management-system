import { BusinessError } from '../services/errors.js'
import type { DatabaseType } from '../types/Account.js'

/** 数据库保存限流计数，服务重启不清空；初期单实例，无需 Redis。 */
export function rateLimit(
  database: DatabaseType,
  key: string,
  maximum: number,
  windowMs: number
): void {
  const now = Date.now()
  database
    .prepare(
      `INSERT INTO login_limits(key,count,resetsAt) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN resetsAt<=? THEN 1 ELSE count+1 END,
      resetsAt=CASE WHEN resetsAt<=? THEN excluded.resetsAt ELSE resetsAt END`
    )
    .run(key, now + windowMs, now, now)
  const record = database.prepare('SELECT count FROM login_limits WHERE key=?').get(key) as {
    count: number
  }
  if (record.count > maximum)
    throw new BusinessError(429, 'RATE_LIMITED', '操作过于频繁，请稍后再试')
}
