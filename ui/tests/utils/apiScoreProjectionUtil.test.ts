import { describe, expect, it } from 'vitest'
import { buildApiScoreProjection } from '@/utils/apiScoreProjectionUtil'
import { scoreFixture } from '../fixtures/apiScore'

describe('服务器成绩展示适配', () => {
  it('保留零分和空值，按 ID 关联同名学生，不把参照补进本期', () => {
    const state = scoreFixture()
    const projection = buildApiScoreProjection(state)
    expect(projection.rows[0].unit).toBe(0)
    expect(projection.rows[1].unit).toBeNull()
    expect(projection.rows[0].__history_old_unit).toBeNull()
    expect(projection.rows[1].__history_old_unit).toBe(120)
    expect(projection.rankByProp.get('__history_old_unit')?.get('two')).toBe(3)
    expect(projection.headers[0].fullMark).toBe(100)
    expect(projection.headers[1].reference).toBe(true)
    expect(state.students[1]).not.toHaveProperty('unit')
    expect(state.scores).toHaveLength(1)
  })
  it('禁用测评不展示，单列满分覆盖默认值，历史排名保持源名次', () => {
    const state = scoreFixture()
    state.assessments[0].disabled = true
    const disabled = buildApiScoreProjection(state)
    expect(disabled.headers).toHaveLength(1)
    expect(disabled.headers[0].reference).toBe(true)
    state.assessments[0].disabled = false
    state.assessments[0].fullMark = 200
    expect(buildApiScoreProjection(state).headers[0].fullMark).toBe(200)
  })
})
