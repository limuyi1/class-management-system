<script setup lang="ts">
import { ref, watch } from 'vue'

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

const dialogVisible = ref(props.visible)

watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val
  }
)

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
