<script setup lang="ts">
interface Props {
  icon: string[]
  title: string
  subtitle: string
}
defineProps<Props>()
</script>

<template>
  <div class="page-header">
    <div class="header-icon">
      <font-awesome-icon :icon="icon" />
    </div>
    <div class="header-text">
      <h2>{{ title }}</h2>
      <p>{{ subtitle }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 16px 20px;
  background: var(--theme-gradient);
  border-radius: 12px;
  color: #fff;

  .header-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    font-size: 22px;
  }

  .header-text {
    h2 {
      margin: 0 0 2px 0;
      font-size: 18px;
      font-weight: 600;
    }

    p {
      margin: 0;
      font-size: 13px;
      opacity: 0.85;
    }
  }
}
</style>
