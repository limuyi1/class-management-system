<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  countCommentLength,
  getCommentLengthError
} from '@/utils/evaluation/commentLengthUtil'

import type { TagCategoryType } from '@/types/Setting'

interface Props {
  modelValue: string | null
  disabled: boolean
  currentStudentTags: Record<string, string[]> | null
  hasAnyTags: boolean
  tagCategoryList: TagCategoryType[]
  allowTagEditing?: boolean
}

interface Emits {
  (event: 'update:modelValue', value: string | null): void
  (event: 'go-edit-tags'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const commentInputRef = ref<{ focus: () => void } | null>(null)

const commentLength = computed(() => countCommentLength(props.modelValue))
const commentLengthError = computed(() => getCommentLengthError(props.modelValue))

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
      <el-button
        v-if="allowTagEditing !== false"
        link
        type="primary"
        class="tag-panel__edit"
        @click="emit('go-edit-tags')"
      >
        查看/编辑
      </el-button>
    </div>

    <div
      v-if="hasAnyTags"
      class="student-tags"
      :class="{ 'is-readonly': allowTagEditing === false }"
      @click="allowTagEditing !== false && emit('go-edit-tags')"
    >
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
    <div
      v-else
      class="empty-tags-tip"
      :class="{ 'is-readonly': allowTagEditing === false }"
      @click="allowTagEditing !== false && emit('go-edit-tags')"
    >
      <font-awesome-icon :icon="['fas', 'exclamation-circle']" />
      <span>{{ allowTagEditing === false ? '未提供临时标签' : '暂无标签，点击添加' }}</span>
    </div>
  </div>

  <el-form-item label="期末评语">
    <el-input
      ref="commentInputRef"
      style="width: 100%"
      :model-value="modelValue"
      size="default"
      type="textarea"
      placeholder="请输入学生期末评语..."
      :rows="5"
      :disabled="disabled"
      @update:model-value="(value: unknown) => emit('update:modelValue', value as string | null)"
    />
    <div class="comment-length" :class="{ 'is-error': !!commentLengthError }">
      {{ commentLength }}/{{ COMMENT_MIN_LENGTH }}-{{ COMMENT_MAX_LENGTH }} 字
    </div>
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

  &.is-readonly {
    cursor: default;
  }

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

  &.is-readonly {
    cursor: default;
  }
}

.comment-length {
  width: 100%;
  margin-top: 4px;
  text-align: right;
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;

  &.is-error {
    color: #f56c6c;
  }
}
</style>
