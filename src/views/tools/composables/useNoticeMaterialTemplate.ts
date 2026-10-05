import { computed, nextTick, ref } from 'vue'

import { ElMessage } from 'element-plus'

import { useScoreNoticeStore } from '@/stores/score-notice'
import { ScoreNoticeCommentStatusEnum } from '@/types/ScoreNotice'
import { captureNoticeTemplate } from '@/utils/print-template/captureNoticeTemplateUtil'
import { getNoticeTemplateFields } from '@/utils/print-template/noticeTemplateFieldsUtil'
import { getDefaultGradeRule } from '@/utils/score-notice/scoreNoticeGradeUtil'

import type { Ref } from 'vue'
import type { CardTemplateType, PrintStudentType } from '@/types/PrintTools'
import type { ScoreNoticeStudentType } from '@/types/ScoreNotice'

/** 转换只在用户发起时挂载参考通知，完成后卸载；保存后的模板独立渲染。 */
export function useNoticeMaterialTemplate(
  template: Ref<CardTemplateType>,
  globals: Ref<Record<string, string>>,
  replaceTemplate: (next: CardTemplateType) => Promise<boolean>
) {
  const notice = useScoreNoticeStore()
  const converting = ref(false)
  const capturePreview = ref<{ getElement: () => HTMLElement | null }>()
  const subjects = computed(() =>
    notice.subjects.length
      ? notice.subjects
      : ['语文', '数学', '英语'].map((label, index) => ({
          id: `example-${index}`,
          label,
          sourceColumn: label,
          rule: getDefaultGradeRule(label)
        }))
  )
  const example = computed<ScoreNoticeStudentType>(
    () =>
      notice.selectedStudent || {
        id: 'template-example',
        name: '示例姓名',
        rawValues: Object.fromEntries(
          subjects.value.map((item, index) => [item.id, [96, 82, 67][index % 3]])
        ),
        gradeValues: Object.fromEntries(
          subjects.value.map((item, index) => [item.id, ['A', 'A', 'B'][index % 3]])
        ),
        comment: '你认真对待学习，能够积极思考。希望继续保持阅读习惯，逐步提高表达与解题能力。',
        commentStatus: ScoreNoticeCommentStatusEnum.Manual
      }
  )
  const fixture = computed(() => ({
    title: notice.title,
    noticeDate: notice.noticeDate,
    mode: notice.mode,
    subjects: subjects.value,
    student: example.value
  }))
  const noticeStudents = computed<PrintStudentType[]>(() =>
    notice.students.map((student) => ({
      id: student.sourceStudentId || student.id,
      name: student.name,
      fields: getNoticeTemplateFields(
        student,
        notice.subjects,
        notice.mode,
        notice.title,
        notice.noticeDate
      )
    }))
  )
  /** 图层先替换变量再保存，只把当前示例内容放在本次编辑字段中。 */
  async function convert(): Promise<void> {
    if (converting.value) return
    converting.value = true
    try {
      await nextTick()
      const node = capturePreview.value?.getElement()
      if (!node) throw new Error('参考通知尚未就绪')
      const result = await captureNoticeTemplate(node)
      await replaceTemplate(result)
      if (template.value.id !== result.id) return
      // 公共内容仅保留标题、日期与科目；逐人成绩和评语必须来自所选名单。
      const shared = getNoticeTemplateFields(
        example.value,
        subjects.value,
        notice.mode,
        notice.title,
        notice.noticeDate
      )
      for (const key of Object.keys(shared)) {
        if (key === '姓名' || key === '评语' || /^(成绩|等级描述)\d+$/.test(key)) {
          delete globals.value[key]
        } else globals.value[key] = shared[key]
      }
      ElMessage.success('已生成可编辑素材模板，文字与装饰可分别修改')
    } catch (error) {
      console.error('转换通知素材失败', error)
      ElMessage.error(error instanceof Error ? error.message : '转换失败，请重试')
    } finally {
      converting.value = false
    }
  }
  return { converting, capturePreview, fixture, noticeStudents, convert }
}
