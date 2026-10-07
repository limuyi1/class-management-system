<script setup lang="ts">
/** 外部名单学生新增表单：校验姓名并提示同名情况 */
import { computed, shallowRef } from 'vue'

interface Props {
  /** 当前名单中的全部姓名，用于同名提示 */
  existingNames: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 提交规范化后的学生姓名 */
  submit: [name: string]
}>()

/** 待添加的学生姓名 */
const name = shallowRef('')
/** 去除首尾空格后的姓名 */
const normalizedName = computed(() => name.value.trim())
/** 当前名单是否已有同名学生 */
const hasDuplicateName = computed(() =>
  props.existingNames.some((item) => item.trim() === normalizedName.value)
)

/** 提交姓名并清空输入框 */
function submitStudent(): void {
  if (!normalizedName.value) return
  emit('submit', normalizedName.value)
  name.value = ''
}
</script>

<template>
  <form class="excel-student-add-form" @submit.prevent="submitStudent">
    <div class="excel-student-add-form__field">
      <el-input v-model="name" maxlength="50" placeholder="输入学生姓名" clearable />
      <el-button type="primary" native-type="submit" :disabled="!normalizedName">
        <font-awesome-icon :icon="['solid', 'plus']" />
        添加
      </el-button>
    </div>
    <p v-if="normalizedName && hasDuplicateName" class="excel-student-add-form__warning">
      名单中已有同名学生，仍可继续添加，系统会使用不同 ID 区分。
    </p>
  </form>
</template>

<style scoped lang="scss">
.excel-student-add-form {
  display: grid;
  gap: 8px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.excel-student-add-form__field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.excel-student-add-form__warning {
  margin: 0;
  color: #b45309;
  font-size: 12px;
  line-height: 1.5;
}
</style>
