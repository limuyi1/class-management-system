<script setup lang="ts">
import { DutyRosterModeEnum } from '@/types/DutyRoster'

import type { StudentSourceType } from '@/types/StudentSource'

defineProps<{
  mode: DutyRosterModeEnum
  source: StudentSourceType
  hasExcelSource: boolean
}>()

const emit = defineEmits<{
  updateMode: [mode: DutyRosterModeEnum]
  create: []
}>()
</script>

<template>
  <div class="duty-empty">
    <span class="duty-empty__icon"><font-awesome-icon :icon="['solid', 'broom']" /></span>
    <h3>创建一张班级值日表</h3>
    <p>选择安排方式后，从学生名单拖入对应清洁岗位。</p>
    <div class="duty-empty__modes">
      <button
        type="button"
        :class="{ 'is-active': mode === DutyRosterModeEnum.Daily }"
        @click="emit('updateMode', DutyRosterModeEnum.Daily)"
      >
        <font-awesome-icon :icon="['regular', 'calendar-days']" />
        <span><strong>每组一天</strong><small>固定安排周一至周五</small></span>
      </button>
      <button
        type="button"
        :class="{ 'is-active': mode === DutyRosterModeEnum.Weekly }"
        @click="emit('updateMode', DutyRosterModeEnum.Weekly)"
      >
        <font-awesome-icon :icon="['solid', 'calendar-week']" />
        <span><strong>每组一周</strong><small>一组负责完整一周</small></span>
      </button>
    </div>
    <el-button type="primary" size="large" @click="emit('create')">
      {{ source === 'excel' && !hasExcelSource ? '导入名单并创建' : '创建值日表' }}
    </el-button>
  </div>
</template>

<style scoped lang="scss">
.duty-empty {
  display: grid;
  place-items: center;
  align-content: center;
  min-height: 560px;
  padding: 40px;
  text-align: center;
}

.duty-empty__icon {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  color: #fff;
  background: var(--theme-primary);
  border-radius: 20px;
  font-size: 26px;
  box-shadow: 0 14px 30px color-mix(in srgb, var(--theme-primary) 24%, transparent);
}

.duty-empty h3 {
  margin: 18px 0 5px;
  color: #2b344d;
  font-size: 19px;
}

.duty-empty p {
  margin: 0 0 22px;
  color: #8c8496;
  font-size: 12px;
}

.duty-empty__modes {
  display: grid;
  width: min(520px, 100%);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}

.duty-empty__modes button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  color: #5e566b;
  background: #fff;
  border: 1px solid #e2ddea;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
}

.duty-empty__modes button.is-active {
  color: #6233b4;
  background: #faf8ff;
  border-color: #a889dd;
  box-shadow: 0 8px 20px rgba(87, 57, 129, 0.08);
}

.duty-empty__modes button > svg {
  font-size: 20px;
}

.duty-empty__modes span {
  display: grid;
  gap: 3px;
}

.duty-empty__modes strong {
  font-size: 13px;
}

.duty-empty__modes small {
  color: #9890a2;
  font-size: 10px;
}
</style>
