import { computed, nextTick, ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { useScoreNoticeStore } from '@/stores/score-notice'
import { startLoading, stopLoading } from '@/utils/loadingUtil'
import { getScoreNoticeCommentValidationReasons } from '@/utils/score-notice/scoreNoticeCommentUtil'
import {
  copyPngBlob,
  downloadBlob,
  renderScoreNoticeBlob,
  sanitizeFileName
} from '@/utils/score-notice/scoreNoticeImageUtil'
import { createScoreNoticePdf } from '@/utils/score-notice/scoreNoticePdfUtil'
import { createStoredZip } from '@/utils/zipUtil'

import type { Ref } from 'vue'
import type { ScoreNoticeStudentType, ScoreNoticeStateType } from '@/types/ScoreNotice'

interface PreviewExposeType {
  getElement: () => HTMLElement | null
}

/** 通知图片导出独立管理，生成结束后清理离屏学生和加载状态。 */
export function useScoreNoticeExport(
  previewRef: Ref<PreviewExposeType | null>,
  exportPreviewRef: Ref<PreviewExposeType | null>
) {
  const store = useScoreNoticeStore()
  const selectedStudent = computed(() => store.selectedStudent)
  const exporting = ref(false)
  const copying = ref(false)
  const exportStopped = ref(false)
  const exportContext = ref<Pick<
    ScoreNoticeStateType,
    'title' | 'noticeDate' | 'mode' | 'subjects'
  > | null>(null)
  /** 停止后保留已完成图片，供老师下载部分结果。 */
  const handleStopExport = (): void => {
    exportStopped.value = true
  }
  const exportProcessed = ref(0)
  const exportStudent = ref<ScoreNoticeStudentType | null>(null)
  /** 复制当前预览为 PNG 图片，复制失败时回退为下载 */
  const exportCurrentImage = async (copy: boolean): Promise<void> => {
    if (
      !previewRef.value?.getElement() ||
      !selectedStudent.value ||
      exporting.value ||
      copying.value
    )
      return
    const student = JSON.parse(JSON.stringify(selectedStudent.value)) as ScoreNoticeStudentType
    const context = JSON.parse(
      JSON.stringify({
        title: store.title,
        noticeDate: store.noticeDate,
        mode: store.mode,
        subjects: store.subjects
      })
    )
    copying.value = true
    startLoading('正在生成高清图片...')
    try {
      // 当前图片同样使用原尺寸离屏预览，避免预览缩放改变装饰的子像素位置。
      exportContext.value = context
      exportStudent.value = student
      await waitForRender()
      const element = exportPreviewRef.value?.getElement()
      if (!element) throw new Error('离屏预览未就绪')
      const blob = await renderScoreNoticeBlob(element, 2)
      const copied = copy && (await copyPngBlob(blob))
      if (copied) {
        ElMessage.success('成绩通知图片已复制，可直接粘贴发送')
        return
      }
      downloadBlob(blob, `${sanitizeFileName(context.title)}_${sanitizeFileName(student.name)}.png`)
      if (copy) ElMessage.warning('浏览器未允许复制图片，已改为下载 PNG')
      else ElMessage.success('PNG 已下载')
    } catch (error) {
      console.error('生成成绩通知图片失败:', error)
      ElMessage.error('图片生成失败，请稍后重试')
    } finally {
      stopLoading()
      copying.value = false
      exportContext.value = null
      exportStudent.value = null
    }
  }

  /** 等待下一帧渲染完成，确保截图前 DOM 已更新 */
  const waitForRender = async (): Promise<void> => {
    await nextTick()
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
  }

  /** 逐个渲染学生报告并打包为 ZIP 下载 */
  const exportAll = async (format: 'zip' | 'pdf'): Promise<void> => {
    if (exporting.value || copying.value) return
    const exportableStudents = (
      JSON.parse(JSON.stringify(store.students)) as ScoreNoticeStudentType[]
    ).filter((student) => Object.values(student.gradeValues).some(Boolean))
    if (!exportableStudents.length) {
      ElMessage.warning('没有可导出的学生成绩')
      return
    }
    // 分别统计空评语与需修改评语，导出前给出二次确认提示
    const blankStudents = exportableStudents.filter((student) => !student.comment.trim())
    const reviewStudents = exportableStudents.filter(
      (student) =>
        getScoreNoticeCommentValidationReasons(student.comment).length > 0 && student.comment.trim()
    )
    if (blankStudents.length || reviewStudents.length) {
      const details = [
        reviewStudents.length ? `${reviewStudents.length} 名学生的评语需要修改` : '',
        blankStudents.length ? `${blankStudents.length} 名学生尚未生成评语` : ''
      ].filter(Boolean)
      try {
        await ElMessageBox.confirm(
          `${details.join('，')}。这些内容仍会进入报告图片，是否继续导出？`,
          '确认导出',
          { confirmButtonText: '继续导出', cancelButtonText: '返回修改', type: 'warning' }
        )
      } catch {
        return
      }
    }

    exporting.value = true
    exportProcessed.value = 0
    exportStopped.value = false
    exportContext.value = JSON.parse(
      JSON.stringify({
        title: store.title,
        noticeDate: store.noticeDate,
        mode: store.mode,
        subjects: store.subjects
      })
    )
    const context = exportContext.value!
    const entries: Array<{ name: string; data: Blob }> = []
    const failedNames: string[] = []
    try {
      for (const [index, student] of exportableStudents.entries()) {
        if (exportStopped.value) break
        // 切换到当前学生，离屏预览据此渲染对应报告后再截图
        exportStudent.value = student
        await waitForRender()
        const element = exportPreviewRef.value?.getElement()
        if (!element) throw new Error('离屏预览未就绪')
        try {
          const blob = await renderScoreNoticeBlob(element, 1.5)
          entries.push({
            name: `${index + 1}-${sanitizeFileName(context.title)}_${sanitizeFileName(student.name)}.png`,
            data: blob
          })
        } catch (error) {
          // 单个学生失败不中断导出，记录名字最后统一提示
          console.error(`生成 ${student.name} 成绩通知失败:`, error)
          failedNames.push(student.name)
        }
        exportProcessed.value = index + 1
      }

      if (!entries.length && exportStopped.value) {
        ElMessage.info('已停止导出')
        return
      }
      if (!entries.length) throw new Error('所有图片均生成失败')
      const blob =
        format === 'zip' ? await createStoredZip(entries) : await createScoreNoticePdf(entries)
      downloadBlob(
        blob,
        `${sanitizeFileName(context.title)}_${context.noticeDate}${exportStopped.value ? '_部分结果' : ''}.${format}`
      )
      if (failedNames.length) {
        ElMessage.warning(`文件已导出，${failedNames.join('、')}生成失败`)
      } else {
        ElMessage.success(`已导出 ${entries.length} 名学生的成绩通知图片`)
      }
    } catch (error) {
      console.error('批量导出成绩通知失败:', error)
      ElMessage.error(error instanceof Error ? error.message : '批量导出失败')
    } finally {
      exporting.value = false
      exportStudent.value = null
      exportContext.value = null
    }
  }

  const handleCopyImage = (): Promise<void> => exportCurrentImage(true)
  const handleDownloadImage = (): Promise<void> => exportCurrentImage(false)
  const handleExportZip = (): Promise<void> => exportAll('zip')
  const handleExportPdf = (): Promise<void> => exportAll('pdf')
  return {
    exporting,
    copying,
    exportProcessed,
    exportStudent,
    exportContext,
    handleStopExport,
    handleCopyImage,
    handleDownloadImage,
    handleExportZip,
    handleExportPdf
  }
}
