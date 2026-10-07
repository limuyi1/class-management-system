import { mutate } from './mutations.js'
import { BusinessError } from './errors.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'

/** 皮肤修改与现有字体、导出版式合并，重复请求不会二次修改版本。 */
export function saveAppearance(
  database: DatabaseType,
  context: AccessContextType,
  theme: string,
  key: string,
  requestId: string
): { success: boolean } {
  if (!['green', 'orange', 'purple', 'bluepink'].includes(theme))
    throw new BusinessError(400, 'INVALID_THEME', '页面皮肤无效')
  return mutate(
    database,
    context,
    'APPEARANCE_CHANGE',
    context.ownerId,
    { theme },
    key,
    requestId,
    () => {
      const old = database
        .prepare(
          "SELECT id,name,contentJson,version FROM business_resources WHERE ownerId=? AND kind='settings' AND workspaceId IS NULL AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1"
        )
        .get(context.ownerId) as
        | { id: string; name: string; contentJson: string; version: number }
        | undefined
      const content = old ? (JSON.parse(old.contentJson) as Record<string, unknown>) : {}
      database
        .prepare(
          "INSERT INTO business_resources VALUES(?,'settings',?,NULL,?,?,?,NULL,?) ON CONFLICT(ownerId,kind,id) DO UPDATE SET contentJson=excluded.contentJson,version=excluded.version,updatedAt=excluded.updatedAt"
        )
        .run(
          context.ownerId,
          old?.id || context.ownerId,
          old?.name || '账号业务设置',
          JSON.stringify({ ...content, theme }),
          (old?.version || 0) + 1,
          Date.now()
        )
      return { success: true }
    }
  )
}
