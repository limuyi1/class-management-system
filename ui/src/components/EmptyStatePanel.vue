<script setup lang="ts">
import { computed } from 'vue'

/**
 * 空状态面板组件。
 *
 * 当列表或区域暂无数据时，用于展示图标、标题、说明文案与可选的主操作按钮。
 */
interface Props {
  /** FontAwesome solid 图标名 */
  icon: string
  /** 空态主标题 */
  title: string
  /** 空态说明文案 */
  description: string
  /** 可选主操作按钮文案，不传则不展示按钮 */
  actionText?: string
  /** 由使用方按所在布局控制最小高度 */
  minHeight?: string
  /** 说明文案最大宽度 */
  descriptionMaxWidth?: string
}

const props = withDefaults(defineProps<Props>(), {
  actionText: '',
  minHeight: '0',
  descriptionMaxWidth: '360px'
})

const emit = defineEmits<{
  /** 点击主操作按钮 */
  action: []
}>()

/** 面板整体样式：由父级控制最小高度 */
const panelStyle = computed(() => ({
  minHeight: props.minHeight
}))

/** 说明文案样式：通过 CSS 变量控制最大宽度 */
const descriptionStyle = computed(() => ({
  '--empty-state-description-max-width': props.descriptionMaxWidth
}))
</script>

<template>
  <div class="empty-state-panel" :style="panelStyle">
    <!-- 空态图标 -->
    <div class="empty-state-panel__icon">
      <font-awesome-icon :icon="['solid', icon]" />
    </div>
    <!-- 标题与说明 -->
    <div class="empty-state-panel__title">{{ title }}</div>
    <div class="empty-state-panel__description" :style="descriptionStyle">
      {{ description }}
    </div>
    <!-- 可选主操作按钮 -->
    <el-button v-if="actionText" type="primary" plain @click="emit('action')">
      {{ actionText }}
    </el-button>
  </div>
</template>

<style scoped lang="scss">
.empty-state-panel {
  flex: 1;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 28px;
  text-align: center;
  border: 1px solid #dbe5f0;
  border-radius: 12px;
  background: #f8fafc;
}

.empty-state-panel__icon {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--theme-primary);
  background: var(--theme-menu-active-bg);
  font-size: 20px;
}

.empty-state-panel__title {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.empty-state-panel__description {
  max-width: var(--empty-state-description-max-width);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
}
</style>
