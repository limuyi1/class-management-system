<script setup lang="ts">
defineProps<{
  x: number
  y: number
  canRemove: boolean
}>()

const emit = defineEmits<{
  add: []
  remove: []
}>()
</script>

<template>
  <div class="duty-context-menu" :style="{ left: `${x}px`, top: `${y}px` }" @click.stop>
    <button type="button" @click="emit('add')">
      <font-awesome-icon :icon="['solid', 'plus']" />
      新增一列
    </button>
    <button class="is-danger" type="button" :disabled="!canRemove" @click="emit('remove')">
      <font-awesome-icon :icon="['regular', 'trash-can']" />
      删除当前列
    </button>
  </div>
</template>

<style scoped lang="scss">
.duty-context-menu {
  position: fixed;
  z-index: 4000;
  width: 142px;
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

.duty-context-menu button.is-danger {
  color: #e84747;
}

.duty-context-menu button:disabled {
  color: #c9c4cd;
  cursor: not-allowed;
}
</style>
