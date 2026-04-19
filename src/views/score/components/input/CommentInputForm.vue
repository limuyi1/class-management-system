<script setup lang="ts">
import { computed, ref } from 'vue'

import type { TagCategoryType } from '@/types/Setting'

interface Props {
  modelValue: string | null
  disabled: boolean
  currentStudentTags: Record<string, string[]> | null
  hasAnyTags: boolean
  tagCategoryList: TagCategoryType[]
  generating: boolean
  canGenerate: boolean
}

interface Emits {
  (event: 'update:modelValue', value: string | null): void
  (event: 'go-edit-tags'): void
  (event: 'generate-comment'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const commentInputRef = ref<{ focus: () => void } | null>(null)

const activeCategories = computed(() => {
  const tags = props.currentStudentTags
  if (!tags) return []
  return props.tagCategoryList.filter((category) => tags[category.prop]?.length)
})

const focus = () => {
  commentInputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <el-form-item v-if="currentStudentTags" label="学生标签">
    <div v-if="hasAnyTags" class="student-tags" @click="emit('go-edit-tags')">
      <div v-for="cat in activeCategories" :key="cat.prop" class="tag-category">
        <span class="category-label">{{ cat.label }}：</span>
        <el-tag
          v-for="tag in currentStudentTags?.[cat.prop] || []"
          :key="tag"
          size="small"
          type="success"
          class="student-tag"
        >
          {{ tag }}
        </el-tag>
      </div>
    </div>
    <div v-else class="empty-tags-tip" @click="emit('go-edit-tags')">
      <font-awesome-icon :icon="['fas', 'exclamation-circle']" />
      <span>暂无标签，点击添加</span>
    </div>
  </el-form-item>

  <el-form-item label="学生评语">
    <el-input
      ref="commentInputRef"
      style="width: 100%"
      :model-value="modelValue"
      size="default"
      type="textarea"
      maxlength="160"
      show-word-limit
      placeholder="请输入对学生的评价..."
      :rows="3"
      :disabled="disabled"
      @update:model-value="(value: unknown) => emit('update:modelValue', value as string | null)"
    />
  </el-form-item>

  <el-form-item>
    <el-tooltip
      :disabled="disabled || hasAnyTags"
      :content="!disabled && !hasAnyTags ? '该学生暂无标签，请先在设置页面添加标签' : ''"
      placement="top"
    >
      <div style="width: 100%">
        <el-button
          class="ai-generate-btn"
          style="width: 100%"
          size="default"
          round
          :disabled="!canGenerate"
          :loading="generating"
          @click="emit('generate-comment')"
        >
          <template #icon><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']" /></template>
          AI 生成评语
        </el-button>
      </div>
    </el-tooltip>
  </el-form-item>
</template>

<style scoped lang="scss">
.student-tags {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  border-radius: 6px;
  padding: 6px;
  gap: 2px;
  cursor: pointer;

  .tag-category {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
    font-size: 12px;

    .category-label {
      line-height: 20px;
      color: #64748b;
      font-weight: 500;
      min-width: 42px;
    }

    .student-tag {
      margin-right: 0;
    }
  }
}

.empty-tags-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #fef3c7;
  border: 1px dashed #f59e0b;
  border-radius: 6px;
  color: #d97706;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #fde68a;
    border-color: #f59e0b;
  }

  svg {
    font-size: 14px;
  }
}

.ai-generate-btn {
  height: 36px;
  font-size: 14px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border: none;
  color: #fff;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: #cbd5e1;
    color: #94a3b8;
  }

  svg {
    margin-right: 4px;
  }
}
</style>
