<script setup lang="ts">
/**
 * 导入/导出/清空等长耗时操作的进度提示弹窗。
 * 通过 `visible` 与父组件双向绑定，处理期间禁止关闭页面。
 */
import { ref, watch } from 'vue'

/** 组件入参：弹窗显隐、标题与进度百分比 */
interface Props {
  visible: boolean
  title?: string
  percent?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: '正在处理...',
  percent: 0
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const dialogVisible = ref(props.visible) // 内部弹窗显隐状态

// 父组件显隐状态变化时同步到内部弹窗，保持受控
watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
  }
)

// 内部弹窗关闭时回传状态，实现 v-model:visible
watch(dialogVisible, (val) => {
  emit('update:visible', val)
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="title"
    width="300px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    align-center
    destroy-on-close
  >
    <!-- 进度条与禁止关闭提示 -->
    <div class="progress-content">
      <el-progress
        :percentage="percent"
        :stroke-width="10"
        :status="percent === 100 ? 'success' : undefined"
      />
      <p class="progress-tip">请勿关闭页面</p>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.progress-content {
  padding: 16px 0;

  .progress-tip {
    margin-top: 16px;
    text-align: center;
    font-size: 13px;
    color: #999;
  }
}
</style>
