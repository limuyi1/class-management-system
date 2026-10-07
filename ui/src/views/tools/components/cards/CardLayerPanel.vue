<script setup lang="ts">
/** 图层列表与文字、尺寸属性，使用模板副本实现即时预览。 */
import { computed, ref } from 'vue'

import CardTextStylePanel from './CardTextStylePanel.vue'

import { CardLayerKindEnum } from '@/types/PrintTools'

import type { CardTemplateType } from '@/types/PrintTools'
const template = defineModel<CardTemplateType>('template', { required: true })
const selectedLayerId = defineModel<string>('selectedLayerId', { required: true })
defineProps<{ busy: boolean; fieldNames: string[] }>()
const emit = defineEmits<{ reorder: [offset: number]; replace: [] }>()
const layerFilter = ref('text')
const visibleLayers = computed(() =>
  [...template.value.layers].reverse().filter((layer) => layer.kind === layerFilter.value)
)
const selectedLayer = computed(() =>
  template.value.layers.find((layer) => layer.id === selectedLayerId.value)
)
</script>
<template>
  <el-card shadow="never" :inert="busy || undefined">
    <strong>图层与字段</strong>
    <p class="card-tool__hint">先选择文字或素材，再编辑选中图层。</p>
    <el-radio-group v-model="layerFilter" size="small"
      ><el-radio-button value="text">文字</el-radio-button
      ><el-radio-button value="image">素材</el-radio-button></el-radio-group
    >
    <el-scrollbar max-height="230px"
      ><div class="card-tool__layer-list">
        <el-button
          v-for="layer in visibleLayers"
          :key="layer.id"
          :type="selectedLayerId === layer.id ? 'primary' : 'default'"
          plain
          @click="selectedLayerId = layer.id"
          >{{ layer.hidden ? '（隐藏）' : '' }}{{ layer.label }}</el-button
        >
      </div></el-scrollbar
    >
    <el-form v-if="selectedLayer" label-position="top">
      <el-form-item label="图层名称"
        ><el-input v-model="selectedLayer.label" maxlength="40"
      /></el-form-item>
      <el-checkbox v-model="selectedLayer.hidden">隐藏</el-checkbox
      ><el-checkbox v-model="selectedLayer.locked">锁定拖动</el-checkbox>
      <el-form-item v-if="selectedLayer.kind === CardLayerKindEnum.Text" label="文字 / 变量">
        <el-input v-model="selectedLayer.text" type="textarea" :autosize="{ minRows: 4 }" />
        <div class="card-tool__variables">
          <el-tag
            v-for="field in fieldNames"
            :key="field"
            @click="selectedLayer.text += '{{' + field + '}}'"
            >{{ field }}</el-tag
          >
        </div>
      </el-form-item>
      <el-button v-if="selectedLayer.kind === CardLayerKindEnum.Image" @click="emit('replace')"
        >替换选中素材</el-button
      >
      <el-form-item label="位置 X / Y（毫米）"
        ><div class="card-tool__pair">
          <el-input-number
            v-model="selectedLayer.x"
            :min="0"
            :max="template.width"
            :precision="1"
            controls-position="right"
          /><el-input-number
            v-model="selectedLayer.y"
            :min="0"
            :max="template.height"
            :precision="1"
            controls-position="right"
          /></div
      ></el-form-item>
      <el-form-item label="宽 / 高（毫米）"
        ><div class="card-tool__pair">
          <el-input-number
            v-model="selectedLayer.width"
            :min="0.1"
            :max="template.width"
            :precision="1"
            controls-position="right"
          /><el-input-number
            v-model="selectedLayer.height"
            :min="0.1"
            :max="template.height"
            :precision="1"
            controls-position="right"
          /></div
      ></el-form-item>
      <template v-if="selectedLayer.kind === CardLayerKindEnum.Text">
        <CardTextStylePanel :model-value="selectedLayer" />
        <el-form-item label="文字颜色"
          ><el-color-picker v-model="selectedLayer.color" /><el-checkbox
            v-model="selectedLayer.bold"
            >加粗</el-checkbox
          ></el-form-item
        >
        <el-form-item label="对齐"
          ><el-radio-group v-model="selectedLayer.align" size="small"
            ><el-radio-button value="left">左</el-radio-button
            ><el-radio-button value="center">居中</el-radio-button
            ><el-radio-button value="right">右</el-radio-button></el-radio-group
          ></el-form-item
        >
      </template>
      <p v-if="selectedLayer.scene" class="card-tool__hint">
        原通知素材保留分组顺序；新增文字和图片可调整叠放顺序。
      </p>
      <div class="card-tool__buttons">
        <el-button size="small" :disabled="!!selectedLayer.scene" @click="emit('reorder', 1)"
          >上移图层</el-button
        ><el-button size="small" :disabled="!!selectedLayer.scene" @click="emit('reorder', -1)"
          >下移图层</el-button
        ><el-button
          size="small"
          type="danger"
          @click="template.layers = template.layers.filter((item) => item.id !== selectedLayerId)"
          >删除图层</el-button
        >
      </div>
    </el-form>
  </el-card>
</template>
<style scoped lang="scss">
.card-tool__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 8px 0;
}
.card-tool__pair {
  display: flex;
  gap: 6px;
  width: 100%;
}
.card-tool__pair :deep(.el-input-number) {
  width: 50%;
}
.card-tool__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.card-tool__layer-list {
  display: grid;
  gap: 6px;
  margin: 12px 0;
}
.card-tool__layer-list :deep(.el-button) {
  margin-left: 0;
  overflow: hidden;
}
.card-tool__variables {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
  cursor: pointer;
}
</style>
