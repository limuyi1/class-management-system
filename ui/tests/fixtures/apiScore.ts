import type { ScoreStateType } from '@/types/ApiScores'

export function scoreFixture(): ScoreStateType {
  return {
    workspace: {
      id: 'current',
      ownerId: 'owner',
      classId: 'class',
      className: '403',
      termName: '下学期',
      scoreFullMark: 100,
      version: 1,
      createdAt: 0,
      updatedAt: 0
    },
    students: [
      {
        studentId: 'one',
        name: '同名',
        disabled: false,
        departed: false,
        departedAt: null,
        version: 1
      },
      {
        studentId: 'two',
        name: '同名',
        disabled: false,
        departed: false,
        departedAt: null,
        version: 1
      }
    ],
    assessments: [
      {
        id: 'column',
        workspaceId: 'current',
        prop: 'unit',
        label: '单元',
        fullMark: null,
        disabled: false,
        sortIndex: 0,
        version: 1
      }
    ],
    scores: [{ studentId: 'one', assessmentId: 'column', value: 0, version: 1 }],
    references: [
      {
        assessmentId: 'old-column',
        sourceWorkspaceId: 'old',
        prop: '__history_old_unit',
        label: '上学期参照',
        fullMark: 150,
        scores: [{ studentId: 'two', assessmentId: 'old-column', value: 120, version: 1, rank: 3 }]
      }
    ],
    statistics: [{ assessmentId: 'column', count: 1, missing: 1, average: 0, min: 0, max: 0 }]
  }
}
