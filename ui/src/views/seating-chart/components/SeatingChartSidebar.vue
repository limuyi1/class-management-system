<script setup lang="ts">
/** 座位方案列表：展示当前方案并转发选择、复制、重命名和删除操作。 */
import type { SeatingChartType } from '@/types/SeatingChart'

defineProps<{ charts: SeatingChartType[]; activeChartId?: string; collapsed: boolean }>()

const emit = defineEmits<{
  toggleCollapsed: []
  select: [chartId: string]
  copy: [chartId: string]
  rename: [chartId: string]
  delete: [chartId: string]
  create: []
}>()
</script>

<template>
  <aside class="chart-sidebar">
    <div class="sidebar-heading">
      <strong v-show="!collapsed">座位方案</strong
      ><el-button text circle @click="emit('toggleCollapsed')"
        ><font-awesome-icon :icon="['solid', collapsed ? 'angles-right' : 'angles-left']"
      /></el-button>
    </div>
    <el-scrollbar class="app-scroll-region app-scroll-region--fill" height="100%"
      ><div class="chart-list">
        <el-tooltip
          v-for="chart in charts"
          :key="chart.id"
          :content="chart.name"
          placement="right"
          :disabled="!collapsed"
          ><button
            class="chart-item"
            :class="{ active: chart.id === activeChartId }"
            @click="emit('select', chart.id)"
          >
            <span class="chart-item__dot"></span
            ><span v-show="!collapsed" class="chart-item__name">{{ chart.name }}</span
            ><el-dropdown
              v-if="!collapsed"
              trigger="click"
              @command="
                (command: string) => {
                  if (command === 'copy') emit('copy', chart.id)
                  if (command === 'rename') emit('rename', chart.id)
                  if (command === 'delete') emit('delete', chart.id)
                }
              "
              ><span class="chart-item__more" @click.stop
                ><font-awesome-icon :icon="['solid', 'ellipsis']" /></span
              ><template #dropdown
                ><el-dropdown-menu
                  ><el-dropdown-item command="copy">复制</el-dropdown-item
                  ><el-dropdown-item command="rename">重命名</el-dropdown-item
                  ><el-dropdown-item command="delete" divided
                    >删除</el-dropdown-item
                  ></el-dropdown-menu
                ></template
              ></el-dropdown
            >
          </button></el-tooltip
        >
      </div></el-scrollbar
    >
    <el-button
      v-if="activeChartId"
      class="create-chart"
      :circle="collapsed"
      type="primary"
      plain
      @click="emit('create')"
      ><font-awesome-icon :icon="['solid', 'plus']" /><span v-show="!collapsed"
        >新建座位表</span
      ></el-button
    >
  </aside>
</template>

<style scoped lang="scss">
.chart-sidebar {
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #fbfaff;
  border-right: 1px solid #eeeaf3;
}
.sidebar-heading {
  display: flex;
  align-items: center;
}
.sidebar-heading {
  justify-content: space-between;
  margin-bottom: 10px;
}
.chart-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow: visible;
}
.chart-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 8px;
  border: 0;
  border-radius: 9px;
  color: #625b70;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.chart-item:hover,
.chart-item.active {
  color: #6232b8;
  background: #f0e8ff;
}
.chart-item__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b7a9cf;
}
.active .chart-item__dot {
  background: #7c3aed;
}
.chart-item__name {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chart-item__more {
  padding: 2px 5px;
  color: #81768f;
}
.create-chart {
  justify-content: center;
  margin-top: 12px;
}
.chart-sidebar {
  min-height: 0;
}
.chart-item__name {
  font-size: 13px;
}
</style>
