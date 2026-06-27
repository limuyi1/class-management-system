<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElLoading, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

import PageHeader from '@/components/PageHeader.vue'

import EvaluationTableView from '@/views/evaluation/components/EvaluationTableView.vue'
import ToolPanelView from '@/views/evaluation/components/ToolPanelView.vue'
import { useProgress } from '@/hooks/useProgress'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { generateBatchComments, polishBatchComments } from '@/ai/aiService'
import { exportEvaluationTextPDF } from '@/utils/evaluationTextPdfUntil'
import {
  clearEvaluationHandwriteFont,
  getDefaultFontSlowNoticeMs,
  hasSavedHandwriteFont,
  hasUnsupportedEvaluationHandwriteGlyphs,
  registerEvaluationHandwriteFont,
  saveEvaluationHandwriteFont,
  waitForDefaultHandwriteFont
} from '@/utils/evaluationHandwriteFontUntil'
import { extractStudentTags } from '@/utils/studentUntil'
import { applyPolishedComments, buildCommentPolishTargets } from '@/utils/commentPolishUntil'
import { NAME_PROP } from '@/types/Constants'
import type { PreviewModeType } from '@/types/Configuration'
import type { StudentDataType } from '@/types/StudentData'

/**
 * 期末评语管理页面
 * 展示学生期末评语列表，提供编辑、AI 生成和 PDF 导出功能
 */

const evaluationTableViewRef = ref<InstanceType<typeof EvaluationTableView>>()
const toolPanelViewRef = ref<InstanceType<typeof ToolPanelView>>()
const fontFileInputRef = ref<HTMLInputElement | null>(null)
const route = useRoute()
const router = useRouter()

const dataStore = useDataSourceStore()
const { items: students, enabledData: enabledStudents } = storeToRefs(dataStore)
const configuration = useConfigurationStore()
const settingStore = useSettingStore()
const { tagCategory: tagCategoryList } = storeToRefs(settingStore)
const aiConfigStore = useAIConfigStore()
const { percentage, notCompletedCount } = useProgress({
  data: students,
  getValue: (item: StudentDataType) => item.comment
})
const totalCount = computed(() => students.value.length)
const completedCount = computed(() => Math.max(0, totalCount.value - notCompletedCount.value))
const activeStudentName = ref('')
const normalizePreviewMode = (value: string): PreviewModeType => {
  if (value === 'fit' || value === '50' || value === '75' || value === '100' || value === '125') {
    return value
  }

  return value === 'actual' ? '100' : '100'
}

const previewMode = computed<PreviewModeType>({
  get: () => normalizePreviewMode(configuration.previewMode),
  set: (value) => {
    configuration.previewMode = value
  }
})

/**
 * 批量生成中状态
 */
const batchGenerating = ref(false)
const batchPolishing = ref(false)
const textPdfExporting = ref(false)
const handwriteFontApplying = ref(false)
const showDefaultFontSlowNotice = ref(false)
const savedHandwriteFontName = computed(() => configuration.evaluationHandwriteFont?.name || '')
const displayHandwriteFontName = computed(() => {
  const name = savedHandwriteFontName.value
  if (!name || name.length <= 18) return name

  const dotIndex = name.lastIndexOf('.')
  const extension = dotIndex > -1 ? name.slice(dotIndex) : ''
  const baseName = dotIndex > -1 ? name.slice(0, dotIndex) : name
  const head = baseName.slice(0, 5)
  const tail = baseName.slice(Math.max(baseName.length - 3, 5))

  return `${head}...${tail}${extension}`
})

/**
 * 自动聚焦到工具面板
 */
const autoFocus = () => {
  toolPanelViewRef.value?.autoFocus()
}

const startDefaultFontMonitor = async () => {
  if (hasSavedHandwriteFont()) return

  let loaded = false
  const timer = window.setTimeout(() => {
    if (!loaded && !hasSavedHandwriteFont()) {
      showDefaultFontSlowNotice.value = true
    }
  }, getDefaultFontSlowNoticeMs())

  try {
    await waitForDefaultHandwriteFont()
  } finally {
    loaded = true
    window.clearTimeout(timer)
    showDefaultFontSlowNotice.value = false
  }
}

