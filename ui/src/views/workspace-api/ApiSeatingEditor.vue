<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import ApiSeatingCanvas from './ApiSeatingCanvas.vue'
import SeatingRoleManagementDialog from '@/views/seating-chart/components/SeatingRoleManagementDialog.vue'
import {
  createRandomSeats,
  getResizeAffectedCount,
  resizeSeats
} from '@/utils/seating-chart/seatingChartUtil'
import {
  rotateSeatingChart,
  SeatingRotationDirectionEnum
} from '@/utils/seating-chart/seatingRotationUtil'
import { SeatingFirstColumnSideEnum, SeatingPlatformPositionEnum } from '@/types/SeatingChart'
import type {
  SeatingChartType,
  SeatingRoleDefinitionType,
  SeatingRoleAssignmentType
} from '@/types/SeatingChart'
import type { StudentSourceStudentType } from '@/types/StudentSource'

const props = defineProps<{ chart: SeatingChartType; students: StudentSourceStudentType[] }>()
const emit = defineEmits<{ 'update:chart': [value: SeatingChartType] }>()
/** 子编辑器使用局部草稿，修改通过事件交还父页面，不直接改传入属性。 */
const chart = ref<SeatingChartType>(JSON.parse(JSON.stringify(props.chart)) as SeatingChartType)
watch(chart, (value) => emit('update:chart', value), { deep: true, immediate: true })
watch(
  () => props.chart,
  (value) => {
    if (value !== chart.value) chart.value = JSON.parse(JSON.stringify(value)) as SeatingChartType
  }
)
const rolesVisible = ref(false)
const rows = ref(chart.value.rows)
const columns = ref(chart.value.columns)
/** 更换座位时先释放原位置，保证同一学生只有一个座位。 */
function assign(target: { studentId: string | null }, value: string | null): void {
  for (const seat of [...chart.value.seats, ...chart.value.specialSeats])
    if (seat !== target && value && seat.studentId === value) seat.studentId = null
  target.studentId = value || null
}
async function resize(): Promise<void> {
  if (getResizeAffectedCount(chart.value, rows.value, columns.value)) {
    try {
      await ElMessageBox.confirm('缩小布局会将超出范围的学生放回未安排名单，继续？', '调整布局', {
        type: 'warning'
      })
    } catch {
      return
    }
  }
  chart.value.seats = resizeSeats(chart.value, rows.value, columns.value)
  chart.value.rows = rows.value
  chart.value.columns = columns.value
  chart.value.aisleAfterColumns = chart.value.aisleAfterColumns.filter(
    (column) => column < columns.value - 1
  )
}
async function randomize(supplement: boolean): Promise<void> {
  if (!supplement) {
    try {
      await ElMessageBox.confirm('重新随机安排全部普通座位？', '随机排座', { type: 'warning' })
    } catch {
      return
    }
  }
  chart.value.seats = createRandomSeats(
    chart.value,
    props.students.map((student) => student.id),
    supplement
  ).seats
}
function saveRoles(
  definitions: SeatingRoleDefinitionType[],
  assignments: SeatingRoleAssignmentType[]
): void {
  chart.value.roleDefinitions = definitions
  chart.value.roleAssignments = assignments
}
const hasDraft = computed(
  () =>
    rolesVisible.value || rows.value !== chart.value.rows || columns.value !== chart.value.columns
)
defineExpose({ hasDraft })
</script>

