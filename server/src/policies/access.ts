import { BusinessError } from '../services/errors.js'
import type { AccountRecordType, DatabaseType } from '../types/Account.js'

/** 管理员管理功能要求有效管理员身份，完整代管期间不能沿用真实操作者的管理权限。 */
export function requireAdmin(actor: AccountRecordType): void {
  if (actor.realActor || actor.role !== 'ADMIN')
    throw new BusinessError(403, 'FORBIDDEN', '无权进行账号管理')
}

/** 集中解析数据归属；管理员代管也必须带明确 owner，禁止无范围查询。 */
export function resolveOwner(
  database: DatabaseType,
  actor: AccountRecordType,
  target?: string
): string {
  if (!target || target === actor.id) return actor.id
  if (actor.role !== 'ADMIN' || !actor.superVip) {
    throw new BusinessError(403, 'FORBIDDEN', '无权访问其他账号的数据')
  }
  const owner = database
    .prepare("SELECT id FROM users WHERE id=? AND status!='DELETED'")
    .get(target)
  if (!owner) throw new BusinessError(404, 'NOT_FOUND', '账号不存在')
  return target
}

/** 本人资料、令牌和账号管理不接受代管头，防止身份操作意外跟随业务切换。 */
export function rejectManagedIdentity(target?: string): void {
  if (target) throw new BusinessError(400, 'INVALID_CONTEXT', '此接口不支持账号代管')
}

/** 教学资源只属于老师；管理员须先进入有效老师的完整代管会话。 */
export function requireTeachingOwner(database: DatabaseType, ownerId: string): void {
  const owner = database.prepare('SELECT role,status FROM users WHERE id=?').get(ownerId) as
    | { role: string; status: string }
    | undefined
  if (!owner || owner.role !== 'USER' || owner.status !== 'ACTIVE')
    throw new BusinessError(403, 'FORBIDDEN', '当前身份没有教学业务权限，请切换到老师工作台')
}
