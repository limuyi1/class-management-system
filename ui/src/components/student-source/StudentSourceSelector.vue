<script setup lang="ts">
import type { StudentSourceType } from '@/types/StudentSource'

/**
 * 系统学生/Excel 名单的公共来源选择器。
 *
 * 组件只展示来源、人数并派发 change/upload 事件，不持有名单，也不决定切换后是否清空业务数据；
 * 这些副作用必须由座位表、评语处理等业务容器自行确认和执行。
 */
interface Props {
  /** 当前数据来源 */
  source: StudentSourceType
  /** 系统学生人数 */
  systemStudentCount: number
  /** Excel 文件名 */
  excelFileName?: string
  /** Excel 学生人数 */
  excelStudentCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  excelFileName: '',
  excelStudentCount: 0
})

const emit = defineEmits<{
  /** 来源切换 */
  change: [source: StudentSourceType]
  /** 请求上传 Excel 名单 */
  upload: []
}>()

/**
 * 处理下拉菜单命令，仅在具备对应数据时才切换来源
 * @param command - 菜单命令值（system / excel / upload）
 */
const handleCommand = (command: string | number | object): void => {
  if (command === 'system') {
    if (props.systemStudentCount > 0) emit('change', 'system')
    return
  }
  if (command === 'excel') {
    if (props.excelFileName) emit('change', 'excel')
    return
  }
  if (command === 'upload') emit('upload')
}
</script>

<template>
  <div class="student-source-selector">
    <span class="student-source-selector__caption">数据来源</span>
    <!-- 来源下拉菜单 -->
    <el-dropdown trigger="click" placement="bottom-start" @command="handleCommand">
      <button class="student-source-selector__trigger source-trigger" type="button">
        <span class="student-source-selector__icon" :class="{ 'is-excel': source === 'excel' }">
          <font-awesome-icon :icon="['solid', source === 'system' ? 'users' : 'file-excel']" />
        </span>
        <span class="student-source-selector__text">
          <strong>{{ source === 'system' ? '系统学生' : excelFileName || 'Excel 名单' }}</strong>
          <small>{{ source === 'system' ? systemStudentCount : excelStudentCount }} 人</small>
        </span>
        <font-awesome-icon
          class="student-source-selector__arrow"
          :icon="['solid', 'chevron-down']"
        />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="system" :disabled="systemStudentCount === 0">
            <font-awesome-icon :icon="['solid', 'users']" />
            <span>系统学生（{{ systemStudentCount }}）</span>
          </el-dropdown-item>
          <el-dropdown-item v-if="excelFileName" command="excel">
            <font-awesome-icon :icon="['solid', 'file-excel']" />
            <span>{{ excelFileName }}（{{ excelStudentCount }}）</span>
          </el-dropdown-item>
          <el-dropdown-item command="upload" :divided="Boolean(excelFileName)">
            <font-awesome-icon :icon="['solid', 'file-arrow-up']" />
            <span>{{ excelFileName ? '更换 Excel 文件' : '上传 Excel 名单' }}</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <!-- 右侧操作插槽 -->
    <div class="student-source-selector__actions"><slot name="actions" /></div>
  </div>
</template>

<style scoped lang="scss">
.student-source-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.student-source-selector__caption {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.student-source-selector__trigger {
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
}

.student-source-selector__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  color: var(--theme-primary);
  background: color-mix(in srgb, var(--theme-primary) 10%, #fff);
  border-radius: 7px;

  &.is-excel {
    color: #15803d;
    background: #ecfdf3;
  }
}

.student-source-selector__text {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  flex: 1;
  text-align: left;

  strong {
    max-width: 150px;
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: #94a3b8;
    font-size: 11px;
    white-space: nowrap;
  }
}

.student-source-selector__arrow {
  color: #94a3b8;
  font-size: 10px;
}

.student-source-selector__actions {
  margin-left: auto;
}

@media (max-width: 1220px) {
  .student-source-selector__caption {
    display: none;
  }
}
</style>
