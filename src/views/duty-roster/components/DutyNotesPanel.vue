<script setup lang="ts">
/** 备注说明面板 — 按行展示值日表备注并触发编辑 */
import { computed } from 'vue'

const props = defineProps<{ notes: string }>()
const emit = defineEmits<{ edit: [] }>()

/** 过滤掉空行的备注说明 */
const noteLines = computed(() => props.notes.split('\n').filter((line) => line.trim()))
</script>

<template>
  <section class="duty-notes">
    <div class="duty-notes__heading">
      <strong>备注说明</strong>
      <el-button size="small" @click="emit('edit')">
        <font-awesome-icon :icon="['regular', 'file-lines']" />
        编辑说明
      </el-button>
    </div>
    <div class="duty-notes__content">
      <p v-for="(line, index) in noteLines" :key="`${index}-${line}`">{{ line }}</p>
      <p v-if="!noteLines.length" class="duty-notes__empty">暂无备注说明</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.duty-notes {
  padding: 12px 15px 14px;
  background: linear-gradient(90deg, #fff, #fcfbff);
  border: 1px solid #e6e0ed;
  border-left: 2px solid var(--theme-primary);
  border-radius: 8px;
}

.duty-notes__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 5px;
}

.duty-notes__heading strong {
  color: #263149;
  font-size: 14px;
}

.duty-notes__content {
  color: #5b6378;
  font-size: 11px;
  line-height: 1.55;
}

.duty-notes__content p {
  margin: 2px 0;
}

.duty-notes__empty {
  color: #a39baa;
}
</style>
