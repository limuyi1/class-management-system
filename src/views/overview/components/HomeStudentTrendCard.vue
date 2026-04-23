<script setup lang="ts">
import HomeStudentTrendPanel from '@/views/overview/components/HomeStudentTrendPanel.vue'
import type { DashboardStudentOptionType, DashboardStudentTrendType } from '@/types/HomeDashboard'

interface Props {
  modelValue: string[]
  studentTrend: DashboardStudentTrendType | null
  studentOptions: DashboardStudentOptionType[]
  quickStudentNames: string[]
}

defineProps<Props>()

defineEmits<{
  'update:modelValue': [value: string[]]
  'go-evaluation': []
}>()
</script>

<template>
  <el-card class="student-trend-card">
    <div class="card-header">
      <div class="card-title">学生趋势对比</div>
    </div>

    <home-student-trend-panel
      :model-value="modelValue"
      :student-trend="studentTrend"
      :student-options="studentOptions"
      :quick-student-names="quickStudentNames"
      @update:model-value="$emit('update:modelValue', $event)"
      @go-evaluation="$emit('go-evaluation')"
    />
  </el-card>
</template>

<style scoped lang="scss">
.student-trend-card {
  min-height: 520px;
  border-radius: 14px;
  border: 1px solid var(--border-muted);
  box-shadow: var(--shadow-card);

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
</style>
