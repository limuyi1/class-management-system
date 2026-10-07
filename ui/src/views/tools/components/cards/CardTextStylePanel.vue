<script setup lang="ts">
import type { CardLayerType } from '@/types/PrintTools'
const layer = defineModel<CardLayerType>({ required: true })
const fonts = [
  { label: '系统黑体', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: 'STSong, "Songti SC", SimSun, serif' },
  { label: '手写字体', value: 'EvaluationHandwriteFont, FYFont, KaiTi, cursive' },
  { label: '楷体', value: '"KaiTi SC", KaiTi, cursive' },
  { label: '英文衬线', value: 'Georgia, serif' }
]
</script>
<template>
  <el-form-item label="字体"
    ><el-select v-model="layer.fontFamily" placeholder="默认系统黑体" filterable allow-create
      ><el-option
        v-if="layer.fontFamily && !fonts.some((font) => font.value === layer.fontFamily)"
        :label="`素材原字体：${layer.fontFamily}`"
        :value="layer.fontFamily" /><el-option
        v-for="font in fonts"
        :key="font.label"
        :label="font.label"
        :value="font.value" /></el-select
  ></el-form-item>
  <div class="text-style__pair">
    <el-form-item label="字号（pt）"
      ><el-input-number
        v-model="layer.fontSize"
        :min="1"
        :max="180"
        :precision="2"
        controls-position="right" /></el-form-item
    ><el-form-item label="行距倍数"
      ><el-input-number
        v-model="layer.lineHeight"
        :min="0.8"
        :max="3"
        :step="0.1"
        controls-position="right"
    /></el-form-item>
  </div>
  <el-form-item label="字距（pt）"
    ><el-input-number
      v-model="layer.letterSpacing"
      :min="-5"
      :max="20"
      :step="0.1"
      controls-position="right"
  /></el-form-item>
  <el-checkbox v-model="layer.singleLine">保持单行（超宽时提示）</el-checkbox>
  <el-collapse
    ><el-collapse-item title="描边与阴影" name="effects">
      <el-form-item label="描边粗细（pt）"
        ><el-input-number
          v-model="layer.strokeWidth"
          :min="0"
          :max="5"
          :step="0.1"
          controls-position="right" /><el-color-picker v-model="layer.strokeColor"
      /></el-form-item>
      <el-form-item label="阴影颜色"
        ><el-color-picker v-model="layer.shadowColor" show-alpha
      /></el-form-item>
      <div class="text-style__pair">
        <el-form-item label="水平偏移（pt）"
          ><el-input-number
            v-model="layer.shadowX"
            :min="-20"
            :max="20"
            controls-position="right" /></el-form-item
        ><el-form-item label="垂直偏移（pt）"
          ><el-input-number v-model="layer.shadowY" :min="-20" :max="20" controls-position="right"
        /></el-form-item>
      </div>
      <el-form-item label="阴影模糊（pt）"
        ><el-input-number v-model="layer.shadowBlur" :min="0" :max="30" controls-position="right"
      /></el-form-item> </el-collapse-item
  ></el-collapse>
</template>
<style scoped lang="scss">
.text-style__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.text-style__pair :deep(.el-input-number) {
  width: 100%;
}
</style>
