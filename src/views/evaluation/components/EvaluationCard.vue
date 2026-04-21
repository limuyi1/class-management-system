<script setup lang="ts">
import { computed } from 'vue'

import { useConfigurationStore } from '@/stores/configuration'
import { getEvaluationTextLayoutConstantsPx, getFooterBlockHeightPx, layoutCommentText } from '@/utils/evaluationTextLayoutUntil'
import type { EvaluationCardProps, EvaluationCardEmits } from '@/types/EvaluationCard'
import type { StudentDataType } from '@/types/StudentData'
import { NAME_PROP } from '@/types/Constants'

const store = useConfigurationStore()
const layoutConstantsPx = getEvaluationTextLayoutConstantsPx()

/**
 * 点击评语卡片回调
 * 触发后会激活右侧输入区进行评语编辑
 */
const emit = defineEmits<EvaluationCardEmits>()

const props = withDefaults(defineProps<EvaluationCardProps>(), {
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
  if (!student || props.suppressActiveState || !props.activeStudentName) return false
  return String(student[NAME_PROP] || '') === props.activeStudentName
}

// 预览正文不再依赖浏览器自然换行，而是复用共享排版结果，保证与 PDF 的换行/截断一致。
const getCommentLayout = (student: StudentDataType | undefined) => {
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

  return layoutCommentText(comment, store.textFontSize, bodyWidthPx, bodyHeightPx)
}

// 计算最终样式，确保数值是纯像素（无单位拼接错误）
const cellStyle = computed(() => ({
  width: `${props.pageInfo?.cellWidth}px`,
  height: `${props.pageInfo?.cellHeight}px`, // 目标高度（如261px）
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

const commentLineStyle = computed(() => ({
  lineHeight: `${store.textFontSize * layoutConstantsPx.bodyLineHeightRatio}px`,
  minHeight: `${store.textFontSize * layoutConstantsPx.bodyLineHeightRatio}px`
}))

</script>

<template>
  <el-card
    class="evaluation-card__wrapper"
    :style="{ width: pageInfo.pageWidth + 'px', height: pageInfo.pageHeight + 'px' }"
    shadow="always"
  >
    <div v-if="totalPages" class="page-number">
      第 {{ currentPage }} 页 / 共 {{ totalPages }} 页
    </div>
    <div class="evaluation-card--table__wrapper" :style="tableWrapperStyle">
      <table class="evaluation-card--table" border="0" cellspacing="0" cellpadding="0" :style="tableStyle">
        <template v-for="(item, index) in data">
          <tr v-if="index % pageInfo.columnCount == 0" :key="`${item[NAME_PROP]}_${index}`">
            <template v-for="e in pageInfo.columnCount">
              <td
                v-if="data[index + e - 1]?.[NAME_PROP]"
                :key="e"
                class="table-cell"
                :class="{ 'table-cell--active': isActiveStudent(data[index + e - 1]) }"
                :style="cellStyle"
                @click="emit('click', data[index + e - 1])"
              >
                <div class="cell-content" :style="{ fontSize: store.fontSize + 'px' }">
                  <div class="custom-font" :style="{ fontSize: store.salutationFontSize + 'px' }">
                    {{ data[index + e - 1]?.[NAME_PROP] }}同学：
                  </div>
                  <div
                    class="table-body custom-font"
                    :style="{ fontSize: store.textFontSize + 'px' }"
                  >
                    <div
                      v-for="(line, lineIndex) in getCommentLayout(data[index + e - 1]).lines"
                      :key="`${data[index + e - 1]?.[NAME_PROP]}_${lineIndex}`"
                      class="table-body-line"
                      :style="{
                        ...commentLineStyle,
                        paddingLeft: line.indent ? `${getCommentLayout(data[index + e - 1]).indentWidthPx}px` : '0'
                      }"
                    >
                      {{ line.text }}
                    </div>
                  </div>
                  <div class="table-footer">
                    <span class="label-font" :style="{ fontSize: store.sealFontSize + 'px' }">学校：（章）</span>
                    <span class="label-font" :style="{ fontSize: store.classTeacherFontSize + 'px' }">
                      班主任：<span
                        class="custom-font"
                        :style="{ fontSize: store.inscribeFontSize + 'px' }"
                        >{{ store.inscribe }}</span
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
  position: relative;
  height: 100%;

  // 清空el-card默认样式，避免干扰
  :deep(.el-card__body) {
    padding: 0 !important;
    height: 100% !important;
    min-height: 0 !important; // 移除最小高度限制
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
    border-collapse: collapse; // 合并边框，消除边框间距
    table-layout: fixed;
    border-top: 1px dashed #000;
    border-left: 1px dashed #000;
    box-sizing: border-box;
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
      background:
        linear-gradient(180deg, rgba(224, 242, 254, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%);
      box-shadow: inset 0 0 0 2px rgba(14, 165, 233, 0.28);
    }
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

    .label-font {
      font-family: SHSerifSC, serif;
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
</style>
