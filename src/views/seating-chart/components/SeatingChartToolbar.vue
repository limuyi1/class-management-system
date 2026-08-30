<script setup lang="ts">
/** 座位表工具栏 — 展示已安排状态并编排布局、随机排座与导出等操作 */
/** 座位表工具栏 props：图表名称、安排统计与全屏状态 */
interface SeatingChartToolbarPropsType {
  /** 座位表名称 */
  chartName: string
  /** 已安排学生数 */
  assignedCount: number
  /** 座位总容量 */
  seatCapacity: number
  /** 是否全屏显示 */
  fullscreen: boolean
}

/** 布局下拉菜单的命令类型 */
type LayoutCommandType = 'layout' | 'aisles' | 'special-seats'

defineProps<SeatingChartToolbarPropsType>()

/**
 * 座位表工具栏只负责公共的操作编排，不直接修改座位表数据。
 * 页面通过明确的事件处理布局弹窗、随机排座和导出等具体业务。
 */
const emit = defineEmits<{
  openLayout: []
  openAisles: []
  openSpecialSeats: []
  manageRoles: []
  randomize: []
  export: []
  toggleFullscreen: []
}>()

/** 将布局下拉菜单的命令转换为语义明确的页面事件。 */
function handleLayoutCommand(command: LayoutCommandType): void {
  if (command === 'layout') emit('openLayout')
  if (command === 'aisles') emit('openAisles')
  if (command === 'special-seats') emit('openSpecialSeats')
}
</script>

<template>
  <div class="seating-toolbar">
    <!-- 左侧：座位表名称与安排进度 -->
    <div class="seating-toolbar__summary">
      <strong class="seating-toolbar__title">{{ chartName }}</strong>
      <span class="seating-toolbar__status">已安排 {{ assignedCount }} / {{ seatCapacity }}</span>
    </div>

    <!-- 右侧：布局、随机排座、导出与全屏操作 -->
    <div class="seating-toolbar__actions">
      <el-dropdown trigger="click" @command="handleLayoutCommand">
        <el-button size="small">
          <font-awesome-icon :icon="['solid', 'table-cells']" />
          布局设置
          <font-awesome-icon class="seating-toolbar__chevron" :icon="['solid', 'chevron-down']" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="layout">行列与列号设置</el-dropdown-item>
            <el-dropdown-item command="aisles">过道设置</el-dropdown-item>
            <el-dropdown-item command="special-seats">
              <font-awesome-icon :icon="['solid', 'crown']" />
              雅座设置
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <span class="seating-toolbar__divider" aria-hidden="true"></span>

      <el-button size="small" @click="emit('manageRoles')">
        <font-awesome-icon :icon="['solid', 'user-tag']" />
        职务管理
      </el-button>

      <el-button size="small" type="primary" @click="emit('randomize')">
        <font-awesome-icon :icon="['solid', 'shuffle']" />
        随机安排
      </el-button>
      <el-button size="small" @click="emit('export')">
        <font-awesome-icon :icon="['solid', 'file-export']" />
        导出
      </el-button>
      <el-tooltip :content="fullscreen ? '退出全屏' : '全屏'" placement="bottom">
        <el-button
          size="small"
          circle
          :aria-label="fullscreen ? '退出全屏' : '全屏'"
          @click="emit('toggleFullscreen')"
        >
          <font-awesome-icon :icon="['solid', fullscreen ? 'compress' : 'expand']" />
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.seating-toolbar,
.seating-toolbar__summary,
.seating-toolbar__actions {
  display: flex;
  align-items: center;
}

.seating-toolbar {
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  height: 48px;
  padding: 0 14px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid #eeeaf3;
  scrollbar-width: none;
}

.seating-toolbar::-webkit-scrollbar {
  display: none;
}

.seating-toolbar__actions {
  flex: 0 0 auto;
  white-space: nowrap;
}

.seating-toolbar__summary {
  min-width: 0;
  overflow: hidden;
  flex: 1 1 auto;
  white-space: nowrap;
}

.seating-toolbar__title {
  overflow: hidden;
  color: #2d233d;
  font-size: 16px;
  text-overflow: ellipsis;
}

.seating-toolbar__status {
  margin-left: 9px;
  color: #8a8295;
  font-size: 12px;
}

.seating-toolbar__actions {
  justify-content: flex-end;
  gap: 6px;
}

.seating-toolbar__actions :deep(.el-button) {
  flex-shrink: 0;
  margin-left: 0;
}

.seating-toolbar__chevron {
  margin-left: 2px;
  font-size: 10px;
}

.seating-toolbar__divider {
  width: 1px;
  height: 18px;
  margin: 0 1px;
  background: #e8e2ee;
}
</style>
