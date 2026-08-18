<script setup lang="ts">
/** 清洁区域管理弹窗 — 重命名、拖拽排序与删除区域 */
import { ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'

import type { DutySectionType } from '@/types/DutyRoster'

const props = defineProps<{
  modelValue: boolean
  sections: DutySectionType[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  rename: [sectionId: string, name: string]
  remove: [sectionId: string]
  add: []
  reorder: [sectionIds: string[]]
}>()

const drafts = ref<Record<string, string>>({})
const orderedSections = ref<DutySectionType[]>([])

// 打开弹窗时回填名称草稿与排序后的区域列表
watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      drafts.value = Object.fromEntries(props.sections.map((section) => [section.id, section.name]))
      orderedSections.value = [...props.sections].sort(
        (left, right) => left.sortOrder - right.sortOrder
      )
    }
  }
)

/**
 * 提交区域名称修改，仅在名称有效且变化时触发重命名。
 * @param section - 区域
 */
function commitName(section: DutySectionType): void {
  const name = drafts.value[section.id]?.trim()
  if (name && name !== section.name) emit('rename', section.id, name)
}

/**
 * 二次确认后删除区域。
 * @param section - 区域
 */
async function removeSection(section: DutySectionType): Promise<void> {
  await ElMessageBox.confirm(
    `删除“${section.name}”后，其中已安排的学生将回到未安排区域。是否继续？`,
    '删除区域',
    { type: 'warning' }
  )
  emit('remove', section.id)
}

/** 提交区域排序结果 */
function commitOrder(): void {
  emit(
    'reorder',
    orderedSections.value.map((section) => section.id)
  )
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="管理值日区域"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="duty-sections">
      <draggable
        v-model="orderedSections"
        item-key="id"
        handle=".duty-sections__drag"
        :animation="160"
        ghost-class="is-ghost"
        @end="commitOrder"
      >
        <template #item="{ element: section }">
          <div class="duty-sections__item">
            <button class="duty-sections__drag" type="button" aria-label="拖动区域排序">
              <font-awesome-icon :icon="['solid', 'grip-vertical']" />
            </button>
            <span class="duty-sections__icon">
              <font-awesome-icon :icon="['solid', section.kind === 'indoor' ? 'house' : 'broom']" />
            </span>
            <el-input
              v-model="drafts[section.id]"
              maxlength="16"
              @blur="commitName(section)"
              @keydown.enter.prevent="commitName(section)"
            />
            <span class="duty-sections__count">{{ section.positions.length }} 个岗位</span>
            <el-button
              circle
              plain
              type="danger"
              :disabled="sections.length <= 1"
              @click="removeSection(section)"
            >
              <font-awesome-icon :icon="['regular', 'trash-can']" />
            </el-button>
          </div>
        </template>
      </draggable>
      <button class="duty-sections__add" type="button" @click="emit('add')">
        <font-awesome-icon :icon="['solid', 'plus']" />
        新增清洁区域
      </button>
    </div>
    <template #footer>
      <el-button type="primary" @click="emit('update:modelValue', false)">完成</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.duty-sections {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.duty-sections__item {
  display: grid;
  grid-template-columns: 20px 34px minmax(0, 1fr) auto 34px;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #faf9fc;
  border: 1px solid #e8e3ed;
  border-radius: 9px;
}

.duty-sections__item.is-ghost {
  opacity: 0.42;
  background: #f0e9fb;
}

.duty-sections__drag {
  display: grid;
  width: 20px;
  height: 32px;
  place-items: center;
  padding: 0;
  color: #aaa0b3;
  background: transparent;
  border: 0;
  cursor: grab;
}

.duty-sections__drag:active {
  cursor: grabbing;
}

.duty-sections__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #7442c4;
  background: #f0e9fb;
  border-radius: 8px;
}

.duty-sections__count {
  color: #8c8495;
  font-size: 11px;
}

.duty-sections__add {
  height: 42px;
  color: #7040c1;
  background: #fbf9ff;
  border: 1px dashed #bba6dc;
  border-radius: 9px;
  cursor: pointer;
}
</style>
