import { readScores } from '@/api/scores'
import { useScopedApiResource } from './useScopedApiResource'

/** 成绩页与教学页共用范围、取消请求及幂等重试规则。 */
export function useApiScores(owner: () => string, workspace: () => string) {
  return useScopedApiResource(owner, workspace, readScores)
}
