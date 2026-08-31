<script setup lang="ts">
/** 学生新增/编辑弹窗 — 集中维护序号、姓名、数字成绩、评语与启用状态 */
import { computed, reactive, watch } from 'vue'

import { ElMessage } from 'element-plus'

import { NAME_PROP } from '@/constants'
import { parseScoreValue } from '@/utils/scoreImportUtil'
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  countCommentLength,
  getCommentLengthError
} from '@/utils/evaluation/commentLengthUtil'

import type { SettingType } from '@/types/Setting'
import type { StudentDataType } from '@/types/StudentData'

const props = defineProps<{
  modelValue: boolean
  student: StudentDataType | null
  scoreColumns: SettingType[]
  sequence: number
  maxSequence: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [values: Record<string, string | number | boolean | null | undefined>, sequence: number]
}>()

const form = reactive({
  name: '',
  sequence: 1,
  disabled: false,
  comment: '',
  scores: {} as Record<string, number | null>
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const title = computed(() => (props.student ? '编辑学生' : '新增学生'))
const commentLength = computed(() => countCommentLength(form.comment))
const commentLengthError = computed(() => getCommentLengthError(form.comment))

/** 打开弹窗时根据当前学生建立独立草稿，取消不会污染 Store 数据。 */
watch(
  () => [props.modelValue, props.student, props.scoreColumns, props.sequence] as const,
  ([dialogVisible]) => {
    if (!dialogVisible) return
    form.name = String(props.student?.[NAME_PROP] ?? '')
    form.sequence = props.sequence
    form.disabled = props.student?.disabled === true
    form.comment = String(props.student?.comment ?? '')
    form.scores = {}
    props.scoreColumns.forEach((column) => {
      const rawValue = props.student?.[column.prop]
      const score = parseScoreValue(typeof rawValue === 'object' ? null : rawValue)
      form.scores[column.prop] = score.invalid ? null : score.value
    })
  },
  { immediate: true }
)

/** 校验姓名后提交表单草稿。 */
function submit(): void {
  const name = form.name.trim()
  if (!name) {
    ElMessage.error('姓名不能为空')
    return
  }

  const values: Record<string, string | number | boolean | null | undefined> = {
    [NAME_PROP]: name,
    disabled: form.disabled === true,
    comment: form.comment.trim() || undefined
  }
  for (const column of props.scoreColumns) {
    values[column.prop] = form.scores[column.prop] ?? null
  }
  emit('save', values, form.sequence)
}
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="620px" :close-on-click-modal="false">
    <el-form label-position="top" @submit.prevent="submit">
      <div class="student-form__basic">
        <el-form-item label="序号" required>
          <el-input-number
            v-model="form.sequence"
            class="student-form__number-input"
            :min="1"
            :max="maxSequence"
            :precision="0"
            controls-position="right"
          />
          <small class="student-form__sequence-hint">已有该序号时，其他学生会自动顺移</small>
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input
            v-model="form.name"
            maxlength="30"
            show-word-limit
            placeholder="请输入学生姓名"
            autofocus
            @keydown.enter.prevent="submit"
          />
        </el-form-item>
      </div>

      <div v-if="scoreColumns.length" class="student-form__scores">
        <el-form-item v-for="column in scoreColumns" :key="column.prop" :label="column.label">
          <el-input-number
            v-model="form.scores[column.prop]"
            class="student-form__number-input"
            :controls="false"
            :value-on-clear="null"
            :placeholder="`请输入${column.label}`"
          />
        </el-form-item>
      </div>

      <el-form-item label="期末评语">
        <el-input
          v-model="form.comment"
          type="textarea"
          :rows="5"
          resize="vertical"
          placeholder="请输入学生期末评语"
        />
        <div class="student-form__comment-length" :class="{ 'is-error': commentLengthError }">
          {{ commentLength }}/{{ COMMENT_MIN_LENGTH }}-{{ COMMENT_MAX_LENGTH }} 字
          <span v-if="commentLengthError">· {{ commentLengthError }}</span>
        </div>
      </el-form-item>

      <el-form-item label="学生状态">
        <el-switch
          v-model="form.disabled"
          :active-value="false"
          :inactive-value="true"
          active-text="启用"
          inactive-text="禁用"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.student-form__basic,
.student-form__scores {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}

.student-form__basic {
  grid-template-columns: 140px minmax(0, 1fr);
}

.student-form__number-input {
  width: 100%;
}

.student-form__sequence-hint {
  color: #909399;
  font-size: 11px;
  line-height: 1.4;
}

.student-form__comment-length {
  width: 100%;
  color: #909399;
  font-size: 12px;
  text-align: right;
}

.student-form__comment-length.is-error {
  color: var(--el-color-warning);
}
</style>
