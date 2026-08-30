<script setup lang="ts">
/** 座位学生右键菜单 — 快速切换职务或进入完整职务管理 */
import type { SeatingRoleDefinitionType } from '@/types/SeatingChart'

defineProps<{
  x: number
  y: number
  studentName: string
  roles: SeatingRoleDefinitionType[]
  assignedRoleIds: string[]
}>()

const emit = defineEmits<{
  toggleRole: [roleId: string]
  manage: []
}>()
</script>

<template>
  <div class="seating-student-menu" :style="{ left: `${x}px`, top: `${y}px` }" @click.stop>
    <div class="seating-student-menu__heading">
      <strong>{{ studentName }}</strong>
      <small>职务标注</small>
    </div>
    <div v-if="roles.length" class="seating-student-menu__roles">
      <button
        v-for="role in roles"
        :key="role.id"
        type="button"
        :class="{ active: assignedRoleIds.includes(role.id) }"
        @click="emit('toggleRole', role.id)"
      >
        <i :style="{ backgroundColor: role.color }"></i>
        <span>{{ [role.subject, role.groupName, role.title].filter(Boolean).join(' · ') }}</span>
        <font-awesome-icon v-if="assignedRoleIds.includes(role.id)" :icon="['solid', 'check']" />
      </button>
    </div>
    <p v-else>暂无职务，请先创建。</p>
    <button class="seating-student-menu__manage" type="button" @click="emit('manage')">
      <font-awesome-icon :icon="['solid', 'gear']" />
      管理全部职务
    </button>
  </div>
</template>

<style scoped lang="scss">
.seating-student-menu {
  position: fixed;
  z-index: 4000;
  width: 224px;
  padding: 6px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4dee9;
  border-radius: 9px;
  box-shadow: 0 12px 28px rgba(43, 30, 59, 0.16);
}

.seating-student-menu__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px;
  border-bottom: 1px solid #eee9f2;
}

.seating-student-menu__heading strong {
  overflow: hidden;
  color: #342b3f;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seating-student-menu__heading small,
.seating-student-menu p {
  color: #9a91a3;
  font-size: 10px;
}

.seating-student-menu__roles {
  max-height: 270px;
  padding: 4px 0;
  overflow-y: auto;
}

.seating-student-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 5px 9px;
  color: #4e4558;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  text-align: left;
}

.seating-student-menu button:hover,
.seating-student-menu button.active {
  background: #f6f2fb;
}

.seating-student-menu button i {
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
}

.seating-student-menu button span {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seating-student-menu button svg {
  color: var(--theme-primary);
}

.seating-student-menu p {
  margin: 0;
  padding: 16px 9px;
  text-align: center;
}

.seating-student-menu__manage {
  border-top: 1px solid #eee9f2 !important;
  border-radius: 0 0 6px 6px !important;
}
</style>
