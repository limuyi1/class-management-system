<script setup lang="ts">
import { computed } from 'vue'

import { useConfigurationStore } from '@/stores/configuration'
import {
  getEvaluationTextLayoutConstantsPx,
  getFooterBlockHeightPx,
  MIN_ADAPTIVE_COMMENT_FONT_SIZE_PX,
  layoutAdaptiveCommentText
} from '@/utils/evaluation/evaluationTextLayoutUtil'
import type { AdaptiveEvaluationCommentLayoutResultType } from '@/utils/evaluation/evaluationTextLayoutUtil'
import type {
  EvaluationPreviewCardEmitsType,
  EvaluationPreviewCardPropsType
} from '@/types/Evaluation'
import type { StudentDataType } from '@/types/StudentData'
import { NAME_PROP } from '@/constants'

const store = useConfigurationStore()
const layoutConstantsPx = getEvaluationTextLayoutConstantsPx()

const emit = defineEmits<EvaluationPreviewCardEmitsType>()

const props = withDefaults(defineProps<EvaluationPreviewCardPropsType>(), {
  pageInfo: () => ({
    pageWidth: 0,
    pageHeight: 0,
    cellWidth: 0,
    cellHeight: 0,
    columnCount: 0,
    marginX: 0,
    marginY: 0,
    tableWidth: 0,
    tableOffsetX: 0
  })
})

const isActiveStudent = (student: Record<string, unknown> | undefined) => {
  if (!student || props.suppressActiveState || !props.activeStudentId) return false
  return student.studentId === props.activeStudentId
}

/**
 * 预览正文和 PDF 正文共用同一套排版规则。
 * 如果后续要人工调整正文可用空间，优先改这里的宽高计算。
 */
const getCommentLayout = (
  student: StudentDataType | undefined
): AdaptiveEvaluationCommentLayoutResultType => {
  // 字体切换后需要触发重新测量，否则预览仍可能沿用旧字体的断行结果。
  void store.evaluationHandwriteFont?.updatedAt
  const comment = student?.comment || ''
  const bodyWidthPx = Math.max(props.pageInfo.cellWidth - layoutConstantsPx.innerPaddingX * 2, 1)
  const headerHeightPx = store.salutationFontSize * 1.2
  const footerBlockHeightPx = getFooterBlockHeightPx(store)
  const bodyHeightPx = Math.max(
    4,
    props.pageInfo.cellHeight -
      layoutConstantsPx.innerPaddingY * 2 -
      headerHeightPx -
      layoutConstantsPx.headerGap -
      layoutConstantsPx.bodyGap -
      layoutConstantsPx.footerGap -
      footerBlockHeightPx
  )

  return layoutAdaptiveCommentText(
    comment,
    store.textFontSize,
    MIN_ADAPTIVE_COMMENT_FONT_SIZE_PX,
    bodyWidthPx,
    bodyHeightPx
  )
}

const cellStyle = computed(() => ({
  width: `${props.pageInfo?.cellWidth}px`,
  height: `${props.pageInfo?.cellHeight}px`,
  fontSize: `${store.fontSize}px`
}))

const tableWrapperStyle = computed(() => ({
  width: `${props.pageInfo.pageWidth}px`,
  height: `${props.pageInfo.pageHeight}px`,
  padding: `${props.pageInfo.marginY}px 0`,
  boxSizing: 'border-box' as const
}))

const tableStyle = computed(() => ({
  width: `${props.pageInfo.tableWidth}px`,
  marginLeft: `${props.pageInfo.tableOffsetX}px`
}))

const getCommentBodyStyle = (layout: AdaptiveEvaluationCommentLayoutResultType) => ({
  fontSize: `${layout.fontSizePx}px`
})

const getAdaptiveCommentLineStyle = (
  layout: AdaptiveEvaluationCommentLayoutResultType,
  indent: boolean
) => {
  const lineStyle = {
    lineHeight: `${layout.lineHeightPx}px`,
    minHeight: `${layout.lineHeightPx}px`,
    paddingLeft: '0'
  }

  if (!indent) return lineStyle

  return {
    ...lineStyle,
    paddingLeft: `${layout.indentWidthPx}px`
  }
}
</script>

