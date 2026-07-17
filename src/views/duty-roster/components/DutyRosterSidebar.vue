<script setup lang="ts">
import type { DutyRosterType } from '@/types/DutyRoster'

defineProps<{
  rosters: DutyRosterType[]
  editingRosterId: string | null
  collapsed: boolean
}>()

const emit = defineEmits<{
  select: [rosterId: string]
  create: []
  copy: [rosterId: string]
  rename: [rosterId: string]
  remove: [rosterId: string]
  toggleCollapse: []
}>()

function handleCommand(command: string | number | object, rosterId: string): void {
  if (command === 'copy') emit('copy', rosterId)
  if (command === 'rename') emit('rename', rosterId)
  if (command === 'remove') emit('remove', rosterId)
}
</script>

<template>
  <aside class="duty-sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="duty-sidebar__heading">
      <strong v-if="!collapsed">值日表方案</strong>
      <el-button size="small" circle @click="emit('toggleCollapse')">
        <font-awesome-icon :icon="['solid', collapsed ? 'angles-right' : 'angles-left']" />
      </el-button>
    </div>

    <div class="duty-sidebar__list">
      <button
        v-for="roster in rosters"
        :key="roster.id"
        class="duty-sidebar__item"
        :class="{ 'is-active': roster.id === editingRosterId }"
        type="button"
        :title="roster.name"
        @click="emit('select', roster.id)"
      >
        <span class="duty-sidebar__dot"></span>
        <span v-if="!collapsed" class="duty-sidebar__item-name">{{ roster.name }}</span>
        <el-dropdown
          v-if="!collapsed"
          trigger="click"
          @command="handleCommand($event, roster.id)"
          @click.stop
        >
          <span class="duty-sidebar__more" @click.stop>
            <font-awesome-icon :icon="['solid', 'ellipsis']" />
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">重命名</el-dropdown-item>
              <el-dropdown-item command="copy">复制方案</el-dropdown-item>
              <el-dropdown-item command="remove" divided>删除方案</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </button>
    </div>

    <el-button class="duty-sidebar__create" type="primary" plain @click="emit('create')">
      <font-awesome-icon :icon="['solid', 'plus']" />
      <span v-if="!collapsed">新建值日表</span>
    </el-button>
  </aside>
</template>

<style scoped lang="scss">
.duty-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
  background: #fbfaff;
  border-right: 1px solid #eeeaf3;
}

.duty-sidebar__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  margin-bottom: 9px;
  color: #3a3047;
  font-size: 13px;
}

.duty-sidebar__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  overflow-y: auto;
}

.duty-sidebar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 0 9px;
  color: #665d72;
  background: transparent;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  text-align: left;
}

.duty-sidebar__item:hover,
.duty-sidebar__item.is-active {
  color: #6132b3;
  background: #f0e9fb;
}

.duty-sidebar__dot {
  width: 7px;
  height: 7px;
  flex: none;
  background: #b5a8c6;
  border-radius: 50%;
}

.is-active .duty-sidebar__dot {
  background: var(--theme-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-primary) 13%, transparent);
}

.duty-sidebar__item-name {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.duty-sidebar__more {
  padding: 4px;
  color: #8a8095;
}

.duty-sidebar__create {
  width: 100%;
  margin-top: 10px;
}

.duty-sidebar.is-collapsed {
  align-items: center;
  padding: 12px 8px;
}

.is-collapsed .duty-sidebar__heading {
  justify-content: center;
}

.is-collapsed .duty-sidebar__item {
  justify-content: center;
  padding: 0;
}
</style>
