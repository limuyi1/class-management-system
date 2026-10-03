import { ref } from 'vue'

import { ElMessage } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useSeatingChartStore } from '@/stores/seating-chart'
import { type SeatingChartPreviewType } from '@/types/SeatingChart'
import { createRandomSeats } from '@/utils/seating-chart/seatingChartUtil'

/** 管理全部随机排座和空座补充预览，保持预览与最终应用独立。 */
export function useSeatingChartRandomization() {
  const seatingStore = useSeatingChartStore()
  const { editingChart, activeStudents } = storeToRefs(seatingStore)

  const randomModeVisible = ref(false)

  const previewVisible = ref(false)

  // 补充空座位的随机方案预览数据
  const preview = ref<SeatingChartPreviewType | null>(null)

  /** 随机排座入口：空座位表直接全部随机，否则弹出模式选择 */
  function randomize(): void {
    if (!editingChart.value) return
    if (seatingStore.isEmptyChart) {
      const count = seatingStore.randomizeAll()
      if (count) ElMessage.warning(`座位不足，还有 ${count} 名学生未安排`)
      return
    }
    randomModeVisible.value = true
  }

  /** 清空并重新随机安排全部学生，座位不足时提示未安排数量 */
  function randomizeAll(): void {
    randomModeVisible.value = false
    const count = seatingStore.randomizeAll()
    if (count) ElMessage.warning(`座位不足，还有 ${count} 名学生未安排`)
  }

  /** 生成“补充空座位”的随机方案预览 */
  function generatePreview(): void {
    if (!editingChart.value) return
    preview.value = createRandomSeats(
      editingChart.value,
      activeStudents.value.map((student) => student.id),
      true
    )
  }

  /** 关闭模式弹窗并打开补充方案预览 */
  function openSupplement(): void {
    randomModeVisible.value = false
    generatePreview()
    previewVisible.value = true
  }

  /** 应用补充方案预览，仍有未安排学生时给出提示 */
  function applyPreview(): void {
    if (!preview.value) return
    seatingStore.applySupplementPreview(preview.value.seats)
    previewVisible.value = false
    if (preview.value.unassignedCount)
      ElMessage.warning(`还有 ${preview.value.unassignedCount} 名学生未安排`)
  }
  return {
    randomModeVisible,
    previewVisible,
    preview,
    randomize,
    randomizeAll,
    generatePreview,
    openSupplement,
    applyPreview
  }
}
