<script setup lang="ts">
/**
 * 分数录入卡片
 * 支持姓名/拼音搜索定位、分数录入与连续录入，并记录最近录入供回填。
 */
import { nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { match } from 'pinyin-pro'
import { dayjs, ElMessage } from 'element-plus'

import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { NAME_PROP } from '@/constants'
import type { StudentDataType } from '@/types/StudentData'
import type { RecentScoreEntryType } from '@/types/Configuration'

interface SuggestionItemType {
  value: string
  studentId: string
  index: number
}

const emit = defineEmits<{
  scroll: [studentId: string]
  uploadImage: []
  clearSelection: []
}>()

const store = useDataSourceStore()
const configuration = useConfigurationStore()
const { students: originList } = storeToRefs(store)

const searchKeyword = ref('')
const selectedStudentId = ref<string | null>(null)
const scoreValue = ref<number | null>(null)
const recentEntries = ref<RecentScoreEntryType[]>([])

const searchInputRef = ref<{ focus: () => void } | null>(null)
const scoreInputRef = ref<{ focus: () => void; blur?: () => void } | null>(null)

/**
 * 获取学生姓名的安全字符串。
 * @param student 学生数据
 * @returns 姓名字符串
 */
const getStudentName = (student: StudentDataType): string => {
  const name = student[NAME_PROP]
  return name === null || name === undefined ? '' : String(name)
}

/**
 * 获取学生在当前科目下的有效分数。
 * @param student 学生数据
 * @returns 有效分数，非法或未录入时返回 null
 */
const getStudentScore = (student: StudentDataType): number | null => {
  if (!configuration.inputScoreTab) return null
  const raw = student[configuration.inputScoreTab]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

/**
 * 按姓名或拼音模糊匹配学生，最多返回 20 条建议。
 * @param query 搜索关键词
 * @returns 匹配到的建议项
 */
const getMatchedStudents = (query: string): SuggestionItemType[] => {
  if (!query.trim()) return []
  return originList.value
    .map((student, index) => ({ student, index: index + 1 }))
    .filter(({ student }) => {
      const name = getStudentName(student)
      return name.includes(query) || !!match(name, query)?.length
    })
    .slice(0, 20)
    .map(({ student, index }) => ({
      value: getStudentName(student),
      studentId: student.studentId,
      index
    }))
}

/** 供 el-autocomplete 使用的建议查询回调 */
const querySuggestions = (queryString: string, cb: (items: SuggestionItemType[]) => void) => {
  cb(getMatchedStudents(queryString))
}

/** 切换科目时同步该科目的最近录入记录 */
const syncRecentEntriesByTab = () => {
  const scoreTab = configuration.inputScoreTab
  if (!scoreTab) {
    recentEntries.value = []
    return
  }
  recentEntries.value = [...(configuration.recentScoreEntries[scoreTab] || [])]
}

/** 清除当前选中学生 */
const clearSelectedStudent = () => {
  selectedStudentId.value = null
  scoreValue.value = null
  emit('clearSelection')
}

/** 聚焦姓名搜索输入框 */
const focusSearchInput = () => {
  searchInputRef.value?.focus()
}

/** 聚焦分数输入框 */
const focusScoreInput = () => {
  scoreInputRef.value?.focus()
}

/** 失焦分数输入框 */
const blurScoreInput = () => {
  scoreInputRef.value?.blur?.()
}

/**
 * 选择学生并回填姓名与分数，同时通知父级滚动到对应行。
 * @param studentId 学生 ID
 * @param shouldFocusScore 是否随后聚焦分数输入框
 */
const selectStudentById = (studentId: string, shouldFocusScore: boolean = true) => {
  const item = store.getStudentById(studentId)
  if (!item) return

  selectedStudentId.value = studentId
  searchKeyword.value = getStudentName(item)
  scoreValue.value = getStudentScore(item)
  emit('scroll', studentId)

  if (shouldFocusScore) {
    nextTick(() => focusScoreInput())
  }
}

/** 选择搜索建议项并定位到对应学生 */
const handleSuggestionSelect = (item: SuggestionItemType) => {
  selectStudentById(item.studentId)
}

/**
 * 回车定位学生：优先精确匹配，其次取第一条建议。
 */
const handleSearchEnter = () => {
  if (!searchKeyword.value.trim()) {
    focusSearchInput()
    return
  }

  const matched = getMatchedStudents(searchKeyword.value)
  const exactMatched = matched.find((item) => item.value === searchKeyword.value.trim())
  const target = exactMatched || matched[0]

  if (!target) {
    ElMessage.warning('未找到该学生')
    focusSearchInput()
    return
  }

  selectStudentById(target.studentId)
}

/**
 * 追加一条最近录入记录，同一学生去重后最多保留 5 条。
 * @param studentId 学生 ID
 * @param score 已保存分数
 */
const addRecentEntry = (studentId: string, score: number) => {
  const scoreTab = configuration.inputScoreTab
  if (!scoreTab) return

  const student = store.getStudentById(studentId)
  if (!student) return
  const name = getStudentName(student)
  const time = dayjs().format('HH:mm:ss')

  const nextEntries: RecentScoreEntryType[] = [
    { studentId, name, score, time },
    ...recentEntries.value.filter((entry) => entry.studentId !== studentId)
  ].slice(0, 5)

  configuration.recentScoreEntries = {
    ...configuration.recentScoreEntries,
    [scoreTab]: nextEntries
  }
  recentEntries.value = nextEntries
}

/** 清空录入表单并清除选中状态 */
const resetEntryForm = () => {
  blurScoreInput()
  selectedStudentId.value = null
  searchKeyword.value = ''
  scoreValue.value = null
  emit('clearSelection')
}

/**
 * 保存分数主流程：
 * 1. 校验学生、科目、分数
 * 2. 写入当前科目成绩
 * 3. 记录最近录入
 * 4. 默认回到姓名输入框，支持连续录入
 */
const saveScore = (mode: 'stay' | 'next' = 'stay') => {
  if (!selectedStudentId.value) {
    ElMessage.warning('请先选择学生')
    focusSearchInput()
    return
  }

  if (!configuration.inputScoreTab) {
    ElMessage.warning('请先选择当前录入科目')
    return
  }

  if (typeof scoreValue.value !== 'number' || !Number.isFinite(scoreValue.value)) {
    ElMessage.warning('请输入有效分数')
    focusScoreInput()
    return
  }

  const student = store.getStudentById(selectedStudentId.value)
  if (!student) return

  const savedScore = scoreValue.value
  student[configuration.inputScoreTab] = savedScore
  addRecentEntry(student.studentId, savedScore)

  if (mode === 'next') {
    const currentIndex = originList.value.findIndex(
      (item) => item.studentId === selectedStudentId.value
    )
    if (currentIndex >= 0 && currentIndex < originList.value.length - 1) {
      const nextStudent = originList.value[currentIndex + 1]
      selectStudentById(nextStudent.studentId)
      return
    }
    resetEntryForm()
    nextTick(() => focusSearchInput())
    return
  }
  resetEntryForm()
  nextTick(() => focusSearchInput())
}

/** 将最近录入记录回填到录入表单 */
const refillEntry = (entry: RecentScoreEntryType) => {
  selectStudentById(entry.studentId, false)
  scoreValue.value = entry.score
  nextTick(() => focusScoreInput())
}

/** 触发 AI 识图导入 */
const handleAIMode = () => {
  emit('uploadImage')
}

/** 外部调用时聚焦姓名输入框 */
const autoFocus = () => {
  focusSearchInput()
}

const editData = (data: StudentDataType) => {
  selectStudentById(data.studentId)
}

/**
 * 姓名输入框回车只用于“定位学生”，必须阻断事件冒泡，
 * 避免触发分数框保存逻辑。
 */
const handleNameKeyDownEnter = (event: KeyboardEvent) => {
  event.preventDefault()
  event.stopPropagation()
  handleSearchEnter()
}

/**
 * 分数输入框回车只用于“保存分数”。
 */
const handleScoreKeyDownEnter = (event: KeyboardEvent) => {
  event.preventDefault()
  event.stopPropagation()
  saveScore('stay')
}

watch(searchKeyword, (value) => {
  // 关键词被清空时同步清除当前选中学生
  if (value.trim()) return
  if (!selectedStudentId.value) return
  clearSelectedStudent()
})

watch(
  () => configuration.inputScoreTab,
  () => {
    syncRecentEntriesByTab()
  },
  { immediate: true }
)

defineExpose({
  autoFocus,
  editData
})
</script>

<template>
  <div class="score-input-card">
    <div class="mode-switch">
      <div class="manual-entry">
        <font-awesome-icon :icon="['solid', 'keyboard']" />
        <span>分数录入</span>
      </div>
      <el-button class="ai-action-btn" plain @click="handleAIMode">
        <template #icon><font-awesome-icon :icon="['solid', 'camera']" /></template>
        AI识图导入
      </el-button>
    </div>

    <div class="search-section">
      <el-autocomplete
        ref="searchInputRef"
        v-model="searchKeyword"
        class="search-input"
        :fetch-suggestions="querySuggestions"
        placeholder="输入姓名或拼音快速定位"
        clearable
        @select="handleSuggestionSelect"
        @clear="clearSelectedStudent"
        @keydown.enter="handleNameKeyDownEnter"
      />
    </div>

    <div class="score-section">
      <el-input-number
        ref="scoreInputRef"
        v-model="scoreValue"
        class="score-input"
        size="large"
        :min="0"
        :max="configuration.scoreFullMark"
        :precision="1"
        :controls="false"
        :placeholder="`0~${configuration.scoreFullMark}分`"
        @keydown.enter="handleScoreKeyDownEnter"
      />
      <div class="score-actions">
        <el-button type="primary" class="save-btn" @click="saveScore('stay')">保存分数</el-button>
        <el-button class="next-btn" @click="saveScore('next')">保存并下一位</el-button>
      </div>
      <div class="shortcut-hint">姓名回车 -> 分数框 | 分数回车 -> 保存并回到姓名框</div>
    </div>

    <div class="recent-section">
      <div class="recent-title">最近录入（{{ recentEntries.length }}）</div>
      <div v-if="recentEntries.length" class="recent-list">
        <div
          v-for="entry in recentEntries"
          :key="`${entry.studentId}-${entry.time}`"
          class="recent-item"
        >
          <div class="recent-meta">
            <span class="name">{{ entry.name }}</span>
            <span class="score">{{ entry.score }} 分</span>
            <span class="time">{{ entry.time }}</span>
          </div>
          <el-button text type="primary" @click="refillEntry(entry)">回填</el-button>
        </div>
      </div>
      <el-empty v-else :image-size="60" description="暂无录入记录" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.score-input-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--surface-card);
  border: 1px solid var(--border-muted);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  padding: 16px;
}

