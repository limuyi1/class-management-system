<script setup lang="ts">
import { computed } from 'vue'

import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'
import { buildStudentReportData } from '@/utils/studentReportUntil'
import { NAME_PROP } from '@/types/Constants'
import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

interface Props {
  visible: boolean
  student: StudentDataType | null
  scoreColumns: SettingType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  export: []
}>()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value)
})

const dataStore = useDataSourceStore()
const settingStore = useSettingStore()
const { enabledData } = storeToRefs(dataStore)
const { tagCategory } = storeToRefs(settingStore)

const report = computed(() => {
  if (!props.student) return null
  return buildStudentReportData({
    student: props.student,
    students: enabledData.value,
    scoreColumns: props.scoreColumns,
    selectedProps: props.scoreColumns.map((item) => item.prop),
    tagCategories: tagCategory.value,
    classLabel: '本班'
  })
})

const studentName = computed(() => {
  if (!props.student) return ''
  return String(props.student[NAME_PROP] || '')
})
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="学生信息"
    size="720px"
    append-to-body
    class="student-report-drawer"
  >
    <div v-if="report" class="student-report-drawer__content">
      <section class="student-report-drawer__hero">
        <div>
          <div class="student-report-drawer__name">{{ studentName }}</div>
          <div class="student-report-drawer__meta">{{ report.classLabel }}</div>
        </div>
        <el-button type="primary" @click="emit('export')">导出学习报告</el-button>
      </section>

      <section class="student-report-drawer__panel">
        <div class="student-report-drawer__panel-title">阶段概览</div>
        <div class="student-report-drawer__stats">
          <div class="student-report-drawer__stat">
            <span>平均分</span>
            <strong>{{ report.summary.averageScore }}</strong>
          </div>
          <div class="student-report-drawer__stat">
            <span>最高分</span>
            <strong>{{ report.summary.highestScore }}</strong>
          </div>
          <div class="student-report-drawer__stat">
            <span>最低分</span>
            <strong>{{ report.summary.lowestScore }}</strong>
          </div>
          <div class="student-report-drawer__stat">
            <span>趋势</span>
            <strong>{{ report.summary.trendLabel }}</strong>
          </div>
        </div>
      </section>

      <section class="student-report-drawer__panel">
        <div class="student-report-drawer__panel-title">成绩列表</div>
        <div class="student-report-drawer__score-list">
          <div
            v-for="item in report.scoreItems"
            :key="item.prop"
            class="student-report-drawer__score-item"
          >
            <div class="student-report-drawer__score-main">
              <strong>{{ item.label }}</strong>
              <span>{{ item.score === null ? '未录入' : `${item.score} 分` }}</span>
            </div>
            <div class="student-report-drawer__score-sub">
              <span>班均 {{ item.average === null ? '--' : item.average.toFixed(1) }}</span>
              <span>{{ item.rank === null ? '暂无名次' : `第 ${item.rank} 名` }}</span>
              <span>{{ item.delta === null ? '--' : `${item.delta > 0 ? '+' : ''}${item.delta}` }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="student-report-drawer__grid">
        <div class="student-report-drawer__panel">
          <div class="student-report-drawer__panel-title">学习画像</div>
          <div class="student-report-drawer__tags">
            <span
              v-for="tag in report.tags.slice(0, 8)"
              :key="tag"
              class="student-report-drawer__tag"
            >
              {{ tag }}
            </span>
            <span v-if="!report.tags.length" class="student-report-drawer__tag student-report-drawer__tag--muted">
              暂无标签
            </span>
          </div>
        </div>

        <div class="student-report-drawer__panel">
          <div class="student-report-drawer__panel-title">重点提示</div>
          <div class="student-report-drawer__hint-list">
            <div
              v-for="item in [...report.strengths, ...report.concerns].slice(0, 4)"
              :key="item"
              class="student-report-drawer__hint"
            >
              {{ item }}
            </div>
          </div>
        </div>
      </section>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.student-report-drawer__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.student-report-drawer__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--border-muted);
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fbfb 0%, #f3f7f7 100%);
}

.student-report-drawer__name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.student-report-drawer__meta {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}

.student-report-drawer__panel {
  padding: 18px;
  border: 1px solid var(--border-muted);
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--shadow-card);
}

.student-report-drawer__panel-title {
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.student-report-drawer__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.student-report-drawer__stat {
  padding: 14px;
  border-radius: 12px;
  background: #f8fafc;
}

.student-report-drawer__stat span,
.student-report-drawer__score-sub {
  color: var(--text-secondary);
  font-size: 12px;
}

.student-report-drawer__stat strong {
  display: block;
  margin-top: 8px;
  font-size: 20px;
  color: var(--text-primary);
}

.student-report-drawer__score-list {
  display: grid;
  gap: 10px;
}

.student-report-drawer__score-item {
  padding: 14px;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  background: #fbfcfe;
}

.student-report-drawer__score-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
  color: var(--text-primary);
}

.student-report-drawer__score-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.student-report-drawer__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.student-report-drawer__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.student-report-drawer__tag {
  padding: 7px 12px;
  color: #c17338;
  background: rgba(193, 115, 56, 0.12);
  border-radius: 999px;
  font-size: 13px;
}

.student-report-drawer__tag--muted {
  color: var(--text-secondary);
  background: #f2f5f8;
}

.student-report-drawer__hint-list {
  display: grid;
  gap: 10px;
}

.student-report-drawer__hint {
  padding: 12px 14px;
  color: #46565a;
  background: #f8fafc;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.75;
}
</style>
