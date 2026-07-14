<script setup lang="ts">
import type { CommentWorkspaceSourceType } from '@/types/CommentWorkspace'

interface Props {
  source: CommentWorkspaceSourceType
  systemStudentCount: number
  excelFileName?: string
  excelStudentCount?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  change: [source: CommentWorkspaceSourceType]
  upload: []
}>()

const handleSourceCommand = (command: string | number | object): void => {
  if (command === 'system') {
    if (props.systemStudentCount === 0) return
    emit('change', command)
    return
  }
  if (command === 'excel') {
    emit('change', command)
    return
  }
  if (command === 'upload') emit('upload')
}
</script>

<template>
  <div class="comment-source-bar">
    <div class="source-cluster">
      <span class="source-caption">数据来源</span>
      <el-dropdown trigger="click" placement="bottom-start" @command="handleSourceCommand">
        <button class="source-trigger" type="button">
          <span class="source-trigger__icon" :class="{ 'is-excel': source === 'excel' }">
            <font-awesome-icon :icon="['solid', source === 'system' ? 'users' : 'file-excel']" />
          </span>
          <span class="source-trigger__text">
            <strong>{{
              source === 'system' ? '系统学生' : excelFileName || 'Excel 临时数据'
            }}</strong>
            <small
              >{{ source === 'system' ? systemStudentCount : excelStudentCount || 0 }} 人</small
            >
          </span>
          <font-awesome-icon class="source-trigger__arrow" :icon="['solid', 'chevron-down']" />
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="system" :disabled="systemStudentCount === 0">
              <font-awesome-icon :icon="['solid', 'users']" />
              <span>系统学生（{{ systemStudentCount }}）</span>
            </el-dropdown-item>
            <el-dropdown-item v-if="excelFileName" command="excel">
              <font-awesome-icon :icon="['solid', 'file-excel']" />
              <span>{{ excelFileName }}（{{ excelStudentCount || 0 }}）</span>
            </el-dropdown-item>
            <el-dropdown-item command="upload" :divided="!!excelFileName">
              <font-awesome-icon :icon="['solid', 'file-arrow-up']" />
              <span>{{ excelFileName ? '更换 Excel 文件' : '上传 Excel 临时数据' }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <span class="source-note" :class="{ 'is-temporary': source === 'excel' }">
        {{ source === 'system' ? '保存后写回当前班级' : '临时处理，不写入系统' }}
      </span>
    </div>

    <div class="workspace-actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped lang="scss">
.comment-source-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  min-height: 52px;
  padding: 7px 9px 7px 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 5px 16px rgba(15, 23, 42, 0.035);
}

.source-cluster,
.workspace-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.source-caption {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.source-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 172px;
  height: 38px;
  padding: 0 9px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;

  &:hover {
    background: #fff;
    border-color: color-mix(in srgb, var(--theme-primary) 34%, #e2e8f0);
  }
}

.source-trigger__icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 10%, #fff);
  border-radius: 7px;

  &.is-excel {
    color: #15803d;
    background: #ecfdf3;
  }
}

.source-trigger__text {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1;
  text-align: left;

  strong {
    max-width: 150px;
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: #94a3b8;
    font-size: 11px;
    white-space: nowrap;
  }
}

.source-trigger__arrow {
  color: #94a3b8;
  font-size: 10px;
}

.source-note {
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;

  &.is-temporary {
    color: #b45309;
  }
}

.workspace-actions {
  justify-content: flex-end;
  flex: 1;
}

@media (max-width: 1220px) {
  .source-note,
  .source-caption {
    display: none;
  }
}
</style>
