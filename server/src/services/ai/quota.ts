import { randomUUID } from 'node:crypto'
import { transaction } from '../../db/migrate.js'
import { requireAdmin } from '../../policies/access.js'
import { mutate, validateContext } from '../mutations.js'
import { BusinessError } from '../errors.js'
import type { AIQuotaType } from '../../../../packages/shared/src/AI.js'
import type { AccessContextType, AccountRecordType, DatabaseType } from '../../types/Account.js'

const MAX_QUOTA = 1000000000
/** 未分配额度的账号显示零余额，不默认放开无限额度。 */
export function quotaFor(database: DatabaseType, ownerId: string): AIQuotaType {
  return (
    (database
      .prepare('SELECT available,reserved,used,version FROM ai_quotas WHERE ownerId=?')
      .get(ownerId) as AIQuotaType) || { available: 0, reserved: 0, used: 0, version: 0 }
  )
}
function ensureQuota(database: DatabaseType, ownerId: string): void {
  database.prepare('INSERT OR IGNORE INTO ai_quotas(ownerId) VALUES(?)').run(ownerId)
}
function ledger(
  database: DatabaseType,
  ownerId: string,
  actorId: string,
  kind: string,
  delta: number,
  reason: string
): void {
  database
    .prepare('INSERT INTO ai_quota_ledger VALUES(?,?,?,?,?,?,?)')
    .run(randomUUID(), ownerId, actorId, kind, delta, reason, Date.now())
}
/** 追加/扣减可用余额，携带版本与幂等键；不能扣除已经预占的调用额度。 */
export function adjustAIQuota(
  database: DatabaseType,
  context: AccessContextType,
  ownerId: string,
  input: { delta: number; version: number; reason: string },
  key: string,
  requestId: string
): AIQuotaType {
  return mutate(database, context, 'AI_QUOTA_ADJUST', ownerId, input, key, requestId, () => {
    requireAdmin(
      database.prepare('SELECT * FROM users WHERE id=?').get(context.actor.id) as AccountRecordType
    )
    const owner = database
      .prepare("SELECT role,status FROM users WHERE id=? AND status!='DELETED'")
      .get(ownerId) as { role: string; status: string } | undefined
    if (!owner) throw new BusinessError(404, 'NOT_FOUND', '账号不存在')
    if (owner.role !== 'USER' || (input.delta > 0 && owner.status !== 'ACTIVE'))
      throw new BusinessError(403, 'FORBIDDEN', '只能为有效老师账号追加额度')
    if (input.delta > 0) {
      const config = database
        .prepare("SELECT baseUrl,model,secret,enabled FROM ai_configs WHERE id='platform'")
        .get() as
        | { baseUrl: string; model: string; secret: string | null; enabled: number }
        | undefined
      if (!config?.baseUrl || !config.model || !config.secret || !config.enabled)
        throw new BusinessError(409, 'AI_NOT_CONFIGURED', '请先配置并启用平台模型')
    }
    if (
      !Number.isSafeInteger(input.delta) ||
      !input.delta ||
      Math.abs(input.delta) > MAX_QUOTA ||
      !input.reason.trim() ||
      input.reason.length > 200
    )
      throw new BusinessError(400, 'INVALID_QUOTA', '请输入整数额度调整量及原因')
    const old = quotaFor(database, ownerId)
    if (old.version !== input.version)
      throw new BusinessError(409, 'VERSION_CONFLICT', '额度已变化，请刷新后重试')
    if (old.available + input.delta < 0 || old.available + input.delta > MAX_QUOTA)
      throw new BusinessError(400, 'INVALID_QUOTA', '剩余额度不足或超过上限')
    ensureQuota(database, ownerId)
    database
      .prepare('UPDATE ai_quotas SET available=available+?,version=version+1 WHERE ownerId=?')
      .run(input.delta, ownerId)
    ledger(database, ownerId, context.actor.id, 'ADJUST', input.delta, input.reason.trim())
    return quotaFor(database, ownerId)
  })
}
/** 网络调用前短事务预占预算；此内部函数不暴露为客户端接口，禁止客户端报用量。 */
export function reserveAITokens(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  amount: number
): void {
  transaction(database, () => {
    validateContext(database, context)
    if (context.ownerId !== context.actor.id && !context.managedSessionId)
      throw new BusinessError(400, 'INVALID_CONTEXT', 'AI 调用不支持代管扣费')
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_QUOTA)
      throw new BusinessError(400, 'INVALID_QUOTA', '调用预算无效')
    if (database.prepare('SELECT id FROM ai_token_reservations WHERE id=?').get(id))
      throw new BusinessError(409, 'AI_CALL_EXISTS', '调用已创建，不能重复请求模型')
    ensureQuota(database, context.ownerId)
    const result = database
      .prepare(
        'UPDATE ai_quotas SET available=available-?,reserved=reserved+?,version=version+1 WHERE ownerId=? AND available>=?'
      )
      .run(amount, amount, context.ownerId, amount)
    if (!result.changes)
      throw new BusinessError(
        402,
        'AI_QUOTA_EXHAUSTED',
        '平台 AI 额度不足，请联系管理员或切换个人 Key'
      )
    database
      .prepare("INSERT INTO ai_token_reservations VALUES(?,?,?,?,NULL,'PENDING',?)")
      .run(id, context.ownerId, context.actor.id, amount, Date.now())
    ledger(database, context.ownerId, context.actor.id, 'RESERVE', -amount, id)
  })
}
/** 用量来自服务端供应商响应，输入+输出合并结算；重复相同结果无副作用。 */
export function settleAITokens(
  database: DatabaseType,
  id: string,
  actual: number,
  release = false
): void {
  transaction(database, () => {
    const row = database.prepare('SELECT * FROM ai_token_reservations WHERE id=?').get(id) as
      | { ownerId: string; actorId: string; amount: number; actual: number | null; state: string }
      | undefined
    if (!row) throw new BusinessError(404, 'NOT_FOUND', '调用记录不存在')
    const state = release ? 'RELEASED' : 'SETTLED'
    if (
      !Number.isSafeInteger(actual) ||
      actual < 0 ||
      actual > row.amount ||
      (release && actual !== 0)
    )
      throw new BusinessError(
        409,
        'AI_USAGE_UNCERTAIN',
        '模型用量超出预占或无法确认，请核对调用记录'
      )
    if (row.state !== 'PENDING') {
      if (row.state === state && row.actual === actual) return
      throw new BusinessError(409, 'AI_SETTLEMENT_CONFLICT', '调用已经结算，不能更改')
    }
    database
      .prepare(
        'UPDATE ai_quotas SET available=available+?,reserved=reserved-?,used=used+?,version=version+1 WHERE ownerId=?'
      )
      .run(row.amount - actual, row.amount, actual, row.ownerId)
    database
      .prepare('UPDATE ai_token_reservations SET actual=?,state=? WHERE id=?')
      .run(actual, state, id)
    ledger(
      database,
      row.ownerId,
      row.actorId,
      release ? 'RELEASE' : 'SETTLE',
      row.amount - actual,
      id
    )
  })
}

