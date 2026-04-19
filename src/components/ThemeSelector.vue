<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { themeOptions } from '@/config/theme'
import type { ThemeName } from '@/config/theme'

const themeStore = useThemeStore()

const handleThemeChange = (themeName: ThemeName) => {
  themeStore.setTheme(themeName)
}
</script>

<template>
  <div class="theme-selector">
    <el-tooltip
      v-for="option in themeOptions"
      :key="option.name"
      :content="option.label"
      placement="bottom"
    >
      <div
        class="theme-option"
        :class="{ active: themeStore.currentTheme === option.name }"
        :style="{ backgroundColor: option.color }"
        @click="handleThemeChange(option.name)"
      >
        <font-awesome-icon
          v-if="themeStore.currentTheme === option.name"
          :icon="['solid', 'check']"
          class="check-icon"
        />
      </div>
    </el-tooltip>
  </div>
</template>

<style scoped lang="scss">
.theme-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 2px solid transparent;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  &.active {
    border-color: #fff;
    transform: scale(1.15);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  }

  .check-icon {
    color: #fff;
    font-size: 12px;
  }
}
</style>
