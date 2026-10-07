import { transaction } from '../db/migrate.js'
import { validateContext } from './mutations.js'
import { getWorkspace } from '../repositories/workspaces.js'
import { audit } from './accounts.js'
import type { AccessContextType, DatabaseType } from '../types/Account.js'
/** 原样读取离线迁入的通知档案，保留独立名单、成绩、等级与评语，不混入本期。 */
export function readLegacyNotice(
  database: DatabaseType,
  context: AccessContextType,
  workspaceId: string,
  requestId: string
) {
  return transaction(database, () => {
    validateContext(database, context)
    getWorkspace(database, context.ownerId, workspaceId)
    const row = database
      .prepare(
        "SELECT contentJson FROM workspace_documents WHERE ownerId=? AND workspaceId=? AND type='legacy-score-notice'"
      )
      .get(context.ownerId, workspaceId) as { contentJson: string } | undefined
    audit(database, context.actor.id, context.ownerId, 'LEGACY_NOTICE_READ', workspaceId, requestId)
    return { notice: row ? (JSON.parse(row.contentJson) as unknown) : null }
  })
}