<template>
  <el-card
    class="evaluation-card__wrapper"
    :style="{ width: pageInfo.pageWidth + 'px', height: pageInfo.pageHeight + 'px' }"
    shadow="always"
  >
    <div v-if="store.showEvaluationPageNumber && totalPages" class="page-number">
      第 {{ currentPage }} 页 / 共 {{ totalPages }} 页
    </div>
    <div class="evaluation-card--table__wrapper" :style="tableWrapperStyle">
      <table
        class="evaluation-card--table"
        border="0"
        cellspacing="0"
        cellpadding="0"
        :style="tableStyle"
      >
        <template v-for="(item, index) in data">
          <tr v-if="index % pageInfo.columnCount == 0" :key="`${item.studentId}_${index}`">
            <template v-for="e in pageInfo.columnCount" :key="`cell_${index}_${e}`">
              <td
                v-if="data[index + e - 1]?.[NAME_PROP]"
                class="table-cell"
                :class="{ 'table-cell--active': isActiveStudent(data[index + e - 1]) }"
                :style="cellStyle"
                @click="emit('click', data[index + e - 1])"
              >
                <div class="cell-content" :style="{ fontSize: store.fontSize + 'px' }">
                  <div class="custom-font" :style="{ fontSize: store.salutationFontSize + 'px' }">
                    {{ data[index + e - 1]?.[NAME_PROP] }}同学：
                  </div>
                  <!-- 正文区域复用共享排版结果，预览层额外处理轻微溢出的缩字和 tooltip。 -->
                  <template
                    v-for="commentLayout in [getCommentLayout(data[index + e - 1])]"
                    :key="`${data[index + e - 1]?.studentId}_${commentLayout.fontSizePx}_${commentLayout.showTooltip}`"
                  >
                    <el-tooltip
                      :content="String(data[index + e - 1]?.comment || '')"
                      placement="top"
                      :disabled="!commentLayout.showTooltip"
                      popper-class="evaluation-comment-tooltip"
                    >
                      <div
                        class="table-body custom-font"
                        :style="getCommentBodyStyle(commentLayout)"
                      >
                        <div
                          v-for="(line, lineIndex) in commentLayout.lines"
                          :key="`${data[index + e - 1]?.studentId}_${lineIndex}`"
                          class="table-body-line"
                          :style="getAdaptiveCommentLineStyle(commentLayout, line.indent)"
                        >
                          {{ line.text }}
                        </div>
                      </div>
                    </el-tooltip>
                  </template>
                  <div class="table-footer">
                    <span class="label-font" :style="{ fontSize: store.sealFontSize + 'px' }"
                      >学校：（章）</span
                    >
                    <span
                      class="label-font"
                      :style="{ fontSize: store.classTeacherFontSize + 'px' }"
                    >
                      班主任：<span
                        class="custom-font"
                        :style="{ fontSize: store.inscribeFontSize + 'px' }"
                        >{{ store.inscribe }}</span
                      >
                    </span>
                  </div>
                </div>
              </td>
              <!-- 无数据时渲染占位空单元格（不可点击、无激活状态） -->
              <td v-else class="table-cell table-cell--placeholder" :style="cellStyle"></td>
            </template>
          </tr>
        </template>
      </table>
    </div>
  </el-card>
</template>

<style scoped lang="scss">
.evaluation-card__wrapper {
  position: relative;
  height: 100%;

  :deep(.el-card__body) {
    padding: 0 !important;
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden;
  }

  .page-number {
    position: absolute;
    top: 8px;
    right: 16px;
    font-size: 12px;
    color: #999;
    z-index: 1;
  }

  .evaluation-card--table__wrapper {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .evaluation-card--table {
    border-collapse: collapse;
    table-layout: fixed;
    border-top: 1px dashed #000;
    border-left: 1px dashed #000;
    box-sizing: border-box;
    min-height: 0 !important;
  }

  tr {
    height: v-bind('props.pageInfo.cellHeight + "px"') !important;
    line-height: normal !important;
    min-height: 0 !important;
  }

  :deep(.table-cell) {
    border-bottom: 1px dashed #000;
    border-right: 1px dashed #000;
    box-sizing: border-box !important;
    padding: 8px !important;
    vertical-align: top !important;
    line-height: normal !important;
    min-height: 0 !important;
    height: v-bind('props.pageInfo.cellHeight + "px"') !important;
    overflow: hidden;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f0f9ff;
    }

    &.table-cell--active {
      background: linear-gradient(
        180deg,
        rgba(224, 242, 254, 0.9) 0%,
        rgba(248, 250, 252, 0.95) 100%
      );
      box-shadow: inset 0 0 0 2px rgba(14, 165, 233, 0.28);
    }
  }

  :deep(.table-cell--placeholder) {
    cursor: default;
    pointer-events: none; // 完全禁止交互
    background-color: transparent !important;
    box-shadow: none !important;

    &:hover {
      background-color: transparent !important;
    }
  }

  :deep(.cell-content) {
    width: 100%;
    height: 100% !important;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    line-height: normal;

    .custom-font {
      font-family: EvaluationHandwriteFont, FYFont, sans-serif;
    }

    .label-font {
      font-family: EvaluationLabelSerif, serif;
    }
  }

  :deep(.table-body) {
    flex: 1;
    overflow: hidden;
    line-height: normal;
  }

  :deep(.table-body-line) {
    white-space: nowrap;
    overflow: hidden;
    box-sizing: border-box;
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

:global(.evaluation-comment-tooltip) {
  max-width: 360px;
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
}
</style>
