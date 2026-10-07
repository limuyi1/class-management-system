<script setup lang="ts">
/** 管理页面通用分区，统一标题、说明与操作栏。 */
defineProps<{ title?: string; description?: string }>()
</script>
<template>
  <section class="management-card">
    <header v-if="title" class="management-card__header">
      <div>
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </div>
      <div class="management-card__actions"><slot name="actions" /></div>
    </header>
    <slot />
  </section>
</template>
<style scoped lang="scss">
.management-card {
  padding: 22px;
  margin-bottom: 16px;
  background: var(--surface-card);
  border: 1px solid var(--border-muted);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  min-width: 0;
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
  p {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-secondary);
  }
  &__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  :deep(.el-table) {
    --el-table-header-bg-color: var(--surface-page);
    border-radius: 8px;
  }
  :deep(.el-pagination) {
    margin-top: 20px;
    flex-wrap: wrap;
  }
  :deep(.el-form) {
    max-width: 720px;
  }
  :deep(.el-select) {
    min-width: 180px;
  }
  :deep(.el-alert) {
    margin-bottom: 16px;
  }
  @media (max-width: 760px) {
    padding: 16px;
  }
}
</style>
