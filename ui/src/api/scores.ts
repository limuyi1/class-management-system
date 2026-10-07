import { apiRequest } from './client'
import type { AssessmentType, ScoreStateType } from '@/types/ApiScores'

/** 所有请求显式传入账号和学期，不读取全局选择状态。 */
export function readScores(
  ownerId: string,
  workspaceId: string,
  signal?: AbortSignal
): Promise<ScoreStateType> {
  return apiRequest(`/workspaces/${workspaceId}/scores`, { ownerId, signal })
}
export function readAssessments(
  ownerId: string,
  workspaceId: string,
  signal?: AbortSignal
): Promise<{ items: AssessmentType[] }> {
  return apiRequest(`/workspaces/${workspaceId}/assessments`, { ownerId, signal })
}
