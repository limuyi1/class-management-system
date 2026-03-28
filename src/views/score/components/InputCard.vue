<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { match } from 'pinyin-pro'
import { storeToRefs } from 'pinia'

import { useEnterUp } from '@/hooks/useEnterUp'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'

import { InputEnum } from '@/types/Common'

interface Props {
  type?: InputEnum
}
const props = withDefaults(defineProps<Props>(), {
  type: InputEnum.SCORE
})

const emit = defineEmits(['scroll'])

const store = useDataSourceStore()
const { data: originList } = storeToRefs(store)
const configuration = useConfigurationStore()
const { data: config } = storeToRefs(configuration)

const options = ref<any[]>([])
const nameInputRef = ref()
const scoreInputRef = ref()
const commentInputRef = ref()
const formData = reactive({
  id: null as number | null,
  name: '',
  score: null as number | null,
  comment: null as string | null
})

const currentSelectedIndex = ref<number | null>(null)

onMounted(() => {
  autoFocus()
})

const autoFocus = () => {
  nameInputRef.value.focus()
}

const remoteMethod = (query: string) => {
  if (query) {
    options.value = originList.value.filter(
      (item: any) => item.xing4_ming2.includes(query) || match(item.xing4_ming2, query)?.length
    )
  } else {
    options.value = []
  }
}

const selectChange = (index: number) => {
  currentSelectedIndex.value = index
}

useEnterUp('stuName', () => {
  if (!currentSelectedIndex.value) return
  const index = currentSelectedIndex.value
  const item = originList.value[index - 1]

  formData.id = index
  formData.name = item.xing4_ming2
  formData.score = config.value.inputScoreTab ? item[config.value.inputScoreTab] : null
  formData.comment = item.comment || null

  emit('scroll', index)

  scoreInputRef.value?.focus()
  commentInputRef.value?.focus()
})

/**
 * 提交方法
 */
const onSubmit = () => {
  if (!formData.id) return

  const item = originList.value[formData.id - 1]

  // 设置分数
  if (props.type === InputEnum.SCORE && config.value.inputScoreTab) {
    item[config.value.inputScoreTab] = formData.score
  }

  // 设置评语
  if (props.type === InputEnum.COMMENT) {
    item.comment = formData.comment === '' ? null : formData.comment
  }

  // 删除已选中的选项
  formData.id = null
  formData.name = ''
  formData.score = null
  formData.comment = null
  options.value = []

  // 重新聚焦到姓名输入框
  nameInputRef.value.focus()
}

/**
 * 编辑数据
 * @param data
 */
const editData = (data: any) => {
  remoteMethod(data.xing4_ming2)

  // 找到对应的行号
  const rowIndex = originList.value.findIndex((item: any) => item === data)

  formData.id = rowIndex + 1
  formData.name = data.xing4_ming2
  formData.score = config.value.inputScoreTab ? data[config.value.inputScoreTab] : null
  formData.comment = data.comment || null

  // 重新聚焦到分数输入框
  scoreInputRef.value?.focus()
}

defineExpose({ editData, autoFocus })
</script>

<template>
  <div class="input-card">
    <div class="card-header">
      <font-awesome-icon :icon="['solid', 'pen-to-square']" />
      <span>{{ props.type === InputEnum.SCORE ? '输入分数' : '填写评语' }}</span>
    </div>
    <div class="card-body">
      <el-form ref="form" label-position="top" :model="formData">
        <el-form-item label="学生姓名">
          <el-select
            ref="nameInputRef"
            name="stuName"
            style="width: 100%"
            v-model="formData.id"
            size="default"
            placeholder="搜索学生姓名..."
            filterable
            remote
            :remote-method="remoteMethod"
            @change="selectChange"
          >
            <el-option
              v-for="(item, index) in options"
              :key="index"
              :label="item.xing4_ming2"
              :value="originList.indexOf(item) + 1"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="props.type === InputEnum.SCORE" label="考试成绩">
          <el-input-number
            ref="scoreInputRef"
            style="width: 100%"
            v-model.number="formData.score"
            size="default"
            :min="0"
            :max="100"
            :precision="1"
            :disabled="!formData.id"
            placeholder="0~100分"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item v-if="props.type === InputEnum.COMMENT" label="学生评语">
          <el-input
            ref="commentInputRef"
            style="width: 100%"
            v-model.trim="formData.comment"
            size="default"
            type="textarea"
            maxlength="500"
            show-word-limit
            placeholder="请输入对学生的评价..."
            :rows="3"
            :disabled="!formData.id"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            class="submit-btn"
            style="width: 100%"
            type="primary"
            size="default"
            round
            :disabled="!formData.id"
            @click="onSubmit"
          >
            <font-awesome-icon :icon="['solid', 'paper-plane']" />
            提 交
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.input-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  .card-body {
    padding: 10px 12px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--theme-gradient);
  color: #fff;
  font-size: 13px;
  font-weight: 600;

  svg {
    font-size: 14px;
  }
}

.submit-btn {
  height: 36px;
  font-size: 14px;
  background: var(--theme-gradient);
  border: none;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: #cbd5e1;
  }
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #64748b;
  font-size: 12px;
}

:deep(.el-form-item) {
  margin-bottom: 10px;
}

:deep(.el-select__wrapper),
:deep(.el-input-number) {
  border-radius: 6px;
}

:deep(.el-textarea__inner) {
  border-radius: 6px;
}
</style>
