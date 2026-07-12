import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'

import ScoreNoticeControlPanel from '../../src/views/score-notice/components/ScoreNoticeControlPanel.vue'
import { useScoreNoticeStore } from '../../src/stores/score-notice'
import { ScoreNoticeCommentStatusEnum } from '../../src/types/ScoreNotice'

describe('ScoreNoticeControlPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mountPanel = () =>
    mount(ScoreNoticeControlPanel, {
      props: {
        batchGenerating: false,
        batchProcessed: 0,
        batchTotal: 0,
        singleGenerating: false,
        handwriteFontName: '',
        hasCustomHandwriteFont: false,
        handwriteFontApplying: false,
        exporting: false,
        exportProcessed: 0
      },
      global: { plugins: [ElementPlus] }
    })

  it('keeps settings and student sections collapsible while export stays fixed', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('[data-testid="notice-section-settings"]').attributes('aria-expanded')).toBe(
      'true'
    )
    expect(wrapper.get('[data-testid="notice-section-students"]').attributes('aria-expanded')).toBe(
      'true'
    )
    expect(wrapper.find('[data-testid="notice-section-export"]').exists()).toBe(false)
    expect(wrapper.get('.notice-panel__export').text()).toContain('导出与发送')
    expect(wrapper.text()).toContain('批量生成/重新生成评语（AI）')
    expect(wrapper.findComponent({ name: 'ElScrollbar' }).exists()).toBe(true)
  })

  it.each([
    ['settings', 'notice-section-settings'],
    ['students', 'notice-section-students']
  ])('collapses the %s section from its title button', async (sectionClass, testId) => {
    const wrapper = mountPanel()
    const button = wrapper.get(`[data-testid="${testId}"]`)

    await button.trigger('click')

    expect(button.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get(`.notice-panel__${sectionClass}`).classes()).toContain('is-collapsed')
  })

  it('emits direct image copy from a generated student row action', async () => {
    const store = useScoreNoticeStore()
    store.$patch({
      selectedStudentId: 'student-1',
      students: [
        {
          id: 'student-1',
          name: '张明轩',
          rawValues: {},
          gradeValues: {},
          comment: '已有评语',
          commentStatus: ScoreNoticeCommentStatusEnum.Generated
        },
        {
          id: 'student-2',
          name: '李雨桐',
          rawValues: {},
          gradeValues: {},
          comment: '已有评语',
          commentStatus: ScoreNoticeCommentStatusEnum.Generated
        }
      ]
    })
    const wrapper = mountPanel()

    ;(
      wrapper.vm as unknown as {
        handleStudentAction: (studentId: string, hasComment: boolean) => void
      }
    ).handleStudentAction('student-2', true)

    expect(wrapper.emitted('copyStudent')).toEqual([['student-2']])
  })

  it('shows a needs-review status for a comment containing a concrete score', () => {
    const store = useScoreNoticeStore()
    store.$patch({
      selectedStudentId: 'student-1',
      students: [
        {
          id: 'student-1',
          name: '张明轩',
          rawValues: {},
          gradeValues: {},
          comment: '本次考试获得了95分，平时学习较认真，后续需要继续保持稳定。',
          commentStatus: ScoreNoticeCommentStatusEnum.NeedsReview,
          validationReasons: ['包含具体数字或百分比']
        }
      ]
    })

    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('需修改')
    expect(wrapper.text()).toContain('包含具体数字或百分比')
  })

  it('writes an edited comment only after saving', async () => {
    const store = useScoreNoticeStore()
    const original =
      '本次考试整体表现较为稳定，平时学习态度认真，建议继续加强复习与检查。'
    const edited =
      '本次考试整体表现较为稳定，平时学习态度认真，后续继续加强复习与细心检查。'
    store.$patch({
      selectedStudentId: 'student-1',
      students: [
        {
          id: 'student-1',
          name: '张明轩',
          rawValues: {},
          gradeValues: {},
          comment: original,
          commentStatus: ScoreNoticeCommentStatusEnum.Generated
        }
      ]
    })
    const wrapper = mountPanel()
    const textarea = wrapper.get('textarea')

    await textarea.setValue(edited)
    expect(store.students[0].comment).toBe(original)

    const saveButton = wrapper.get('.notice-panel__editor-actions .el-button--primary')
    expect(saveButton.attributes('disabled')).toBeUndefined()

    await saveButton.trigger('click')
    expect(store.students[0].comment).toBe(edited)
  })

  it('keeps a generated comment as a draft until the user saves it', async () => {
    const store = useScoreNoticeStore()
    const original = '原有评语内容。'
    const generated =
      '本次考试整体表现较为稳定，平时能够认真完成学习任务，也会主动整理需要巩固的内容。建议继续保持专注听讲、及时订正和规律复习的习惯，让各科基础更加扎实，面对新的学习任务时更有信心。'.repeat(
        3
      )
    store.$patch({
      selectedStudentId: 'student-1',
      students: [
        {
          id: 'student-1',
          name: '张明轩',
          rawValues: {},
          gradeValues: {},
          comment: original,
          commentStatus: ScoreNoticeCommentStatusEnum.Generated
        }
      ]
    })
    const wrapper = mountPanel()

    ;(wrapper.vm as unknown as { setCommentDraft: (comment: string) => void }).setCommentDraft(
      generated
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.get('textarea').element.value).toBe(generated)
    expect(store.students[0].comment).toBe(original)

    await wrapper.get('.notice-panel__editor-actions .el-button--primary').trigger('click')
    expect(store.students[0].comment).toBe(generated)
    expect(store.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Manual)
  })
})
