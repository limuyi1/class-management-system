import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'

import ScoreRecognitionPreviewDialog from '../../src/views/score/components/ScoreRecognitionPreviewDialog.vue'
import { buildScoreRecognitionPreview } from '../../src/utils/scoreRecognitionUtil'
import type { ScoreRecognitionPreviewRowType } from '../../src/utils/scoreRecognitionUtil'

interface DialogStateType {
  tableData: ScoreRecognitionPreviewRowType[]
  selectedStudentIds: string[]
  setSelected: (studentId: string, checked: boolean) => void
  updateScore: (row: ScoreRecognitionPreviewRowType) => void
  handleConfirm: () => void
}

const students = [
  { studentId: 'student-1', name: '张三', math: 80 },
  { studentId: 'student-2', name: '黄邓魁', math: 75 }
]

async function mountDialog() {
  const rows = buildScoreRecognitionPreview(
    [{ name: '张三', score: 90 }, { name: '吴承宇', score: 88 }],
    students,
    'math',
    100
  )
  const wrapper = shallowMount(ScoreRecognitionPreviewDialog, {
    props: { visible: false, rows, ignoredNames: ['吴承宇'], fullMark: 100 },
    global: {
      stubs: {
        ElDialog: { template: '<div><slot /><slot name="footer" /></div>' },
        ElAlert: { template: '<div><slot name="title" /><slot /></div>' },
        ElTable: { template: '<div />' },
        ElButton: { template: '<button><slot /></button>' }
      }
    }
  })
  await wrapper.setProps({ visible: true })
  return { wrapper, state: wrapper.vm as unknown as DialogStateType }
}

describe('ScoreRecognitionPreviewDialog', () => {
  it('checks only uniquely matched valid scores by default', async () => {
    const { wrapper, state } = await mountDialog()

    expect(state.tableData.map((row) => row.name)).toEqual(['张三', '黄邓魁'])
    expect(state.selectedStudentIds).toEqual(['student-1'])
    state.handleConfirm()
    expect(wrapper.emitted('confirm')?.[0]?.[0]).toMatchObject([
      { studentId: 'student-1', score: 90 }
    ])
  })

  it('requires a manual check after entering an unrecognized student score', async () => {
    const { wrapper, state } = await mountDialog()
    const missing = state.tableData[1]
    missing.score = 86
    state.updateScore(missing)

    expect(missing.valid).toBe(true)
    expect(missing.willOverwrite).toBe(true)
    expect(state.selectedStudentIds).toEqual(['student-1'])

    state.setSelected('student-2', true)
    state.handleConfirm()
    expect(wrapper.emitted('confirm')?.[0]?.[0]).toMatchObject([
      { studentId: 'student-1', score: 90 },
      { studentId: 'student-2', score: 86 }
    ])
  })

  it('removes a checked row when its edited score becomes invalid', async () => {
    const { wrapper, state } = await mountDialog()
    const matched = state.tableData[0]
    matched.score = 120
    state.updateScore(matched)

    expect(matched.valid).toBe(false)
    expect(state.selectedStudentIds).toEqual([])
    state.handleConfirm()
    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual([])
  })

  it('toggles one student without changing other checked rows', async () => {
    const { state } = await mountDialog()
    const missing = state.tableData[1]
    state.setSelected('student-2', true)
    expect(state.selectedStudentIds).toEqual(['student-1'])

    missing.score = 86
    state.updateScore(missing)
    state.setSelected('student-2', true)
    expect(state.selectedStudentIds).toEqual(['student-1', 'student-2'])

    state.setSelected('student-1', false)
    expect(state.selectedStudentIds).toEqual(['student-2'])
  })

  it('leaves roster-assisted name corrections unchecked until manually reviewed', async () => {
    const rows = buildScoreRecognitionPreview(
      [{ name: '黄邓魁', rawName: '吴承宇', score: 88 }],
      [{ studentId: 'student-2', name: '黄邓魁' }],
      'math',
      100
    )
    const wrapper = shallowMount(ScoreRecognitionPreviewDialog, {
      props: { visible: false, rows, ignoredNames: [], fullMark: 100 },
      global: {
        stubs: {
          ElDialog: { template: '<div><slot /><slot name="footer" /></div>' },
          ElAlert: { template: '<div><slot name="title" /><slot /></div>' },
          ElTable: { template: '<div />' },
          ElButton: { template: '<button><slot /></button>' }
        }
      }
    })
    await wrapper.setProps({ visible: true })
    const state = wrapper.vm as unknown as DialogStateType

    expect(state.tableData[0].source).toBe('suggested')
    expect(state.selectedStudentIds).toEqual([])
    expect(wrapper.text()).toContain('模型未确认姓名对应')
    state.handleConfirm()
    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual([])
  })
})
