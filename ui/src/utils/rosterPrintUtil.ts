import { RosterTemplateEnum } from '@/types/PrintTools'

import type {
  PrintStudentType,
  RosterPrintPageType,
  RosterPrintSettingsType
} from '@/types/PrintTools'

export const ROSTER_TEMPLATES = [
  { value: RosterTemplateEnum.Compact, label: '精简名册', description: '双栏名单，方便核对和张贴' },
  { value: RosterTemplateEnum.Collection, label: '收交登记', description: '作业、回执和材料收交' },
  { value: RosterTemplateEnum.Attendance, label: '周点名表', description: '工作日上下午点名' },
  { value: RosterTemplateEnum.Scores, label: '空白成绩表', description: '留白登记测评成绩' },
  { value: RosterTemplateEnum.Signature, label: '签字登记', description: '家长会签到和资料签收' }
]

/** 生成可直接打印的模板初始设置。 */
export function createRosterSettings(
  template: RosterTemplateEnum,
  subtitle = ''
): RosterPrintSettingsType {
  return {
    template,
    title: ROSTER_TEMPLATES.find((item) => item.value === template)?.label || '班级名单',
    subtitle,
    landscape: template === RosterTemplateEnum.Attendance,
    columns:
      template === RosterTemplateEnum.Attendance
        ? [
            '周一\n上午',
            '周一\n下午',
            '周二\n上午',
            '周二\n下午',
            '周三\n上午',
            '周三\n下午',
            '周四\n上午',
            '周四\n下午',
            '周五\n上午',
            '周五\n下午'
          ]
        : template === RosterTemplateEnum.Signature
          ? ['签字', '日期']
          : Array.from({ length: 6 }, () => ''),
    rowHeight:
      template === RosterTemplateEnum.Signature
        ? 10
        : template === RosterTemplateEnum.Attendance
          ? 4.7
          : 7,
    remarks: true,
    doubleColumn: template === RosterTemplateEnum.Compact
  }
}

/** 根据真实纸张高度分页，保留名单顺序与连续序号。 */
export function paginateRoster(
  students: PrintStudentType[],
  settings: RosterPrintSettingsType
): RosterPrintPageType[] {
  const width = settings.landscape ? 297 : 210
  const height = settings.landscape ? 210 : 297
  const rows = Math.max(1, Math.floor((height - 74) / Math.max(4, settings.rowHeight)))
  const groupCount =
    settings.template === RosterTemplateEnum.Compact && settings.doubleColumn ? 2 : 1
  const perPage = rows * groupCount
  const pageCount = Math.ceil(students.length / perPage)
  return Array.from({ length: pageCount }, (_, index) => ({
    width,
    height,
    page: index + 1,
    pageCount,
    groups: Array.from({ length: groupCount }, (_, group) => {
      const offset = index * perPage + group * rows
      return students
        .slice(offset, offset + rows)
        .map((student, i) => ({ ...student, number: offset + i + 1 }))
    })
  }))
}
