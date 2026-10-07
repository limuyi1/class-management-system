<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { defaultNoticeConfig } from '@/utils/apiTeachingProjectionUtil'
import type { NoticeConfigType, TeachingSnapshotType } from '@/types/ApiTeaching'

const props = defineProps<{
  snapshot: TeachingSnapshotType
  busy: boolean
  write: (path: string, method: string, body: unknown) => Promise<void>
}>()
const draft = ref<NoticeConfigType | null>(null)
let expectedVersion = 0
const hasDraft = computed(() => Boolean(draft.value))
const choices = computed(() =>
  props.snapshot.scores.assessments.filter((column) => !column.disabled)
)
const selected = ref<string[]>([])
function reset(): void {
  draft.value = null
}
function open(): void {
  draft.value = JSON.parse(
    JSON.stringify(props.snapshot.notice.config || defaultNoticeConfig(props.snapshot))
  ) as NoticeConfigType
  expectedVersion = props.snapshot.notice.version
  selected.value = draft.value.subjects.map((subject) => subject.assessmentId)
}
/** 选择新科目使用本期满分，已有科目保留老师明确设置的等级规则。 */
function choose(ids: string[]): void {
  if (!draft.value) return
  const current = draft.value
  current.subjects = ids
    .map(
      (id) =>
        current.subjects.find((subject) => subject.assessmentId === id) ||
        defaultNoticeConfig(props.snapshot).subjects.find((subject) => subject.assessmentId === id)!
    )
    .filter(Boolean)
}
async function save(): Promise<void> {
  if (!draft.value) return
  try {
    await props.write(`/workspaces/${props.snapshot.scores.workspace.id}/notice`, 'PUT', {
      expectedVersion,
      config: draft.value
    })
    reset()
    ElMessage.success('通知设置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存设置失败')
    console.error('保存通知设置失败:', error)
  }
}
defineExpose({ hasDraft, reset })
</script>
<template>
  <el-button :disabled="busy" @click="open">通知设置</el-button>
  <el-dialog
    :model-value="!!draft"
    title="成绩通知单设置"
    width="700px"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
    @close="reset"
  >
    <el-form v-if="draft" label-width="90px" :disabled="busy"
      ><el-form-item label="标题"><el-input v-model="draft.title" maxlength="120" /></el-form-item
      ><el-form-item label="日期"
        ><el-input v-model="draft.noticeDate" placeholder="YYYY-MM-DD" /></el-form-item
      ><el-form-item label="展示模式"
        ><el-radio-group v-model="draft.mode"
          ><el-radio value="score" label="score">分数</el-radio
          ><el-radio value="grade" label="grade">等级</el-radio></el-radio-group
        ></el-form-item
      ><el-form-item label="本期测评"
        ><el-select v-model="selected" multiple @change="choose"
          ><el-option
            v-for="column in choices"
            :key="column.id"
            :label="column.label"
            :value="column.id" /></el-select></el-form-item
      ><el-form-item
        v-for="subject in draft.subjects"
        :key="subject.assessmentId"
        :label="choices.find((column) => column.id === subject.assessmentId)?.label || '测评失效'"
        ><div class="notice-settings__rule">
          <label>满分<el-input-number v-model="subject.maxScore" :min="0.01" :max="100000" /></label
          ><label
            >A 线<el-input-number
              v-model="subject.gradeAMin"
              :min="0"
              :max="subject.maxScore" /></label
          ><label
            >B 线<el-input-number v-model="subject.gradeBMin" :min="0" :max="subject.gradeAMin"
          /></label></div></el-form-item
    ></el-form>
    <template #footer
      ><el-button :disabled="busy" @click="reset">取消</el-button
      ><el-button type="primary" :loading="busy" @click="save">保存设置</el-button></template
    >
  </el-dialog>
</template>
<style scoped lang="scss">
.notice-settings__rule {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  label {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .el-input-number {
    width: 110px;
  }
}
.el-select {
  width: 100%;
}
</style>
