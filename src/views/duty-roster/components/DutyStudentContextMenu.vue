<script setup lang="ts">
/** 学生右键菜单 — 根据卡片所在位置提供复制、删除或移除操作 */
defineProps<{
  x: number
  y: number
  location: 'pending' | 'assigned'
  canDelete?: boolean
  isLeader?: boolean
}>()

const emit = defineEmits<{
  copy: []
  delete: []
  toggleLeader: []
  remove: []
}>()
</script>

<template>
  <div class="duty-context-menu" :style="{ left: `${x}px`, top: `${y}px` }" @click.stop>
    <button type="button" @click="emit('copy')">
      <font-awesome-icon :icon="['regular', 'copy']" />
      复制
    </button>
    <button
      v-if="location === 'pending'"
      class="is-danger"
      type="button"
      :disabled="!canDelete"
      @click="emit('delete')"
    >
      <font-awesome-icon :icon="['regular', 'trash-can']" />
      删除
    </button>
    <template v-else>
      <button type="button" @click="emit('toggleLeader')">
        <font-awesome-icon :icon="['solid', 'user-check']" />
        {{ isLeader ? '取消组长' : '设为组长' }}
      </button>
      <button class="is-danger" type="button" @click="emit('remove')">
        <font-awesome-icon :icon="['solid', 'user-minus']" />
        移除
      </button>
    </template>
  </div>
</template>

<style scoped lang="scss">
.duty-context-menu {
  position: fixed;
  z-index: 4000;
  width: 148px;
  padding: 5px;
  background: #fff;
  border: 1px solid #e4dee9;
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(43, 30, 59, 0.16);
}

.duty-context-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 35px;
  padding: 0 10px;
  color: #3f4658;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.duty-context-menu button:hover {
  background: #f7f4fb;
}

.duty-context-menu button:disabled {
  color: #bbb4bf;
  cursor: not-allowed;
}

.duty-context-menu button:disabled:hover {
  background: transparent;
}

.duty-context-menu button.is-danger {
  color: #e84747;
}
</style>
