<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'

export interface TagEditorDialogStudent {
  xing4_ming2: string
  tags?: Record<string, string[]>
}

const props = defineProps<{
  visible: boolean
  student: TagEditorDialogStudent | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [tags: Record<string, string[]>]
}>()

const settingStore = useSettingStore()
const { tagCategory: categories, tags: tagOptions } = storeToRefs(settingStore)

const cascaderOptions = computed(() => {
  return categories.value.map((cat) => ({
    value: cat.prop,
    label: cat.label,
    children: (tagOptions.value[cat.prop] || []).map((tag) => ({
      value: tag,
      label: tag
    }))
  }))
})

const currentCascaderValue = ref<string[][]>([])

const getRowTagsValue = (row: TagEditorDialogStudent): string[][] => {
  if (!row.tags) return []
  const result: string[][] = []
  for (const [cat, tagList] of Object.entries(row.tags)) {
    if (Array.isArray(tagList)) {
      tagList.forEach((tag: string) => result.push([cat, tag]))
    }
  }
  return result
}

const closeDialog = () => {
  emit('update:visible', false)
}

const confirmEdit = () => {
  const tags: Record<string, string[]> = {}
  currentCascaderValue.value.forEach(([cat, tag]) => {
    if (!tags[cat]) tags[cat] = []
    tags[cat].push(tag)
  })
  emit('confirm', tags)
  emit('update:visible', false)
}

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const initCascaderValue = () => {
  if (props.student) {
    currentCascaderValue.value = getRowTagsValue(props.student)
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`为 ${student?.xing4_ming2 || ''} 添加标签`"
    width="400px"
    :close-on-click-modal="false"
    destroy-on-close
    @opened="initCascaderValue"
  >
    <el-cascader
      v-model="currentCascaderValue"
      :options="cascaderOptions"
      :props="{ multiple: true }"
      placeholder="选择标签"
      clearable
      class="w-full"
    />
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" @click="confirmEdit">确定</el-button>
    </template>
  </el-dialog>
</template>
