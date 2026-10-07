import { computed, ref } from 'vue'

import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useSeatingChartStore } from '@/stores/seating-chart'
import { SeatingFirstColumnSideEnum, type SeatPositionType } from '@/types/SeatingChart'
import { getResizeAffectedCount, getVisibleSeats } from '@/utils/seating-chart/seatingChartUtil'

/** 管理座位行列与过道的编辑草稿，缩减布局前确认受影响人数。 */
export function useSeatingChartLayout() {
  const seatingStore = useSeatingChartStore()
  const { editingChart } = storeToRefs(seatingStore)

  // 各类弹窗的显隐状态
  const layoutVisible = ref(false)

  const aisleVisible = ref(false)

  // 布局弹窗中的临时行列与第一列方向设置
  const layout = ref({
    rows: 6,
    columns: 6,
    firstColumnSide: SeatingFirstColumnSideEnum.Left
  })

  // 过道弹窗中的临时过道列设置
  const aisles = ref<number[]>([])

  /** 当前座位表的可见座位（过滤过道占位列） */
  const visibleSeats = computed(() =>
    editingChart.value ? getVisibleSeats(editingChart.value) : []
  )

  /** 将可见座位按行分组，供画布逐行渲染 */
  const visibleSeatRows = computed(() => {
    const rows: SeatPositionType[][] = []
    visibleSeats.value.forEach((seat) => {
      const currentRow = rows[rows.length - 1]
      if (!currentRow || currentRow[0].row !== seat.row) rows.push([seat])
      else currentRow.push(seat)
    })
    return rows
  })

  /** 打开布局弹窗，用当前座位表设置初始化临时布局 */
  function openLayout(): void {
    if (!editingChart.value) return
    layout.value = {
      rows: editingChart.value.rows,
      columns: editingChart.value.columns,
      firstColumnSide: editingChart.value.firstColumnSide
    }
    layoutVisible.value = true
  }

  /** 应用行列调整；缩减座位时先确认受影响学生数量 */
  async function confirmLayout(): Promise<void> {
    if (!editingChart.value) return
    const affected = getResizeAffectedCount(
      editingChart.value,
      layout.value.rows,
      layout.value.columns
    )
    if (affected)
      await ElMessageBox.confirm(
        `缩减后将有 ${affected} 名学生变为未安排，是否继续？`,
        '确认调整',
        {
          type: 'warning'
        }
      )
    seatingStore.resizeChart(layout.value.rows, layout.value.columns)
    seatingStore.setFirstColumnSide(layout.value.firstColumnSide)
    layoutVisible.value = false
  }

  /** 打开过道弹窗，用当前过道设置初始化 */
  function openAisles(): void {
    aisles.value = [...(editingChart.value?.aisleAfterColumns || [])]
    aisleVisible.value = true
  }

  /** 保存过道设置 */
  function saveAisles(): void {
    seatingStore.setAisles(aisles.value)
    aisleVisible.value = false
  }
  return {
    layoutVisible,
    aisleVisible,
    layout,
    aisles,
    visibleSeats,
    visibleSeatRows,
    openLayout,
    confirmLayout,
    openAisles,
    saveAisles
  }
}
