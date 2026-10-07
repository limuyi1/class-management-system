import { apiRequest } from './client'
import type { TeachingSnapshotType } from '@/types/ApiTeaching'

/** 导出与教学页均读取后端一致快照，不能使用旧本地 store 或未保存表单。 */
export function readTeachingSnapshot(
  ownerId: string,
  workspaceId: string,
  signal?: AbortSignal
): Promise<TeachingSnapshotType> {
  return apiRequest(`/workspaces/${workspaceId}/exports/snapshot`, { ownerId, signal })
}
