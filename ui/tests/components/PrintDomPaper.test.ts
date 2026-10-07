import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RosterPaper from '../../src/views/tools/components/roster/RosterPaper.vue'
import ExamPaper from '../../src/views/tools/components/exam/ExamPaper.vue'
import { buildExamPrintAnalysis, paginateExamPrint } from '../../src/utils/examPrintUtil'
import { createRosterSettings, paginateRoster } from '../../src/utils/rosterPrintUtil'
import { RosterTemplateEnum } from '../../src/types/PrintTools'

describe('打印 DOM 组件', () => {
  it('五种名单都用表格显示连续编号，预览没有整页图片', () => {
    const students = Array.from({ length: 61 }, (_, index) => ({
      id: String(index),
      name: index < 2 ? '同名学生' : `学生${index}`,
      fields: {}
    }))
    for (const preset of Object.values(RosterTemplateEnum)) {
      const settings = createRosterSettings(preset)
      const rows: string[] = []
      for (const page of paginateRoster(students, settings)) {
        const wrapper = mount(RosterPaper, { props: { page, settings, count: students.length } })
        rows.push(...wrapper.findAll('tbody tr td:first-child').map((cell) => cell.text()))
        expect(wrapper.find('table').exists()).toBe(true)
        expect(wrapper.find('img').exists()).toBe(false)
        wrapper.unmount()
      }
      expect(rows).toEqual(students.map((_, index) => String(index + 1)))
    }
  })
  it('摘要条形是 DOM，明细零分和空值分开，多页编号完整', () => {
    const analysis = buildExamPrintAnalysis(
      Array.from({ length: 60 }, (_, index) => ({
        studentId: String(index),
        name: '同名学生',
        score: index === 0 ? 0 : index === 1 ? null : index
      })),
      'score',
      100
    )
    expect(paginateExamPrint(analysis, false)).toHaveLength(1)
    const pages = paginateExamPrint(analysis, true)
    expect(pages).toHaveLength(4)
    expect(pages.flatMap((page) => page.rows.map((row) => row.number))).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1)
    )
    const props = { analysis, title: '期中分析', subtitle: '测试班级' }
    const summary = mount(ExamPaper, { props: { ...props, page: pages[0] } })
    expect(summary.findAll('.exam-summary__track')).toHaveLength(5)
    expect(summary.find('canvas').exists()).toBe(false)
    summary.unmount()
    const details = mount(ExamPaper, { props: { ...props, page: pages[1] } })
    expect(details.findAll('tbody tr')[0].findAll('td')[2].text()).toBe('0')
    expect(details.findAll('tbody tr')[1].findAll('td')[2].text()).toBe('无有效成绩')
    details.unmount()
  })
})
