<script setup lang="ts">
import { NAME_PROP } from '@/types/Constants'
import type { ScoreStudentType } from '@/hooks/useScoreStatistics'

interface Props {
  threshold: number
  students: ScoreStudentType[]
  getScore: (item: ScoreStudentType) => number | null
}

interface Emits {
  (event: 'update:threshold', value: number): void
  (event: 'download', mode: 'withScore' | 'nameOnly'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <div class="threshold-section">
    <div class="threshold-input-wrap">
      <span>低于</span>
      <el-input-number
        :model-value="threshold"
        :min="0"
        :max="100"
        :step="5"
        size="small"
        controls-position="right"
        class="threshold-input"
        @update:model-value="(value: unknown) => emit('update:threshold', Number(value || 0))"
      />
      <span>分的学生 ({{ students.length }}人)</span>
    </div>
    <el-dropdown trigger="hover">
      <el-button type="primary" size="small" round>
        <template #icon><font-awesome-icon :icon="['solid', 'download']" /></template>
        下载
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="emit('download', 'withScore')">姓名 + 分数</el-dropdown-item>
          <el-dropdown-item @click="emit('download', 'nameOnly')">仅姓名</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>

  <div class="student-tags" v-if="students.length">
    <template v-if="students.length <= 8">
      <el-tag v-for="item in students" :key="String(item[NAME_PROP])" type="warning" size="small">
        {{ item[NAME_PROP] }} {{ getScore(item) }}分
      </el-tag>
    </template>
    <template v-else>
      <el-tag
        v-for="item in students.slice(0, 8)"
        :key="String(item[NAME_PROP])"
        type="warning"
        size="small"
      >
        {{ item[NAME_PROP] }} {{ getScore(item) }}分
      </el-tag>
      <el-popover placement="bottom" :width="200" trigger="hover">
        <template #reference>
          <el-tag style="cursor: pointer" type="warning" size="small"
            >...+{{ students.length - 8 }}人</el-tag
          >
        </template>
        <div class="popover-tags">
          <el-tag
            v-for="item in students.slice(8)"
            :key="String(item[NAME_PROP])"
            type="warning"
            size="small"
          >
            {{ item[NAME_PROP] }} {{ getScore(item) }}分
          </el-tag>
        </div>
      </el-popover>
    </template>
  </div>
</template>

<style scoped lang="scss">
.threshold-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fef3c7;
  border-radius: 8px;
  margin-bottom: 10px;

  .threshold-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #92400e;
  }

  .threshold-input {
    width: 80px;
  }
}

.student-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-bottom: 10px;
}

.popover-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
