<script setup lang="ts">
/** 座位表备注面板 — 展示整表说明并触发编辑 */
import { computed } from 'vue'

const props = defineProps<{ notes: string }>()
const emit = defineEmits<{ edit: [] }>()

const noteLines = computed(() => props.notes.split('\n').filter((line) => line.trim()))
</script>

<template>
  <section class="seating-notes">
    <div class="seating-notes__heading">
      <strong>备注说明</strong>
      <el-button size="small" text @click="emit('edit')">
        <font-awesome-icon :icon="['regular', 'file-lines']" />
        {{ noteLines.length ? '编辑' : '添加备注' }}
      </el-button>
    </div>
    <div class="seating-notes__content">
      <span v-if="noteLines.length">{{ noteLines.join(' · ') }}</span>
      <span v-else class="seating-notes__empty">暂无备注说明</span>
    </div>
  </section>
</template>

<style scoped lang="scss">
.seating-notes {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 4px 14px;
  background: linear-gradient(90deg, #fff, #fcfbff);
  border-top: 1px solid #e8e2ed;
}

.seating-notes__heading {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
}

.seating-notes__heading strong {
  color: #4c4258;
  font-size: 12px;
}

.seating-notes__content {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  color: #696071;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seating-notes__empty {
  color: #aaa2b1;
}
</style>
