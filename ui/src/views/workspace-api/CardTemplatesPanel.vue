<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { apiRequest } from '@/api/client'
import { useScopedApiResource } from '@/hooks/api/useScopedApiResource'
import { createCardTemplate, createCardLayer } from '@/utils/cardTemplateUtil'
import CardCanvas from '@/views/tools/components/cards/CardCanvas.vue'
import CardTextStylePanel from '@/views/tools/components/cards/CardTextStylePanel.vue'
import { CardLayerKindEnum } from '@/types/PrintTools'
import type { CardTemplateType } from '@/types/PrintTools'
import type { ResourceType } from '@/types/ApiResources'
type SavedTemplateType = CardTemplateType & { deletedAt?: number }
const props = defineProps<{ ownerId: string }>(),
  emit = defineEmits<{ busy: [boolean] }>()
const api = useScopedApiResource(
  () => props.ownerId,
  () => '',
  async (owner, _id, signal) =>
    apiRequest<{ items: ResourceType[] }>('/resources?kind=settings', { ownerId: owner, signal })
)
const { state, loading, saving } = api,
  template = ref<SavedTemplateType>(createCardTemplate()),
  selected = ref(''),
  baseline = ref('')
const templates = computed(() =>
  ((state.value?.items[0]?.content.templates || []) as SavedTemplateType[]).filter(
    (row) => !row.deletedAt
  )
)
const layer = computed(() => template.value.layers.find((row) => row.id === selected.value))
const hasDraft = computed(() => JSON.stringify(template.value) !== baseline.value)
function reset(): void {
  template.value = createCardTemplate()
  selected.value = ''
  baseline.value = JSON.stringify(template.value)
}
async function open(value: SavedTemplateType): Promise<void> {
  if (hasDraft.value) throw new Error('请先保存或取消模板编辑')
  template.value = JSON.parse(JSON.stringify(value))
  baseline.value = JSON.stringify(template.value)
  selected.value = ''
}
async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    console.error('模板操作失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}
/** 模板与账号设置共用版本，保留其他字段；删除保留原模板并标记时间。 */
async function persist(value: SavedTemplateType): Promise<void> {
  const old = state.value?.items[0],
    list = (old?.content.templates || []) as SavedTemplateType[]
  const next = list.some((row) => row.id === value.id)
    ? list.map((row) => (row.id === value.id ? value : row))
    : [...list, value]
  await api.write(`/resources/settings/${props.ownerId}`, 'PUT', {
    workspaceId: null,
    name: '账号业务设置',
    content: { ...(old?.content || {}), templates: next },
    version: old?.version || 0
  })
  baseline.value = JSON.stringify(template.value)
}
async function save(): Promise<void> {
  await persist(template.value)
  ElMessage.success('模板已保存')
}
async function remove(value: SavedTemplateType): Promise<void> {
  await ElMessageBox.confirm(`软删除模板「${value.name}」？`, '删除模板', { type: 'warning' })
  await persist({ ...value, deletedAt: Date.now() })
  if (template.value.id === value.id) reset()
}
watch(
  () => props.ownerId,
  () => {
    api.clear()
    reset()
    void run(api.load)
  },
  { immediate: true }
)
watch(
  () => loading.value || saving.value,
  (value) => emit('busy', value),
  { immediate: true }
)
defineExpose({ hasDraft, reset })
</script>
<template>
  <section v-loading="loading">
    <el-form :disabled="saving" label-width="100px"
      ><el-form-item label="模板名称"
        ><el-input v-model="template.name" maxlength="100" /></el-form-item
      ><el-form-item label="宽/高（毫米）"
        ><el-input-number v-model="template.width" :min="20" :max="420" /><el-input-number
          v-model="template.height"
          :min="20"
          :max="420" /></el-form-item
      ><el-button @click="template.layers.push(createCardLayer(CardLayerKindEnum.Text))"
        >添加文字</el-button
      ><el-button @click="run(save)">保存模板</el-button
      ><el-button @click="reset">取消编辑 / 新建</el-button>
      <template v-if="layer"
        ><el-form-item label="文字"
          ><el-input v-model="layer.text" type="textarea" :rows="3" /></el-form-item
        ><CardTextStylePanel
          v-model="template.layers[template.layers.findIndex((row) => row.id === selected)]"
        /><el-form-item label="位置/尺寸"
          ><el-input-number v-model="layer.x" :min="0" /><el-input-number
            v-model="layer.y"
            :min="0" /><el-input-number v-model="layer.width" :min="1" /><el-input-number
            v-model="layer.height"
            :min="1" /></el-form-item
        ><el-checkbox v-model="layer.hidden">隐藏图层</el-checkbox></template
      ></el-form
    >
    <p>
      文字支持
      <code v-pre>{{ 姓名 }}、{{ 称号 }}、{{ 正文 }}、{{ 班级 }}</code>
      等变量；点击预览文字可选择图层并拖动。
    </p>
    <CardCanvas
      v-model="selected"
      :template="template"
      :fields="{
        姓名: '学生姓名',
        标题: '奖状',
        称号: '学习之星',
        正文: '勤奋努力，表现优异',
        班级: '示例班级',
        日期: '2026-10-07',
        学校: '',
        落款: ''
      }"
      :busy="saving"
      editing
    />
    <el-table :data="templates"
      ><el-table-column prop="name" label="已保存模板" /><el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button :disabled="saving" @click="run(() => open(row))">打开</el-button
          ><el-button :disabled="saving" @click="run(() => remove(row))"
            >软删除</el-button
          ></template
        ></el-table-column
      ></el-table
    >
  </section>
</template>
