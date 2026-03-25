<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useConfigurationStore } from '@/stores/configuration'

const store = useConfigurationStore()
const { data: configuration } = storeToRefs(store)

interface PageInoType {
  pageWidth: number
  pageHeight: number
  cellWidth: number
  cellHeight: number
  columnCount: number
  margin: number
}

interface Props {
  pageInfo: PageInoType
  data: Array<any>
}

const props = withDefaults(defineProps<Props>(), {
  pageInfo: () => ({
    pageWidth: 0,
    pageHeight: 0,
    cellWidth: 0,
    cellHeight: 0,
    columnCount: 0,
    margin: 0
  })
})

const getEvaluationText = (str: string | undefined | null) => {
  if (str) return str?.replace('\n', '<br />') || ''
  return ''
}

// 计算最终样式，确保数值是纯像素（无单位拼接错误）
const cellStyle = computed(() => ({
  width: `${props.pageInfo?.cellWidth}px`,
  height: `${props.pageInfo?.cellHeight}px`, // 目标高度（如261px）
  fontSize: `${configuration.value.fontSize}px`
}))
</script>

<template>
  <el-card
    class="evaluation-card__wrapper"
    :style="{ width: pageInfo.pageWidth + 'px', height: pageInfo.pageHeight + 'px' }"
    shadow="always"
  >
    <div
      class="evaluation-card--table__wrapper"
      :style="{ padding: `${pageInfo.margin / 2}px ${pageInfo.margin}px` }"
    >
      <table class="evaluation-card--table" border="0" cellspacing="0" cellpadding="0">
        <template v-for="(item, index) in props.data">
          <tr v-if="index % pageInfo.columnCount == 0" :key="`${item.xing4_ming2}_${index}`">
            <template v-for="e in pageInfo.columnCount">
              <td
                v-if="props.data[index + e - 1]?.xing4_ming2"
                :key="e"
                class="table-cell"
                :style="cellStyle"
              >
                <div class="cell-content" :style="{ fontSize: configuration.fontSize + 'px' }">
                  <div
                    class="custom-font"
                    :style="{ fontSize: configuration.salutationFontSize + 'px' }"
                  >
                    {{ props.data[index + e - 1]?.xing4_ming2 }}同学：
                  </div>
                  <div
                    class="table-body custom-font"
                    :style="{ fontSize: configuration.textFontSize + 'px' }"
                    v-html="getEvaluationText(props.data[index + e - 1]?.comment)"
                  ></div>
                  <div class="table-footer">
                    <span :style="{ fontSize: configuration.sealFontSize + 'px' }"
                      >学校：（章）</span
                    >
                    <span :style="{ fontSize: configuration.classTeacherFontSize + 'px' }">
                      班主任：<span
                        class="custom-font"
                        :style="{ fontSize: configuration.inscribeFontSize + 'px' }"
                        >{{ configuration.inscribe }}</span
                      >
                    </span>
                  </div>
                </div>
              </td>
            </template>
          </tr>
        </template>
      </table>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
// 核心：重置所有可能导致td高度偏大的样式
.evaluation-card__wrapper {
  height: 100%;
  margin-bottom: 24px;

  // 清空el-card默认样式，避免干扰
  :deep(.el-card__body) {
    padding: 0 !important;
    height: 100% !important;
    min-height: 0 !important; // 移除最小高度限制
  }

  .evaluation-card--table__wrapper {
    display: block;
    height: 100%;
    overflow: hidden;
  }

  .evaluation-card--table {
    border-collapse: collapse; // 合并边框，消除边框间距
    table-layout: fixed;
    border-top: 1px dashed #000;
    border-left: 1px dashed #000;
    box-sizing: border-box;
    width: 100%;
    min-height: 0 !important; // 移除最小高度
  }

  // 关键：精准锁定tr高度，无额外增量
  tr {
    height: v-bind('props.pageInfo.cellHeight + "px"') !important;
    line-height: normal !important; // 重置行高，避免拉高
    min-height: 0 !important;
  }

  // 核心修复td高度偏大的问题
  :deep(.table-cell) {
    border-bottom: 1px dashed #000;
    border-right: 1px dashed #000;
    box-sizing: border-box !important; // 高度包含padding/border
    padding: 8px !important; // 明确padding，避免浏览器默认值
    vertical-align: top !important; // 取消垂直居中，避免额外高度
    line-height: normal !important; // 重置行高
    min-height: 0 !important; // 移除最小高度限制
    height: v-bind('props.pageInfo.cellHeight + "px"') !important; // 强制锁定高度
    overflow: hidden;
  }

  // 内容区仅撑满td，不额外增高
  :deep(.cell-content) {
    width: 100%;
    height: 100% !important; // 严格等于td高度
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    line-height: normal;

    .custom-font {
      font-family: FYFont, sans-serif;
    }
  }

  :deep(.table-body) {
    flex: 1;
    text-indent: 2em;
    overflow: hidden;
    word-break: break-all;
    line-height: normal;
  }

  :deep(.table-footer) {
    width: 100%;
    display: flex;
    justify-content: space-between;
    padding: 0 8px;
    box-sizing: border-box;
  }
}

:deep(table) {
  border-spacing: 0 !important;
  border-collapse: collapse !important;
}
:deep(td) {
  margin: 0 !important;
  padding: 0 !important;
  line-height: normal !important;
  vertical-align: top !important;
}
</style>
