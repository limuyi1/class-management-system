<script setup lang="ts">
/**
 * 评语工作区工具栏
 * 展示完成进度，并提供批量处理、导出与字体切换、重置评语等操作入口。
 */
import CommentSourceBar from '@/views/evaluation/components/CommentSourceBar.vue'

import type { CommentWorkspaceSourceType } from '@/types/CommentWorkspace'

/** 评语工作区工具栏的 Props */
interface Props {
  source: CommentWorkspaceSourceType
  systemStudentCount: number
  excelFileName?: string
  excelStudentCount?: number
  completedCount: number
  totalCount: number
  percentage: number
  hasData: boolean
  batchProcessing: boolean
  exporting: boolean
  handwriteFontName?: string
  displayHandwriteFontName: string
  handwriteFontApplying: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  sourceChange: [source: CommentWorkspaceSourceType]
  upload: []
  batchAction: [command: string | number | object]
  exportAction: [command: string | number | object]
  reset: []
  chooseFont: []
  clearFont: []
}>()

/** 分发“更多”菜单命令 */
const handleMoreAction = (command: string | number | object): void => {
  if (command === 'reset-comments') emit('reset')
}
</script>

<template>
  <comment-source-bar
    :source="source"
    :system-student-count="systemStudentCount"
    :excel-file-name="excelFileName"
    :excel-student-count="excelStudentCount"
    @change="emit('sourceChange', $event)"
    @upload="emit('upload')"
  >
    <template #actions>
      <!-- 评语完成进度 -->
      <div class="workspace-progress" title="评语完成进度">
        <span>完成 {{ completedCount }}/{{ totalCount }}</span>
        <el-progress
          :percentage="percentage"
          :stroke-width="5"
          :show-text="false"
          color="var(--theme-primary)"
        />
        <strong>{{ percentage.toFixed(0) }}%</strong>
      </div>

      <!-- 批量处理：生成空白评语 / 重新生成全部 / 润色已有评语 -->
      <el-dropdown
        trigger="click"
        placement="bottom-end"
        :disabled="!hasData || batchProcessing"
        @command="emit('batchAction', $event)"
      >
        <el-button
          class="workspace-action-btn"
          type="primary"
          :disabled="!hasData"
          :loading="batchProcessing"
        >
          <template #icon>
            <font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" />
          </template>
          批量处理
          <font-awesome-icon class="action-arrow" :icon="['solid', 'chevron-down']" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="fill-empty">
              <font-awesome-icon :icon="['solid', 'plus']" />
              <span>生成空白评语</span>
            </el-dropdown-item>
            <el-dropdown-item command="overwrite">
              <font-awesome-icon :icon="['solid', 'rotate']" />
              <span>重新生成全部</span>
            </el-dropdown-item>
            <el-dropdown-item command="polish" divided>
              <font-awesome-icon :icon="['solid', 'pen-nib']" />
              <span>润色已有评语</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 导出 PDF / Excel -->
      <el-dropdown
        trigger="click"
        placement="bottom-end"
        :disabled="!hasData || exporting"
        @command="emit('exportAction', $event)"
      >
        <el-button class="workspace-action-btn" :disabled="!hasData" :loading="exporting">
          <template #icon><font-awesome-icon :icon="['solid', 'file-export']" /></template>
          导出
          <font-awesome-icon class="action-arrow" :icon="['solid', 'chevron-down']" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="pdf">
              <font-awesome-icon :icon="['solid', 'file-pdf']" />
              <span>导出 PDF</span>
            </el-dropdown-item>
            <el-dropdown-item command="excel">
              <font-awesome-icon :icon="['solid', 'file-excel']" />
              <span>导出 Excel</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 更多操作：手写字体切换与重置评语 -->
      <el-dropdown trigger="click" placement="bottom-end" @command="handleMoreAction">
        <el-button class="workspace-more-btn" circle aria-label="更多评语操作" :disabled="!hasData">
          <font-awesome-icon :icon="['solid', 'ellipsis']" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item class="font-dropdown-item" @click.stop>
              <div class="font-control-row">
                <div class="font-status-item" :title="handwriteFontName || '默认手写字体'">
                  <font-awesome-icon :icon="['solid', 'font']" />
                  <span>{{ handwriteFontName ? displayHandwriteFontName : '默认手写字体' }}</span>
                </div>
                <button
                  class="font-mini-action"
                  type="button"
                  :disabled="handwriteFontApplying"
                  @click.stop="emit('chooseFont')"
                >
                  {{ handwriteFontApplying ? '应用中' : '更换' }}
                </button>
                <button
                  v-if="handwriteFontName"
                  class="font-mini-action is-muted"
                  type="button"
                  @click.stop="emit('clearFont')"
                >
                  默认
                </button>
              </div>
            </el-dropdown-item>
            <el-dropdown-item command="reset-comments" divided>
              <font-awesome-icon :icon="['solid', 'trash-can']" />
              <span>重置评语</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>
  </comment-source-bar>
</template>

<style scoped lang="scss">
.workspace-progress {
  width: 200px;
  display: grid;
  grid-template-columns: auto minmax(54px, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 0 5px;

  span {
    color: #64748b;
    font-size: 11px;
    white-space: nowrap;
  }

  :deep(.el-progress) {
    min-width: 54px;
  }

  strong {
    color: var(--theme-primary);
    font-size: 11px;
  }
}

.workspace-action-btn {
  height: 34px;
  margin-left: 0;
}

.workspace-more-btn {
  width: 34px;
  height: 34px;
}

.action-arrow {
  margin-left: 6px;
  font-size: 9px;
  opacity: 0.65;
}

.font-dropdown-item {
  cursor: default;

  &:hover,
  &:focus {
    background: transparent;
  }
}

.font-control-row {
  min-width: 218px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
}

.font-status-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #64748b;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.font-mini-action {
  height: 24px;
  padding: 0 8px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 24%, #ffffff);
  border-radius: 6px;
  font-size: 12px;
  line-height: 22px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &.is-muted {
    color: #64748b;
    background: #fff;
    border-color: #e2e8f0;
  }
}

@media (max-width: 1180px) {
  .workspace-progress {
    width: 110px;

    span {
      display: none;
    }
  }
}
</style>
