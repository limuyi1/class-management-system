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
  showGenerateButton?: boolean
}

interface Emits {
  (event: 'update:modelValue', value: string | null): void
  (event: 'go-edit-tags'): void
  (event: 'generate-comment'): void
}

const props = withDefaults(defineProps<Props>(), {
  showGenerateButton: true
})
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
  <div v-if="currentStudentTags" class="tag-panel">
    <div class="tag-panel__header">
      <span class="tag-panel__title">学生标签</span>
      <el-button link type="primary" class="tag-panel__edit" @click="emit('go-edit-tags')">
        查看/编辑
      </el-button>
    </div>

    <div v-if="hasAnyTags" class="student-tags" @click="emit('go-edit-tags')">
      <div v-for="cat in activeCategories" :key="cat.prop" class="tag-category">
        <div class="category-label">{{ cat.label }}</div>
        <div class="category-tags">
          <el-tag
            v-for="tag in currentStudentTags?.[cat.prop] || []"
            :key="tag"
            size="small"
            type="success"
            class="student-tag"
            disable-transitions
          >
            {{ tag }}
          </el-tag>
        </div>
      </div>
    </div>
    <div v-else class="empty-tags-tip" @click="emit('go-edit-tags')">
      <font-awesome-icon :icon="['fas', 'exclamation-circle']" />
      <span>暂无标签，点击添加</span>
    </div>
  </div>

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

  <el-form-item v-if="showGenerateButton">
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
.tag-panel {
  margin-bottom: 14px;
}

.tag-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tag-panel__title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.tag-panel__edit {
  padding: 0;
  min-height: auto;
  font-size: 12px;
}

.student-tags {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e7edf5;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(255, 255, 255, 1) 100%);
  cursor: pointer;

  .tag-category {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: start;
    gap: 8px;
    font-size: 12px;

    .category-label {
      padding-top: 2px;
      color: #64748b;
      font-weight: 500;
      letter-spacing: 0.02em;
    }

    .category-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
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
  padding: 10px 12px;
  background: #fff8e8;
  border: 1px dashed #f7b955;
  border-radius: 10px;
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
