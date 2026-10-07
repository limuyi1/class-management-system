import { transaction } from '../../db/migrate.js'
import { writeV5State } from './write.js'
import type { AccessContextType, DatabaseType } from '../../types/Account.js'
import type { V5WriteType, V5StateType } from '../../../../packages/shared/src/V5.js'

/** 原页面映射后的导入和编辑先由同一业务校验预览；回滚所有写入、流水及回执。 */
export function previewV5State(
  database: DatabaseType,
  context: AccessContextType,
  id: string,
  input: V5WriteType,
  key: string,
  requestId: string
): V5StateType {
  const rollback = Symbol('preview-rollback')
  let result: V5StateType | undefined
  try {
    transaction(database, () => {
      result = writeV5State(database, context, id, input, key, requestId)
      throw rollback
    })
  } catch (error) {
    if (error !== rollback) throw error
  }
  if (!result) throw new Error('预览结果为空')
  return { ...result, fingerprint: input.fingerprint }
}
