import { computed, ref } from 'vue'

import { ElMessage } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useExcelPreviewImport } from '@/hooks/useExcelPreviewImport'
import { buildExcelDataFromHeaderRow, exportExcel } from '@/utils/xlsxUtil'
import {
  buildNameEntries,
  buildNameListCompareResult,
  findSuggestedNameColumn,
  parsePastedRows
} from '@/views/tools/utils/nameListCompare'
import { useDataSourceStore } from '@/stores/data-source'
import { NAME_LABEL, NAME_PROP } from '@/constants'

import type {
  NameListCompareGroupsType,
  NameListCompareImportedSourceType,
  NameListCompareModeType,
  NameListCompareRowType,
  NameListCompareSourceKeyType
} from '@/types/NameListCompare'

/** 管理名单来源、导入确认和结果导出，页面只负责组合展示。 */
export function useNameListComparison() {
  /** 隐藏的文件选择输入框，由上传按钮间接触发 */
  const fileInputRef = ref<HTMLInputElement | null>(null)

  /** 粘贴导入弹窗的显示与文本内容 */
  const pasteDialogVisible = ref(false)

  const pasteText = ref('')

  /** 姓名列确认弹窗的显示状态与待处理来源槽位 */
  const columnSelectorVisible = ref(false)

  const pendingImportKey = ref<NameListCompareSourceKeyType>('comparison')

  /** 核对模式与外部模式下的基准槽位 */
  const mode = ref<NameListCompareModeType>('system')

  const baselineKey = ref<'sourceA' | 'sourceB'>('sourceA')

  /** 是否只展示差异行 */
  const onlyDifference = ref(false)

  /** 各来源槽位的导入数据 */
  const importedSources = ref<
    Partial<Record<NameListCompareSourceKeyType, NameListCompareImportedSourceType>>
  >({})

  /** 姓名列确认弹窗的表头、行数据与建议姓名列 */
  const columnSelectorHeaders = ref<string[]>([])

  const columnSelectorRows = ref<NameListCompareRowType[]>([])

  const suggestedNameColumn = ref('')

  const dataSourceStore = useDataSourceStore()

  const { enabledData } = storeToRefs(dataSourceStore)

  // 文件读取、空表校验和错误提示走公共层；双来源槽位与姓名列确认仍由名单核对维护。
  const { parseRawFile } = useExcelPreviewImport({ errorLogLabel: '导入名单 Excel' })

  /** 从系统学生数据构造仅含姓名列的名单行 */
  const systemRows = computed<NameListCompareRowType[]>(() => {
    return enabledData.value.map((student) => ({
      [NAME_LABEL]: student[NAME_PROP]
    }))
  })

  /** 将系统名单包装为统一来源结构，作为系统核对模式的基准来源 */
  const systemSource = computed<NameListCompareImportedSourceType>(() => ({
    key: 'comparison',
    kind: 'system',
    label: '系统名单',
    headers: [NAME_LABEL],
    rows: systemRows.value,
    nameColumn: NAME_LABEL
  }))

  /** 根据当前模式与基准槽位，推导出实际的基准来源与对照来源 */
  const activeSourceMap = computed(() => {
    if (mode.value === 'system') {
      return {
        baseline: systemSource.value,
        comparison: importedSources.value.comparison || null
      }
    }

    const activeBaseline = importedSources.value[baselineKey.value] || null
    // 外部模式下，对照来源始终是基准槽位的另一侧
    const comparisonKey = baselineKey.value === 'sourceA' ? 'sourceB' : 'sourceA'
    return {
      baseline: activeBaseline,
      comparison: importedSources.value[comparisonKey] || null
    }
  })

  /** 基准来源的展示标签 */
  const baselineDisplayLabel = computed(() => {
    if (mode.value === 'system') return '基准名单（系统）'
    return `基准名单（${activeSourceMap.value.baseline?.label || '未选择'}）`
  })

  /** 对照来源的展示标签 */
  const comparisonDisplayLabel = computed(() => {
    if (mode.value === 'system') {
      return `对照名单（${activeSourceMap.value.comparison?.label || '未导入'}）`
    }
    return `对照名单（${activeSourceMap.value.comparison?.label || '未选择'}）`
  })

  /** 基准与对照来源都具备姓名列时，生成名单对比结果 */
  const compareResult = computed(() => {
    const baselineSource = activeSourceMap.value.baseline
    const comparisonSource = activeSourceMap.value.comparison

    if (!baselineSource || !comparisonSource) return null
    if (!baselineSource.nameColumn || !comparisonSource.nameColumn) return null

    const baselineEntries = buildNameEntries(baselineSource.rows, baselineSource.nameColumn)
    const comparisonEntries = buildNameEntries(comparisonSource.rows, comparisonSource.nameColumn)

    return buildNameListCompareResult({
      baselineEntries,
      comparisonEntries
    })
  })

  /** 切换核对模式并重置差异过滤 */
  function switchMode(value: NameListCompareModeType): void {
    mode.value = value
    onlyDifference.value = false
  }

  /** 打开姓名列确认弹窗，预填对应来源的表头、行数据与建议姓名列 */
  function openNameColumnDialog(key: NameListCompareSourceKeyType): void {
    pendingImportKey.value = key
    columnSelectorHeaders.value = importedSources.value[key]?.headers || []
    columnSelectorRows.value = importedSources.value[key]?.rows || []
    suggestedNameColumn.value = findSuggestedNameColumn(columnSelectorHeaders.value)
    columnSelectorVisible.value = true
  }

  /** 为指定来源槽位触发文件选择 */
  function openUploadFor(key: NameListCompareSourceKeyType): void {
    pendingImportKey.value = key
    fileInputRef.value?.click()
  }

  /** 打开粘贴导入弹窗 */
  function openPasteDialog(key: NameListCompareSourceKeyType): void {
    pendingImportKey.value = key
    pasteText.value = ''
    pasteDialogVisible.value = true
  }

  /** 解析上传的 Excel，写入对应来源槽位后弹出姓名列确认 */
  async function handleFileChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    // 清空 value，使再次选择同一文件时也能触发 change 事件
    target.value = ''
    if (!file) return

    const preview = await parseRawFile(file)
    if (!preview) return
    const { header, data } = buildExcelDataFromHeaderRow(
      preview.rows,
      preview.suggestedHeaderRowIndex
    )
    if (header.length === 0) {
      ElMessage.warning('未读取到可用表头')
      return
    }

    importedSources.value[pendingImportKey.value] = {
      key: pendingImportKey.value,
      kind: 'excel',
      label: file.name,
      headers: header,
      rows: data,
      nameColumn: ''
    }
    openNameColumnDialog(pendingImportKey.value)
  }

  /** 解析粘贴内容并写入来源槽位；单列“姓名”时免确认直接导入 */
  function confirmPasteImport(): void {
    const text = pasteText.value.trim()
    if (!text) {
      ElMessage.warning('请先粘贴名单或表格内容')
      return
    }

    const { headers, rows } = parsePastedRows(text)
    if (headers.length === 0 || rows.length === 0) {
      ElMessage.warning('未识别到可用数据')
      return
    }

    // 仅单列且表头为“姓名”时可直接确定姓名列，跳过确认弹窗
    importedSources.value[pendingImportKey.value] = {
      key: pendingImportKey.value,
      kind: 'paste',
      label: '粘贴内容',
      headers,
      rows,
      nameColumn: headers.length === 1 && headers[0] === NAME_LABEL ? NAME_LABEL : ''
    }
    pasteDialogVisible.value = false

    if (headers.length === 1 && headers[0] === NAME_LABEL) {
      ElMessage.success('名单已导入')
      return
    }

    openNameColumnDialog(pendingImportKey.value)
  }

  /** 清空指定来源槽位的导入数据 */
  function clearSource(key: NameListCompareSourceKeyType): void {
    delete importedSources.value[key]
  }

  /** 清空当前模式下的全部导入数据 */
  function clearCurrentImports(): void {
    if (mode.value === 'system') {
      clearSource('comparison')
      return
    }

    clearSource('sourceA')
    clearSource('sourceB')
  }

  /** 更新指定来源的姓名列 */
  function updateNameColumn(key: NameListCompareSourceKeyType, column: string): void {
    const source = importedSources.value[key]
    if (!source) return
    source.nameColumn = column
  }

  /** 确认姓名列后写入对应来源并关闭弹窗 */
  function handleNameColumnConfirm(payload: { nameColumn?: string }): void {
    const source = importedSources.value[pendingImportKey.value]
    if (!source || !payload.nameColumn) {
      columnSelectorVisible.value = false
      return
    }

    source.nameColumn = payload.nameColumn
    columnSelectorVisible.value = false
    ElMessage.success('名单已导入')
  }

  /** 根据分组生成导出文件的表头文案 */
  function buildExportHeader(group: keyof NameListCompareGroupsType): string {
    if (group === 'baselineOnly') return baselineDisplayLabel.value
    if (group === 'comparisonOnly') return comparisonDisplayLabel.value
    return '共同名单'
  }

  /** 读取指定分组下的名单 */
  function getExportGroupNames(group: keyof NameListCompareGroupsType): string[] {
    if (!compareResult.value) return []
    return compareResult.value.groups[group]
  }

  /** 处理结果卡片的复制或导出动作 */
  async function handleResultAction(payload: {
    group: keyof NameListCompareGroupsType
    action: 'copy' | 'export'
  }): Promise<void> {
    const names = getExportGroupNames(payload.group)
    if (names.length === 0) {
      ElMessage.warning('当前分组没有可处理的名单')
      return
    }

    if (payload.action === 'copy') {
      try {
        await navigator.clipboard.writeText(names.join('\n'))
        ElMessage.success('名单已复制')
      } catch (error) {
        console.error('复制名单失败:', error)
        ElMessage.error('复制失败，请检查浏览器权限')
      }
      return
    }

    const header = buildExportHeader(payload.group)
    // 名单转成单列表格导出，表头使用分组对应的来源标签
    const result = exportExcel(
      [header],
      names.map((name) => [name]),
      `${header}_${formatTimestamp()}.xlsx`
    )

    if (result.success) {
      ElMessage.success('导出成功')
    } else {
      ElMessage.error(result.error?.message || '导出失败')
    }
  }

  /** 生成 yyyy-MM-dd_HH-mm-ss 形式的时间戳，用作导出文件名 */
  function formatTimestamp(): string {
    const now = new Date()
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((item) => String(item).padStart(2, '0'))
      .join('-')
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((item) => String(item).padStart(2, '0'))
      .join('-')
    return `${date}_${time}`
  }
  return {
    fileInputRef,
    pasteDialogVisible,
    pasteText,
    columnSelectorVisible,
    mode,
    baselineKey,
    onlyDifference,
    importedSources,
    columnSelectorHeaders,
    columnSelectorRows,
    suggestedNameColumn,
    systemRows,
    baselineDisplayLabel,
    comparisonDisplayLabel,
    compareResult,
    switchMode,
    openUploadFor,
    openPasteDialog,
    handleFileChange,
    confirmPasteImport,
    clearCurrentImports,
    updateNameColumn,
    handleNameColumnConfirm,
    handleResultAction
  }
}
