import { describe, expect, it } from 'vitest'

import { createRosterSettings, paginateRoster } from '../../src/utils/rosterPrintUtil'
import { RosterTemplateEnum } from '../../src/types/PrintTools'

const students = Array.from({ length: 56 }, (_, index) => ({
  id: String(index),
  name: index < 2 ? '同名学生' : `学生${index}`,
  fields: {}
}))

describe('名单打印分页', () => {
  for (const template of Object.values(RosterTemplateEnum)) {
    it(`${template} 保留全部身份和连续序号，姓名行不跨页`, () => {
      const settings = createRosterSettings(template)
      const pages = paginateRoster(students, settings)
      const rows = pages.flatMap((page) => page.groups.flat())
      expect(rows.map((row) => row.id)).toEqual(students.map((student) => student.id))
      expect(rows.map((row) => row.number)).toEqual(Array.from({ length: 56 }, (_, i) => i + 1))
      for (const page of pages)
        for (const group of page.groups)
          expect(57 + group.length * settings.rowHeight).toBeLessThanOrEqual(page.height - 12)
    })
  }
  it('增大手写行高会增加页数，空名单不产生空白 PDF 页', () => {
    const settings = createRosterSettings(RosterTemplateEnum.Signature)
    const before = paginateRoster(students, settings)
    settings.rowHeight = 15
    expect(paginateRoster(students, settings).length).toBeGreaterThan(before.length)
    expect(paginateRoster([], settings)).toEqual([])
  })
})
