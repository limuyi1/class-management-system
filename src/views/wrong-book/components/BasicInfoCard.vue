<script setup lang="ts">
/** 基本信息卡片 — 编辑错题的所属文件夹、题型、来源与难度 */
import { ElCard, ElFormItem, ElSelect, ElOption, ElSlider, ElInput } from 'element-plus'
import type { WrongFolder } from '@/types/WrongBook'

/** 题型选项结构 */
interface QuestionType {
  value: string
  label: string
}

/** 基本信息表单数据结构 */
interface FormData {
  folderId: string
  questionType: string
  source: string
  difficulty: number
}

interface Props {
  form: FormData
  folders: WrongFolder[]
  questionTypes: QuestionType[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:form': [value: FormData]
}>()

/** 难度等级滑块刻度标签 */
const marks = {
  1: '简单',
  2: '较简单',
  3: '一般',
  4: '较难',
  5: '困难'
}

/**
 * 更新表单单个字段并向上层抛出更新事件
 * @param field - 要更新的字段名
 * @param value - 字段新值
 */
const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
  emit('update:form', { ...props.form, [field]: value })
}
</script>

<template>
  <el-card class="form-card" shadow="never">
    <template #header>
      <div class="card-header">
        <span class="card-title">基本信息</span>
      </div>
    </template>
    <div class="form-row">
      <el-form-item label="所属文件夹" class="flex-1">
        <el-select
          :model-value="form.folderId"
          placeholder="选择文件夹"
          style="width: 100%"
          @update:model-value="(val) => updateField('folderId', val)"
        >
          <el-option
            v-for="folder in folders"
            :key="folder.id"
            :label="folder.name"
            :value="folder.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="题型" class="flex-1">
        <el-select
          :model-value="form.questionType"
          placeholder="选择题型"
          style="width: 100%"
          @update:model-value="(val) => updateField('questionType', val)"
        >
          <el-option
            v-for="type in questionTypes"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="来源" class="flex-1">
        <el-input
          :model-value="form.source"
          placeholder="如：2024年期末考试"
          @update:model-value="(val) => updateField('source', val)"
        />
      </el-form-item>
    </div>
    <el-form-item label="难度">
      <div class="difficulty-slider">
        <el-slider
          :model-value="form.difficulty"
          :min="1"
          :max="5"
          :marks="marks"
          :step="1"
          @update:model-value="(val) => updateField('difficulty', val as number)"
        />
      </div>
    </el-form-item>
  </el-card>
</template>

<style scoped lang="scss">
.form-card {
  margin-bottom: 16px;
  border-radius: 8px;

  &:last-child {
    margin-bottom: 0;
  }

  :deep(.el-card__header) {
    padding: 12px 16px;
    background: #f5f7fa;
    border-bottom: 1px solid #ebeef5;
  }

  :deep(.el-card__body) {
    padding: 16px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .card-title {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
  }
}

.form-row {
  display: flex;
  gap: 16px;

  .flex-1 {
    flex: 1;
  }
}

.difficulty-slider {
  width: 100%;
  padding: 0 10px;
  margin-bottom: 8px;
}
</style>