const initializeHandwriteFont = async () => {
  if (hasSavedHandwriteFont()) {
    try {
      // 用户上传字体是预览和 PDF 导出的共同来源，进入页面时先注册到浏览器字体集。
      await registerEvaluationHandwriteFont()
      configuration.evaluationHandwriteFont = configuration.evaluationHandwriteFont
        ? { ...configuration.evaluationHandwriteFont }
        : null
    } catch (error) {
      console.error('恢复本地手写字体失败:', error)
      ElMessage.warning('本地手写字体恢复失败，已切换为默认字体')
      clearEvaluationHandwriteFont()
      await startDefaultFontMonitor()
    }
    return
  }

  await startDefaultFontMonitor()
}

const handleChooseHandwriteFont = () => {
  fontFileInputRef.value?.click()
}

const handleHandwriteFontChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return

  handwriteFontApplying.value = true
  try {
    // 字体文件只在浏览器本地读取并存入配置记录，不会上传到服务器。
    await saveEvaluationHandwriteFont(file)
    showDefaultFontSlowNotice.value = false
    ElMessage.success('手写字体已应用')
  } catch (error) {
    console.error('应用手写字体失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '手写字体应用失败')
  } finally {
    handwriteFontApplying.value = false
  }
}

const handleClearHandwriteFont = async () => {
  clearEvaluationHandwriteFont()
  ElMessage.success('已恢复默认手写字体')
  await startDefaultFontMonitor()
}

const handleMoreAction = (command: string | number | object) => {
  if (command !== 'reset-comments') return

  void handleResetComments()
}

