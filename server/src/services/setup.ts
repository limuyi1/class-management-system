import { createHash, randomUUID } from 'node:crypto'
import { hashPassword } from '../auth/password.js'
import { transaction } from '../db/migrate.js'
import { audit, profile, validateNickname, validatePhone } from './accounts.js'
import { BusinessError } from './errors.js'
import type { DatabaseType, AccountRecordType } from '../types/Account.js'
import type { InitialAdminInputType } from '../../../packages/shared/src/Setup.js'

/** 是否首次使用只检查管理员，不以教学数据是否为空作为判断依据。 */
export function needsInitialAdmin(database: DatabaseType): boolean {
  return !database.prepare("SELECT id FROM users WHERE role='ADMIN' LIMIT 1").get()
}

/** 创建唯一首任管理员；随机临时密码由系统页面生成，只保存哈希，回执不含密码。 */
export async function createInitialAdmin(
  database: DatabaseType,
  input: InitialAdminInputType,
  key: string,
  requestId: string
) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key))
    throw new BusinessError(400, 'IDEMPOTENCY_REQUIRED', '请提供有效的请求键')
  const phone = validatePhone(input.phone),
    nickname = input.nickname ? validateNickname(input.nickname) : '管理员'
  const receiptKey = `bootstrap:${key}`
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([phone, nickname, input.initialPassword]))
    .digest('hex')
  const previous = () => {
    const row = database
      .prepare('SELECT requestHash,resultJson FROM mutation_receipts WHERE key=? LIMIT 1')
      .get(receiptKey) as { requestHash: string; resultJson: string } | undefined
    if (!row) return undefined
    if (row.requestHash !== fingerprint)
      throw new BusinessError(409, 'IDEMPOTENCY_CONFLICT', '请求内容已变化')
    return JSON.parse(row.resultJson) as { user: ReturnType<typeof profile> }
  }
  const receipt = previous()
  if (receipt) return receipt
  if (!needsInitialAdmin(database))
    throw new BusinessError(409, 'SETUP_COMPLETE', '管理员已创建，请直接登录')
  const hash = await hashPassword(input.initialPassword)
  return transaction(database, () => {
    const receipt = previous()
    if (receipt) return receipt
    if (!needsInitialAdmin(database))
      throw new BusinessError(409, 'SETUP_COMPLETE', '管理员已创建，请直接登录')
    if (database.prepare('SELECT id FROM users WHERE phone=?').get(phone))
      throw new BusinessError(409, 'PHONE_EXISTS', '该手机号已有账号')
    const id = randomUUID()
    database
      .prepare(
        "INSERT INTO users(id,phone,nickname,passwordHash,role,status,mustChangePassword,createdAt) VALUES(?,?,?,?,'ADMIN','ACTIVE',1,?)"
      )
      .run(id, phone, nickname, hash, Date.now())
    const user = database.prepare('SELECT * FROM users WHERE id=?').get(id) as AccountRecordType
    const result = { user: profile(user) }
    database
      .prepare('INSERT INTO mutation_receipts VALUES(?,?,?,?,?,?)')
      .run(id, id, receiptKey, fingerprint, JSON.stringify(result), Date.now())
    audit(database, id, id, 'INITIAL_ADMIN_SETUP', id, requestId)
    return result
  })
}
