<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { themeOptions } from '@/config/theme'
import type { ThemeName } from '@/config/theme'

/**
 * 主题色选择器。
 *
 * 以圆形色块展示所有可选主题，当前主题高亮并显示勾选图标，
 * 点击或键盘触发后调用主题 store 完成全局主题切换。
 */
const themeStore = useThemeStore()

/**
 * 切换当前主题
 * @param themeName - 目标主题名称
 */
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
        role="radio"
        :aria-checked="themeStore.currentTheme === option.name"
        :aria-label="option.label"
        tabindex="0"
        @click="handleThemeChange(option.name)"
        @keydown.enter.prevent="handleThemeChange(option.name)"
        @keydown.space.prevent="handleThemeChange(option.name)"
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
