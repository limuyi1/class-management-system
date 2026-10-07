import { validateContext } from '../mutations.js'
import { BusinessError } from '../errors.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'

const controllers = new Map<string, AbortController>()
/** 仅保留正在运行请求的取消句柄；持久账单和调用状态由数据库保存。 */
export function trackAICall(id: string): AbortController {
  const controller = new AbortController()
  controllers.set(id, controller)
  return controller
}
/** 网络结束必须释放内存句柄。 */
export function untrackAICall(id: string): void {
  controllers.delete(id)
}
/** 取消本人在指定 owner 下的请求；中断网络不代表供应商未收费。 */
export function cancelAICall(
  database: DatabaseType,
  context: AccessContextType,
  key: string
): { cancelled: boolean } {
  validateContext(database, context)
  const row = database
    .prepare('SELECT id,status FROM ai_calls WHERE actorId=? AND ownerId=? AND requestKey=?')
    .get(context.actor.id, context.ownerId, key) as { id: string; status: string } | undefined
  if (!row) throw new BusinessError(404, 'NOT_FOUND', '调用不存在')
  const controller = controllers.get(row.id)
  if (row.status === 'RUNNING' && controller) controller.abort()
  return { cancelled: Boolean(controller) }
}