.mode-switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.manual-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;

  svg {
    color: var(--theme-primary);
    font-size: 16px;
  }
}

.ai-action-btn {
  border-radius: 10px;
  border-color: var(--border-muted);
  color: var(--text-secondary);
  background: #fff;
}

.search-input {
  width: 100%;

  :deep(.el-input__wrapper) {
    border-radius: 10px;
    min-height: 42px;
  }
}

.score-section {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .score-input {
    width: 100%;

    :deep(.el-input-number) {
      width: 100%;
    }

    :deep(.el-input-number .el-input__wrapper) {
      min-height: 44px;
      border-radius: 10px;
      overflow: hidden;
    }

    :deep(.el-input-number .el-input-number__increase),
    :deep(.el-input-number .el-input-number__decrease) {
      border-radius: 0;
    }
  }

  .score-actions {
    display: flex;
    gap: 8px;

    .save-btn {
      flex: 1;
    }

    .next-btn {
      border: 1px solid var(--border-muted);
    }
  }

  .shortcut-hint {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.recent-section {
  border-top: 1px solid var(--border-muted);
  padding-top: 12px;

  .recent-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 8px;
    background: #f8fafc;

    .recent-meta {
      display: flex;
      gap: 10px;
      font-size: 12px;
      color: var(--text-secondary);

      .name {
        color: var(--text-primary);
        font-weight: 600;
      }

      .score {
        color: var(--theme-primary);
      }
    }
  }
}
</style>