/** 管理员凭供应商账单核对异常调用，允许补扣超出预算的余额，并记录核对原因。 */
export function reconcileAITokens(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  actual: number,
  reason: string,
  inTransaction = false
): void {
  const action = () => {
    validateContext(database, context)
    requireAdmin(
      database.prepare('SELECT * FROM users WHERE id=?').get(context.actor.id) as AccountRecordType
    )
    if (!reason.trim() || !Number.isSafeInteger(actual) || actual < 0 || actual > MAX_QUOTA)
      throw new BusinessError(400, 'INVALID_QUOTA', '请填写有效用量及核对原因')
    const row = database.prepare('SELECT * FROM ai_token_reservations WHERE id=?').get(id) as
      | { ownerId: string; amount: number; state: string }
      | undefined
    if (!row || row.state !== 'PENDING')
      throw new BusinessError(409, 'AI_SETTLEMENT_CONFLICT', '调用不存在或已结算')
    const result = database
      .prepare(
        'UPDATE ai_quotas SET available=available+?,reserved=reserved-?,used=used+?,version=version+1 WHERE ownerId=? AND available+?>=0'
      )
      .run(row.amount - actual, row.amount, actual, row.ownerId, row.amount - actual)
    if (!result.changes)
      throw new BusinessError(402, 'AI_QUOTA_EXHAUSTED', '补扣余额不足，请先追加额度')
    database
      .prepare('UPDATE ai_token_reservations SET actual=?,state=? WHERE id=?')
      .run(actual, actual === 0 ? 'RELEASED' : 'SETTLED', id)
    ledger(
      database,
      row.ownerId,
      context.actor.id,
      actual === 0 ? 'RELEASE' : 'SETTLE',
      row.amount - actual,
      `${id}：${reason.trim()}`
    )
  }
  if (inTransaction) action()
  else transaction(database, action)
}

/** 分页联合读取老师与额度；保留零余额和禁用账号，排除管理员和软删除账号。 */
export function listAIQuotas(
  database: DatabaseType,
  input: {
    page?: number
    pageSize?: number
    search?: string
    status?: string
  }
) {
  const page = input.page || 1,
    pageSize = Math.min(input.pageSize || 50, 50)
  const pattern = `%${input.search || ''}%`
  const where =
    "u.role='USER' AND u.status!='DELETED' AND (u.phone LIKE ? OR u.nickname LIKE ?) AND (?='' OR u.status=?)"
  const args = [pattern, pattern, input.status || '', input.status || '']
  const total = database
    .prepare(
      `SELECT count(*) AS total FROM ai_quotas q JOIN users u ON u.id=q.ownerId WHERE ${where}`
    )
    .get(...args) as { total: number }
  const items = database
    .prepare(
      `SELECT u.id,u.phone,u.nickname,u.status,q.available,q.reserved,q.used,q.version FROM ai_quotas q JOIN users u ON u.id=q.ownerId WHERE ${where} ORDER BY u.createdAt,u.id LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, (page - 1) * pageSize)
  return { items, total: total.total, page, pageSize }
}
