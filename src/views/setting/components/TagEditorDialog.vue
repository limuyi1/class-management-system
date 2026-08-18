<script setup lang="ts">
/**
 * 单个学生标签编辑弹窗：以级联选择器展示分类-标签两级结构，
 * 供用户为指定学生增删标签，无可用标签时引导跳转标签维护页。
 */
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import type {
  TagEditorDialogStudent,
  TagEditorDialogProps,
  TagEditorDialogEmits
} from '@/types/TagEditorDialog'
import { NAME_PROP } from '@/constants'

const props = defineProps<TagEditorDialogProps>()

const emit = defineEmits<TagEditorDialogEmits>()

const settingStore = useSettingStore()
const { tagCategories: categories, tags: tagOptions } = storeToRefs(settingStore)

/** 将分类与标签组织为级联选择器所需的 options 结构 */
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

/** 是否至少存在一个可选标签，用于判断是否需要引导去维护标签 */
const hasAnyTags = computed(() => cascaderOptions.value.some((cat) => cat.children && cat.children.length > 0))

const currentCascaderValue = ref<string[][]>([])

/**
 * 将学生的标签对象展开为 [分类, 标签] 二维数组，供级联选择器回显。
 * @param row - 学生数据
 * @returns 展开后的选择值
 */
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

/** 关闭弹窗 */
const closeDialog = () => {
  emit('update:visible', false)
}

/** 确认编辑：无标签时引导跳转，否则将选中值重组为标签对象并回传 */
const confirmEdit = () => {
  // 如果没有任何标签可用，跳转到标签维护页
  if (!hasAnyTags.value) {
    emit('goTab', 'label-maintenance')
    return
  }
  const tags: Record<string, string[]> = {}
  currentCascaderValue.value.forEach(([cat, tag]) => {
    if (!tags[cat]) tags[cat] = []
    tags[cat].push(tag)
  })
  emit('confirm', tags)
  emit('update:visible', false)
}

/** 双向绑定的弹窗显隐状态 */
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

/** 弹窗打开后初始化选择值，确保回显当前学生的标签 */
const initCascaderValue = () => {
  if (props.student) {
    currentCascaderValue.value = getRowTagsValue(props.student)
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`为 ${student?.[NAME_PROP] || ''} 添加标签`"
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