const handleExportTextPDF = async () => {
  if (!enabledStudents.value.length) {
    ElMessage.warning('没有可导出的学生期末评语')
    return
  }

  try {
    const hasUnsupportedGlyphs = await hasUnsupportedEvaluationHandwriteGlyphs(
      enabledStudents.value,
      configuration
    )

    if (hasUnsupportedGlyphs) {
      await ElMessageBox.confirm(
        '当前手写字体可能无法显示部分字符，导出的 PDF 可能出现空白。是否继续导出？',
        '字体缺字提示',
        {
          confirmButtonText: '继续导出',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    }
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    console.error('检查手写字体字符覆盖失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '手写字体检查失败')
    return
  }

  textPdfExporting.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在导出文字版PDF...'
  })

  try {
    const result = await exportEvaluationTextPDF({
      students: enabledStudents.value,
      configuration
    })

    if (!result.success) {
      ElMessage.error(result.error?.message || '导出失败！')
      return
    }

    ElMessage.success('评语导出成功')

    if (result.truncatedStudents.length > 0) {
      const previewNames = result.truncatedStudents.slice(0, 5).join('、')
      const suffix = result.truncatedStudents.length > 5 ? ' 等' : ''
      ElMessage.warning(
        `有 ${result.truncatedStudents.length} 条评语因内容过长被截断：${previewNames}${suffix}`
      )
    }
  } finally {
    loading.close()
    textPdfExporting.value = false
  }
}

onMounted(() => {
  void initializeHandwriteFont()
})

/**
 * 处理评语卡片点击事件
 * 点击左侧学生期末评语卡片时，激活右侧输入区进行编辑
 * @param row - 被点击的学生行数据
 */
const handleCardClick = (row: StudentDataType) => {
  toolPanelViewRef.value?.fillStudentData(row)
}

const handleActiveStudentChange = (row: StudentDataType | null) => {
  activeStudentName.value = row ? getStudentName(row) : ''
}

const handleResetComments = async () => {
  const existingCount = students.value.filter((item) => item.comment && item.comment.trim()).length

  if (existingCount === 0) {
    ElMessage.info('当前没有可清空的评语')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要清空全部 ${existingCount} 条已填写评语吗？此操作不可恢复。`,
      '重置评语',
      {
        confirmButtonText: '清空评语',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    students.value.forEach((item) => {
      item.comment = undefined
    })
    toolPanelViewRef.value?.resetForm()
    ElMessage.success('已清空所有评语')
  } catch {
    // 用户取消操作时不提示
  }
}

const resumeEditingStudent = async (studentName: string) => {
  await nextTick()
  const student = students.value.find((item) => getStudentName(item) === studentName)
  if (!student || !toolPanelViewRef.value) return false

  toolPanelViewRef.value.fillStudentData(student)
  return true
}

const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

const formatBatchTags = (tags: string[]): string => {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
  return uniqueTags.length ? uniqueTags.join('、') : '暂无'
}

const handleBatchGenerate = async () => {
  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先在设置页面配置 AI')
    return
  }

  if (!students.value.length) {
    ElMessage.warning('没有学生数据')
    return
  }

  // 统计已有评语的学生数量
  const existingCount = students.value.filter((item) => item.comment && item.comment.trim()).length
  const emptyCount = students.value.length - existingCount

  // 根据情况选择模式
  let mode: 'skip' | 'overwrite' = 'skip'

  if (existingCount === 0) {
    // 全部为空，直接生成
    mode = 'overwrite'
  } else if (emptyCount === 0) {
    // 全部已有评语，只询问是否覆盖
    try {
      await ElMessageBox.confirm(
        '所有学生已有期末评语，是否全部重新生成？',
        'AI 批量生成期末评语',
        {
          confirmButtonText: '覆盖所有',
          cancelButtonText: '取消',
          type: 'info',
          distinguishCancelAndClose: true
        }
      )
      mode = 'overwrite'
    } catch {
      return
    }
  } else {
    // 部分有评语，弹出选择对话框
    try {
      await ElMessageBox.confirm(
        `检测到 ${students.value.length} 名学生中已有 ${existingCount} 名学生有评语，请选择生成方式`,
        'AI 批量生成期末评语',
        {
          confirmButtonText: '覆盖所有',
          cancelButtonText: '仅填充空白期末评语',
          type: 'info',
          distinguishCancelAndClose: true
        }
      )
      mode = 'overwrite'
    } catch (action) {
      if (action === 'cancel') {
        mode = 'skip'
      } else {
        return
      }
    }
  }

  batchGenerating.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在批量生成期末评语...'
  })

  try {
    // 根据模式构建学生数据
    // 覆盖所有模式：传入空评语让 LLM 重新生成
    // 仅填充空评语模式：只传入评语为空的学生
    const filteredStudents = students.value.filter(
      (item) => mode === 'overwrite' || !item.comment?.trim()
    )

    const studentsData = filteredStudents.map((item) => {
      const allTags = extractStudentTags(item, tagCategoryList.value)

      return {
        name: getStudentName(item),
        tags: formatBatchTags(allTags),
        comment: mode === 'overwrite' ? '' : item.comment || ''
      }
    })

    // 分批处理，每批10个学生，降低单次请求体积和失败影响范围。
    const BATCH_SIZE = 10
    const totalBatches = Math.ceil(studentsData.length / BATCH_SIZE)
    const allResults: Array<{ name: string; comment: string | null }> = []
    let failedBatches: number[] = []

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, studentsData.length)
      const batchData = studentsData.slice(start, end)

      loading.setText(`正在生成第 ${batchIndex + 1}/${totalBatches} 批期末评语...`)

      try {
        const result = await generateBatchComments(batchData, aiConfigStore.prompts.batchComment, {
          modelType: aiConfigStore.modelType,
          model: aiConfigStore.model,
          apiKey: aiConfigStore.apiKey,
          baseUrl: aiConfigStore.baseUrl
        })

        allResults.push(...(result as Array<{ name: string; comment: string | null }>))
      } catch (error) {
        console.error(`第 ${batchIndex + 1} 批生成失败:`, error)
        failedBatches.push(batchIndex + 1)
        // 批次失败时，尝试下一个批次
      }
    }

    if (failedBatches.length > 0) {
      ElMessage.warning(
        `部分批次生成失败：第 ${failedBatches.join('、')} 批（共 ${totalBatches} 批）`
      )
    }

    // 更新成功生成的结果
    let updatedCount = 0
    for (let i = 0; i < allResults.length; i++) {
      const generatedComment = allResults[i].comment?.trim()
      if (generatedComment) {
        filteredStudents[i].comment = generatedComment
        updatedCount++
      }
    }

    ElMessage.success(`批量生成完成，已更新 ${updatedCount} 条期末评语`)
  } catch (error) {
    console.error('批量生成期末评语失败:', error)
    ElMessage.error('批量生成期末评语失败：' + (error as Error).message)
  } finally {
    loading.close()
    batchGenerating.value = false
  }
}

const handleBatchPolish = async () => {
  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先在设置页面配置 AI')
    return
  }

  const polishTargets = buildCommentPolishTargets(students.value, (student) =>
    formatBatchTags(extractStudentTags(student, tagCategoryList.value))
  )

  if (!polishTargets.length) {
    ElMessage.warning('当前没有可润色的已有评语')
    return
  }

  try {
    await ElMessageBox.confirm(
      `将基于当前已有评语润色 ${polishTargets.length} 名学生，空白评语不会生成或覆盖。是否继续？`,
      'AI 批量润色期末评语',
      {
        confirmButtonText: '开始润色',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
  } catch {
    return
  }

  batchPolishing.value = true
  const loading = ElLoading.service({
    lock: true,
    text: '正在批量润色期末评语...'
  })

  try {
    const BATCH_SIZE = 10
    const totalBatches = Math.ceil(polishTargets.length / BATCH_SIZE)
    const allResults: Array<{ name: string; comment?: string | null }> = []
    const failedBatches: number[] = []

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, polishTargets.length)
      const batchData = polishTargets.slice(start, end)

      loading.setText(`正在润色第 ${batchIndex + 1}/${totalBatches} 批期末评语...`)

      try {
        const result = await polishBatchComments(
          batchData,
          aiConfigStore.prompts.batchCommentPolish,
          {
            modelType: aiConfigStore.modelType,
            model: aiConfigStore.model,
            apiKey: aiConfigStore.apiKey,
            baseUrl: aiConfigStore.baseUrl
          }
        )

        allResults.push(...result)
      } catch (error) {
        console.error(`第 ${batchIndex + 1} 批润色失败:`, error)
        failedBatches.push(batchIndex + 1)
      }
    }

    if (failedBatches.length > 0) {
      ElMessage.warning(
        `部分批次润色失败：第 ${failedBatches.join('、')} 批（共 ${totalBatches} 批）`
      )
    }

    const updatedCount = applyPolishedComments(students.value, allResults)
    ElMessage.success(`批量润色完成，已更新 ${updatedCount} 条期末评语`)
  } catch (error) {
    console.error('批量润色期末评语失败:', error)
    ElMessage.error('批量润色期末评语失败：' + (error as Error).message)
  } finally {
    loading.close()
    batchPolishing.value = false
  }
}

watch(
  () =>
    [route.query['resume-edit'], route.query['student-name'], !!toolPanelViewRef.value] as const,
  async ([resumeEdit, studentName, ready]) => {
    if (resumeEdit !== '1' || typeof studentName !== 'string' || !studentName || !ready) return

    const resumed = await resumeEditingStudent(studentName)
    if (resumed) {
      await router.replace({ path: '/comment' })
    }
  },
  { immediate: true }
)

defineExpose({ autoFocus })
</script>

<template>
  <div class="evaluation-page app-page-shell">
    <page-header
      class="evaluation-page-header"
      :icon="['solid', 'comments']"
      title="期末评语"
      subtitle="为每位学生撰写期末评语，支持导出评语 PDF"
    >
      <template #right>
        <div class="header-toolbar">
          <div class="header-progress" title="评语完成进度">
            <div class="progress-title">
              <font-awesome-icon :icon="['solid', 'chart-pie']" />
              <span>进度</span>
            </div>
            <div class="progress-bar-wrap">
              <el-progress
                class="progress-track"
                :percentage="percentage"
                :stroke-width="6"
                :show-text="false"
                color="var(--theme-primary)"
              />
            </div>
            <div class="progress-meta">
              <span class="meta-text">完成 {{ completedCount }}/{{ totalCount }}</span>
              <span class="percentage-badge">{{ percentage.toFixed(0) }}%</span>
            </div>
          </div>

          <input
            ref="fontFileInputRef"
            class="font-file-input"
            type="file"
            accept=".ttf,.otf,font/ttf,font/otf"
            @change="handleHandwriteFontChange"
          />

          <div class="header-actions">
            <el-button type="primary" :loading="batchGenerating" @click="handleBatchGenerate">
              <template #icon
                ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
              /></template>
              AI 批量生成
            </el-button>
            <el-button :loading="batchPolishing" @click="handleBatchPolish">
              <template #icon
                ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
              /></template>
              AI 批量润色
            </el-button>
            <el-button :loading="textPdfExporting" @click="handleExportTextPDF">
              <template #icon><font-awesome-icon :icon="['solid', 'file-lines']" /></template>
              导出
            </el-button>

            <el-dropdown trigger="click" placement="bottom-end" @command="handleMoreAction">
              <el-button class="more-action-btn">
                <template #icon><font-awesome-icon :icon="['solid', 'ellipsis']" /></template>
                更多
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item class="font-dropdown-item" @click.stop>
                    <div class="font-control-row">
                      <div
                        class="font-status-item"
                        :title="savedHandwriteFontName || '默认手写字体'"
                      >
                        <font-awesome-icon :icon="['solid', 'font']" />
                        <span>{{
                          savedHandwriteFontName ? displayHandwriteFontName : '默认手写字体'
                        }}</span>
                      </div>
                      <button
                        class="font-mini-action"
                        type="button"
                        :disabled="handwriteFontApplying"
                        @click.stop="handleChooseHandwriteFont"
                      >
                        {{ handwriteFontApplying ? '应用中' : '更换' }}
                      </button>
                      <button
                        v-if="savedHandwriteFontName"
                        class="font-mini-action is-muted"
                        type="button"
                        @click.stop="handleClearHandwriteFont"
                      >
                        默认
                      </button>
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item command="reset-comments" divided>
                    <font-awesome-icon :icon="['solid', 'trash-can']" />
                    <span>重置评语</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
    </page-header>

    <el-alert
      v-if="showDefaultFontSlowNotice"
      class="font-slow-alert"
      title="手写字体加载较慢，可选择本地 .ttf/.otf 字体提升预览和导出稳定性。"
      type="warning"
      show-icon
      :closable="false"
    />

    <div class="evaluation-page-content">
      <div class="evaluation-page-left">
        <evaluation-table-view
          ref="evaluationTableViewRef"
          :active-student-name="activeStudentName"
          :preview-mode="previewMode"
          @card-click="handleCardClick"
        />
      </div>
      <div class="evaluation-page-right">
        <el-scrollbar>
          <tool-panel-view
            ref="toolPanelViewRef"
            @scroll="(index) => evaluationTableViewRef?.scroll(index)"
            @active-student-change="handleActiveStudentChange"
          />
        </el-scrollbar>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.evaluation-page {
  min-height: 0;
}

.evaluation-page-header {
  :deep(.header-left) {
    min-width: 220px;
    flex-shrink: 0;
  }

  :deep(.header-right) {
    flex: 1;
    justify-content: flex-end;
    min-width: 0;
  }
}

.header-toolbar {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.header-progress {
  width: clamp(240px, 28vw, 360px);
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 16%, #ffffff);
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-color-primary) 6%, #ffffff);
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  flex-shrink: 1;

  .progress-title {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;

    svg {
      color: var(--theme-primary);
      font-size: 12px;
    }
  }

  .progress-bar-wrap {
    flex: 1;
    min-width: 54px;
  }

  .progress-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;

    .percentage-badge {
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: var(--theme-primary);
      background: color-mix(in srgb, var(--theme-primary) 14%, #ffffff);
    }

    .meta-text {
      font-size: 11px;
      color: #64748b;
      white-space: nowrap;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  :deep(.el-button) {
    height: 36px;
    margin-left: 0;
  }
}

.font-file-input {
  display: none;
}

.font-slow-alert {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.more-action-btn {
  min-width: 78px;
}

.font-dropdown-item {
  cursor: default;

  &:hover,
  &:focus {
    background: transparent;
  }
}

.font-control-row {
  min-width: 218px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.font-status-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.font-mini-action {
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 24%, #ffffff);
  border-radius: 6px;
  padding: 0 8px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, #ffffff);
  color: var(--el-color-primary);
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;

  &:hover {
    border-color: color-mix(in srgb, var(--el-color-primary) 40%, #ffffff);
    background: color-mix(in srgb, var(--el-color-primary) 12%, #ffffff);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.is-muted {
    border-color: #e2e8f0;
    background: #ffffff;
    color: #64748b;

    &:hover {
      color: #334155;
      border-color: #cbd5e1;
      background: #f8fafc;
    }
  }
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 14px;
    color: #64748b;
  }
}

@media (max-width: 1180px) {
  .evaluation-page-header {
    :deep(.header-right) {
      flex: 1;
    }
  }

  .header-progress {
    width: 220px;

    .progress-title span {
      display: none;
    }
  }
}

.evaluation-page-content {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 0;

  .evaluation-page-left {
    height: 100%;
    flex: 6;
    min-width: 0;
  }

  .evaluation-page-right {
    height: 100%;
    flex: 2;
    min-width: 280px;
  }
}
</style>