<template>
  <div class="seating-editor">
    <div class="seating-editor__toolbar">
      <span>行</span><el-input-number v-model="rows" :min="1" :max="20" /> <span>列</span
      ><el-input-number v-model="columns" :min="1" :max="20" />
      <el-button @click="resize">应用布局</el-button>
      <el-button @click="randomize(false)">随机排座</el-button>
      <el-button @click="randomize(true)">补充空座</el-button>
      <el-button @click="rolesVisible = true">职务设置</el-button>
    </div>
    <div class="seating-editor__toolbar">
      <el-radio-group v-model="chart.firstColumnSide">
        <el-radio-button :value="SeatingFirstColumnSideEnum.Left">第一列在左</el-radio-button>
        <el-radio-button :value="SeatingFirstColumnSideEnum.Right">第一列在右</el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="chart.platformPosition">
        <el-radio-button :value="SeatingPlatformPositionEnum.Top">讲台在上</el-radio-button>
        <el-radio-button :value="SeatingPlatformPositionEnum.Bottom">讲台在下</el-radio-button>
      </el-radio-group>
      <el-button
        v-for="(label, direction) in {
          forward: '向前轮换',
          backward: '向后轮换',
          left: '向左轮换',
          right: '向右轮换'
        }"
        :key="direction"
        @click="
          chart.seats = rotateSeatingChart(
            chart,
            direction as SeatingRotationDirectionEnum,
            1,
            chart.rotationFixedStudentIds || []
          )
        "
        >{{ label }}</el-button
      >
    </div>
    <ApiSeatingCanvas v-model="chart" :students="students" />
    <el-collapse
      ><el-collapse-item title="按行列精确选择座位">
        <p>轮换固定学生</p>
        <el-select
          v-model="chart.rotationFixedStudentIds"
          multiple
          filterable
          placeholder="选择轮换时保持原座位的学生"
        >
          <el-option
            v-for="student in students"
            :key="student.id"
            :value="student.id"
            :label="student.name"
          />
        </el-select>
        <p>列间过道</p>
        <el-checkbox-group v-model="chart.aisleAfterColumns">
          <el-checkbox
            v-for="column in Math.max(0, chart.columns - 1)"
            :key="column"
            :value="column - 1"
            >第 {{ column }} 列后</el-checkbox
          >
        </el-checkbox-group>
        <el-scrollbar class="app-scroll-region"
          ><div
            class="seating-editor__grid"
            :style="{ gridTemplateColumns: `repeat(${chart.columns}, minmax(140px, 1fr))` }"
          >
            <div
              v-for="seat in [...chart.seats].sort(
                (a, b) =>
                  a.row - b.row ||
                  (chart.firstColumnSide === 'left' ? a.column - b.column : b.column - a.column)
              )"
              :key="`${seat.row}:${seat.column}`"
            >
              <small>{{ seat.row + 1 }} 排 {{ seat.column + 1 }} 列</small>
              <el-select
                :model-value="seat.studentId"
                clearable
                filterable
                placeholder="空座"
                @change="assign(seat, $event)"
              >
                <el-option
                  v-for="student in students"
                  :key="student.id"
                  :value="student.id"
                  :label="student.name"
                />
              </el-select>
            </div></div
        ></el-scrollbar>
        <div
          v-for="seat in chart.specialSeats"
          :key="seat.position"
          class="seating-editor__toolbar"
        >
          <el-checkbox v-model="seat.enabled" @change="!seat.enabled && (seat.studentId = null)">{{
            seat.position === 'platform-left' ? '讲台左侧雅座' : '讲台右侧雅座'
          }}</el-checkbox>
          <el-select
            :model-value="seat.studentId"
            :disabled="!seat.enabled"
            clearable
            filterable
            @change="assign(seat, $event)"
          >
            <el-option
              v-for="student in students"
              :key="student.id"
              :value="student.id"
              :label="student.name"
            />
          </el-select>
        </div> </el-collapse-item
    ></el-collapse>
    <SeatingRoleManagementDialog
      v-model="rolesVisible"
      :definitions="chart.roleDefinitions"
      :assignments="chart.roleAssignments"
      :students="students"
      @save="saveRoles"
    />
  </div>
</template>

<style scoped lang="scss">
.seating-editor {
  &__toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    margin: 16px 0;
  }
  &__grid {
    display: grid;
    gap: 12px;
    overflow: visible;
    margin: 20px 0;
    padding: 12px;
    background: var(--el-fill-color-light);
  }
  small {
    display: block;
    margin-bottom: 6px;
  }
}
</style>
