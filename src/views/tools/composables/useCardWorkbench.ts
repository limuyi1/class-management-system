import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useNoticeMaterialTemplate } from './useNoticeMaterialTemplate'
import { useCardTemplateEditor } from './useCardTemplateEditor'
import { useCardBatchExport } from './useCardBatchExport'
import { renderCardTemplate } from '@/utils/cardTemplateUtil'
import { printCanvasBlob } from '@/utils/printCanvasUtil'
import { useWorkspaceTaskLock } from '@/hooks/useWorkspaceTaskLock'
import { useWorkspaceStore } from '@/stores/workspace'
import { getCardDefaultFields } from '@/utils/print-template/cardPresetUtil'
import { formatExportDate } from '@/utils/downloadUtil'

import type { CardTemplateType, PrintStudentType } from '@/types/PrintTools'

/** 组织成品套用、公共文案、高级编辑与批量导出，页面只负责排版。 */
export function useCardWorkbench(preset: 'certificate' | 'card' | 'blank') {
  const advancedEditing = ref(preset === 'blank')
  const productVisible = ref(false)
  const productVersion = ref(0)
  /** 显式请求图片时冻结当前成品，预览缩放和编辑手柄不进入导出。 */
  async function createPreviewImage(): Promise<Blob> {
    const snapshot = JSON.parse(JSON.stringify(template.value)) as CardTemplateType
    const result = await renderCardTemplate(snapshot, { ...fields.value }, snapshot.scene ? 2 : 1)
    try {
      return await printCanvasBlob(result.page.canvas)
    } finally {
      result.page.canvas.width = 0
    }
  }
  /** 添加文字仅用于高级编辑，保持预览画布位置。 */
  function handleAddText(): void {
    addText()
    advancedEditing.value = true
  }
  const router = useRouter()
  const workspace = useWorkspaceStore()
  const {
    tools,
    template,
    selectedLayerId,
    saving,
    dirty,
    fileInput,
    uploadMode,
    libraryVisible,
    replaceTemplate,
    saveTemplate,
    deleteTemplate,
    addText,
    upload,
    useAttachments,
    reorderLayer
  } = useCardTemplateEditor(preset)
  const students = ref<PrintStudentType[]>([])
  const previewIndex = ref(1)
  const globals = ref<Record<string, string>>({
    标题: preset === 'card' ? '表扬卡' : '奖 状',
    称号: '学习之星',
    正文: '在本学期的学习中，勤奋努力、表现优异。\n特发此状，以资鼓励。',
    班级: workspace.activePeriod?.className || '',
    学期: workspace.activePeriod?.termName || '',
    日期: formatExportDate(),
    学校: '',
    落款: ''
  })
  const { converting, capturePreview, fixture, noticeStudents, convert } =
    useNoticeMaterialTemplate(template, globals, replaceTemplate)
  useWorkspaceTaskLock(
    computed(() => converting.value || saving.value),
    '模板正在转换或保存，请稍后切换班级'
  )
  /** 转换后留在常规制作页填写内容，需要改版时再打开高级设置。 */
  async function handleConvertNotice(): Promise<void> {
    const previousId = template.value.id
    await convert()
    if (template.value.id !== previousId) {
      dirty.value = true
      advancedEditing.value = false
    }
  }
  /** 套用成品模板时恢复公共文案，工作区名称和日期沿用本次制作。 */
  async function chooseTemplate(next: CardTemplateType): Promise<void> {
    if (!(await replaceTemplate(next))) return
    advancedEditing.value = !next.scene && !next.layers.length
    if (next.defaultFields) Object.assign(globals.value, next.defaultFields)
    else if (!next.scene && next.layers.some((layer) => layer.text === '{{标题}}'))
      globals.value.标题 = next.width < 200 ? '表扬卡' : '奖 状'
  }
  /** 只保存公共文案，逐人的姓名、分数、评语仍从当前名单读取。 */
  async function saveCurrentTemplate(copy = false): Promise<void> {
    await saveTemplate(copy, getCardDefaultFields(template.value, globals.value))
  }
  const currentStudent = computed(() => students.value[previewIndex.value - 1])
  const fields = computed(() => ({
    ...globals.value,
    ...currentStudent.value?.fields,
    姓名: currentStudent.value?.name || '示例姓名'
  }))
  const fieldNames = computed(() => [
    ...new Set([
      '姓名',
      ...Object.keys(globals.value),
      ...students.value.flatMap((student) => Object.keys(student.fields))
    ])
  ])
  const { busy, cancelled, progress, total, errors, fourUp, exportBatch } = useCardBatchExport(
    template,
    students,
    currentStudent,
    globals
  )
  watch(
    [template, fields],
    () => {
      productVersion.value++
    },
    { deep: true }
  )
  watch(students, () => {
    previewIndex.value = Math.max(1, Math.min(previewIndex.value, students.value.length))
  })
  /** 指定图层用途后打开文件选择器或素材库。 */
  function openMaterial(mode: 'background' | 'image' | 'replace', library = false): void {
    uploadMode.value = mode
    if (library) libraryVisible.value = true
    else fileInput.value?.click()
  }
  onBeforeRouteLeave(async () => {
    if (busy.value || converting.value || saving.value) {
      ElMessage.warning('请先停止导出')
      return false
    }
    if (dirty.value) {
      try {
        await ElMessageBox.confirm('模板修改尚未保存，是否放弃修改并离开？', '离开制作', {
          type: 'warning'
        })
      } catch {
        return false
      }
    }
  })
  onBeforeUnmount(() => {
    cancelled.value = true
  })
  return {
    router,
    advancedEditing,
    productVisible,
    productVersion,
    createPreviewImage,
    handleAddText,
    tools,
    template,
    selectedLayerId,
    saving,
    dirty,
    fileInput,
    libraryVisible,
    students,
    previewIndex,
    globals,
    converting,
    capturePreview,
    fixture,
    noticeStudents,
    handleConvertNotice,
    chooseTemplate,
    saveCurrentTemplate,
    currentStudent,
    fields,
    fieldNames,
    busy,
    cancelled,
    progress,
    total,
    errors,
    fourUp,
    exportBatch,
    openMaterial,
    deleteTemplate,
    upload,
    useAttachments,
    reorderLayer
  }
}
