import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'

import ScoreNoticeControlPanel from '../../src/views/score-notice/components/ScoreNoticeControlPanel.vue'
import { useScoreNoticeStore } from '../../src/stores/score-notice'
import { ScoreNoticeCommentStatusEnum } from '../../src/types/ScoreNotice'

/**
 * ScoreNoticeControlPanel 组件测试
 * 测试目标：成绩通知控制面板（导入 → 设置 → 学生评语 → 导出 的分步面板）
 * 覆盖功能：分步折叠面板的默认展开与独立开合、批量生成事件、评语草稿的保存机制、导出就绪状态
 */
describe('ScoreNoticeControlPanel', () => {
  // 每个用例前创建全新的 Pinia 实例，隔离成绩通知 store 状态
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // 以固定的面板 props 挂载组件，简化各用例的重复配置
  const mountPanel = () =>
    mount(ScoreNoticeControlPanel, {
      props: {
        aiConfigured: true,
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

  // 向成绩通知 store 注入两名学生数据：一条待处理、一条已生成
  const seedStudents = (): void => {
    const store = useScoreNoticeStore()
    store.$patch({
      sourceFileName: '期中考试.xlsx',
      selectedStudentId: 'student-1',
      students: [
        {
          id: 'student-1',
          name: '张明轩',
          rawValues: {},
          gradeValues: { chinese: 'A' },
          comment: '',
          commentStatus: ScoreNoticeCommentStatusEnum.Pending
        },
        {
          id: 'student-2',
          name: '李雨桐',
          rawValues: {},
          gradeValues: { chinese: 'B' },
          comment: '已有评语',
          commentStatus: ScoreNoticeCommentStatusEnum.Generated
        }
      ]
    })
  }

  it('starts from import and disables later steps before data is available', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('[data-testid="notice-section-import"]').attributes('aria-expanded')).toBe(
      'true'
    )
    expect(wrapper.get('[data-testid="notice-section-settings"]').attributes('disabled')).toBe('')
    expect(wrapper.get('[data-testid="notice-section-students"]').attributes('disabled')).toBe('')
    expect(wrapper.text()).toContain('选择 Excel 成绩表')
    expect(wrapper.text()).toContain('完成前面步骤后即可导出')
  })

  it('opens settings by default when imported data already exists', () => {
    seedStudents()
    const wrapper = mountPanel()

    expect(wrapper.get('[data-testid="notice-section-import"]').attributes('aria-expanded')).toBe(
      'false'
    )
    expect(wrapper.get('[data-testid="notice-section-settings"]').attributes('aria-expanded')).toBe(
      'true'
    )
    expect(wrapper.text()).toContain('期中考试.xlsx')
    expect(wrapper.get('.notice-settings__appearance').text()).toContain('默认手写字体')
    expect(wrapper.get('.notice-settings__appearance').text()).toContain('更换字体')
    expect(wrapper.find('.notice-settings__appearance-toggle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('左侧预览会实时更新')
    expect(wrapper.text()).not.toContain('处理学生评语')
  })

  it('opens the comment workspace without closing settings', async () => {
    seedStudents()
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="notice-section-students"]').trigger('click')

    expect(wrapper.get('[data-testid="notice-section-settings"]').attributes('aria-expanded')).toBe(
      'true'
    )
    expect(wrapper.get('[data-testid="notice-section-students"]').attributes('aria-expanded')).toBe(
      'true'
    )
    expect(wrapper.text()).toContain('待处理 1')
    expect(wrapper.text()).toContain('生成待处理评语（1）')
  })

  it('allows each available section to open and close independently', async () => {
    seedStudents()
    const wrapper = mountPanel()
    const importSection = wrapper.get('[data-testid="notice-section-import"]')
    const settingsSection = wrapper.get('[data-testid="notice-section-settings"]')
    const studentsSection = wrapper.get('[data-testid="notice-section-students"]')

    await importSection.trigger('click')
    await studentsSection.trigger('click')

    expect(importSection.attributes('aria-expanded')).toBe('true')
    expect(settingsSection.attributes('aria-expanded')).toBe('true')
    expect(studentsSection.attributes('aria-expanded')).toBe('true')

    await settingsSection.trigger('click')

    expect(importSection.attributes('aria-expanded')).toBe('true')
    expect(settingsSection.attributes('aria-expanded')).toBe('false')
    expect(studentsSection.attributes('aria-expanded')).toBe('true')

    await studentsSection.trigger('click')

    expect(importSection.attributes('aria-expanded')).toBe('true')
    expect(settingsSection.attributes('aria-expanded')).toBe('false')
    expect(studentsSection.attributes('aria-expanded')).toBe('false')
  })

  it('does not reopen settings when persisted students are patched after filtering', async () => {
    seedStudents()
    const store = useScoreNoticeStore()
    const wrapper = mountPanel()
    const settingsSection = wrapper.get('[data-testid="notice-section-settings"]')

    await settingsSection.trigger('click')
    expect(settingsSection.attributes('aria-expanded')).toBe('false')

    const completedFilter = wrapper
      .findAll('.notice-comments__filters button')
      .find((button) => button.text().includes('已完成'))
    expect(completedFilter).toBeDefined()

    await completedFilter!.trigger('click')
    // 模拟持久化数据加载后触发 store 补丁，验证已折叠的设置面板不被重新展开
    store.students = store.students.map((student) => ({ ...student }))
    await wrapper.vm.$nextTick()

    expect(store.selectedStudentId).toBe('student-2')
    expect(settingsSection.attributes('aria-expanded')).toBe('false')
  })

  it('emits a safe fill-empty batch action from the primary button', async () => {
    seedStudents()
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="notice-section-students"]').trigger('click')

    await wrapper.get('.notice-comments__batch-button').trigger('click')

    expect(wrapper.emitted('generateBatch')).toEqual([['skip']])
  })

  it('keeps a generated comment as a draft until the user saves it', async () => {
    seedStudents()
    const store = useScoreNoticeStore()
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="notice-section-students"]').trigger('click')
    const generated =
      '本次考试整体表现较为稳定，平时能够认真完成学习任务，也会主动整理需要巩固的内容。建议继续保持专注听讲、及时订正和规律复习的习惯，让各科基础更加扎实，面对新的学习任务时更有信心。'.repeat(
        3
      )

    // 直接调用组件方法写入草稿，验证草稿在手动保存前不会落入 store
    ;(wrapper.vm as unknown as { setCommentDraft: (comment: string) => void }).setCommentDraft(
      generated
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.get('textarea').element.value).toBe(generated)
    expect(store.students[0].comment).toBe('')
    expect(wrapper.get('.notice-comments__save-button').text()).toContain('未保存')

    await wrapper.get('.notice-comments__save-button').trigger('click')
    expect(store.students[0].comment).toBe(generated)
    expect(store.students[0].commentStatus).toBe(ScoreNoticeCommentStatusEnum.Manual)
  })

  it('saves the current draft before switching to another status queue', async () => {
    seedStudents()
    const store = useScoreNoticeStore()
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="notice-section-students"]').trigger('click')
    const edited = '评语草稿会在切换学生前自动保存。'

    await wrapper.get('textarea').setValue(edited)
    const completedFilter = wrapper
      .findAll('.notice-comments__filters button')
      .find((button) => button.text().includes('已完成'))
    expect(completedFilter).toBeDefined()

    await completedFilter!.trigger('click')

    expect(store.students[0].comment).toBe(edited)
    expect(store.selectedStudentId).toBe('student-2')
  })

  it('shows review counts and export readiness before allowing a warning-backed export', async () => {
    const store = useScoreNoticeStore()
    seedStudents()
    store.students[0].comment = '本次获得95分，继续努力。'
    store.students[0].commentStatus = ScoreNoticeCommentStatusEnum.NeedsReview
    store.students[0].validationReasons = ['包含具体数字或百分比']
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('1 项待确认')
    expect(wrapper.text()).toContain('仍可导出')

    await wrapper.get('.notice-export__actions .el-button--primary').trigger('click')
    expect(wrapper.emitted('exportZip')).toHaveLength(1)
  })
})
