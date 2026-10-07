import { describe, expect, it } from 'vitest'
import {
  buildNoticeProjection,
  buildTeachingExcel,
  defaultNoticeConfig
} from '@/utils/apiTeachingProjectionUtil'
import { teachingFixture } from '../fixtures/apiTeaching'

describe('服务器教学数据适配', () => {
  it('通知按学生 ID 关联同名评语，零分为 C、空值缺失，不引用历史成绩', () => {
    const snapshot = teachingFixture()
    const result = buildNoticeProjection(snapshot)
    expect(result.students[0].rawValues.column).toBe(0)
    expect(result.students[0].gradeValues.column).toBe('C')
    expect(result.students[1].rawValues.column).toBeNull()
    expect(result.students[0].comment).toBe('第一位同学的评语')
    expect(result.students[1].comment).toBe('')
    expect(result.subjects.map((item) => item.id)).toEqual(['column'])
    expect(result.students[1].rawValues).not.toHaveProperty('old-column')
  })
  it('默认等级规则使用实际满分，失效配置阻止通知导出', () => {
    const snapshot = teachingFixture()
    snapshot.scores.assessments[0].fullMark = 150
    expect(defaultNoticeConfig(snapshot).subjects[0]).toEqual({
      assessmentId: 'column',
      maxScore: 150,
      gradeAMin: 120,
      gradeBMin: 90
    })
    snapshot.notice.config = {
      ...defaultNoticeConfig(snapshot),
      subjects: [{ assessmentId: 'old-column', maxScore: 150, gradeAMin: 120, gradeBMin: 90 }]
    }
    expect(() => buildNoticeProjection(snapshot)).toThrow('已删除或禁用')
  })
  it('成绩 Excel 保留 ID、零分和空值；评语表不带分数；禁用/转出学生不导出', () => {
    const snapshot = teachingFixture()
    const exported = buildTeachingExcel(snapshot)
    expect(exported.headers).toEqual(['序号', '学生ID', '姓名', '单元（满分 100）', '评语'])
    expect(exported.rows[0]).toEqual([1, 'one', '同名', 0, '第一位同学的评语'])
    expect(exported.rows[1][3]).toBeNull()
    expect(buildTeachingExcel(snapshot, true).headers).toEqual(['序号', '学生ID', '姓名', '评语'])
    snapshot.scores.students[0].disabled = true
    snapshot.scores.students[1].departed = true
    expect(buildTeachingExcel(snapshot).rows).toEqual([])
  })
})
