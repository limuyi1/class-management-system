import { scoreFixture } from './apiScore'
import type { TeachingSnapshotType } from '@/types/ApiTeaching'

export function teachingFixture(): TeachingSnapshotType {
  return {
    scores: scoreFixture(),
    comments: [{ studentId: 'one', text: '第一位同学的评语', version: 1 }],
    notice: { config: null, version: 0 }
  }
}
