<script setup lang="ts">
/** 模板纸张、背景和本次批量公共字段设置。 */
import type { CardTemplateType } from '@/types/PrintTools'
const template = defineModel<CardTemplateType>('template', { required: true })
const globals = defineModel<Record<string, string>>('globals', { required: true })
defineProps<{ busy: boolean; layoutOnly?: boolean; fieldsOnly?: boolean }>()
const emit = defineEmits<{ upload: []; library: [] }>()
</script>
<template>
  <el-card shadow="never" :inert="busy || undefined">
    <el-form label-position="top"
      ><template v-if="!fieldsOnly">
        <el-form-item label="模板名称"
          ><el-input v-model="template.name" maxlength="50"
        /></el-form-item>
        <el-form-item label="纸张宽 × 高（毫米）"
          ><div class="card-tool__pair">
            <el-input-number
              v-model="template.width"
              :min="50"
              :max="420"
              controls-position="right"
            /><el-input-number
              v-model="template.height"
              :min="50"
              :max="420"
              controls-position="right"
            /></div
        ></el-form-item>
        <el-form-item v-if="template.frame" label="通知风格边框">
          <el-button size="small" @click="template.frame = undefined">移除边框装饰</el-button>
        </el-form-item>
        <el-form-item label="背景素材"
          ><div class="card-tool__buttons">
            <el-button size="small" @click="emit('upload')">上传背景</el-button
            ><el-button size="small" @click="emit('library')">素材库</el-button
            ><el-button v-if="template.background" size="small" @click="template.background = ''"
              >移除</el-button
            >
          </div></el-form-item
        >
        <el-form-item v-if="template.background" label="背景适配"
          ><el-radio-group v-model="template.backgroundFit"
            ><el-radio value="contain">完整显示</el-radio
            ><el-radio value="cover">铺满裁切</el-radio></el-radio-group
          ></el-form-item
        > </template
      ><template v-if="!layoutOnly"
        ><el-form-item v-for="(_, key) in globals" :key="key" :label="`公共${key}`"
          ><el-input
            v-model="globals[key]"
            :type="['正文', '评语'].includes(String(key)) ? 'textarea' : 'text'"
            :autosize="{ minRows: 3 }"
        /></el-form-item>
      </template>
    </el-form>
    <small>Excel 同名列优先于公共内容。保存模板时保留公共文案、版式与素材。</small>
  </el-card>
</template>
<style scoped lang="scss">
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
small {
  color: var(--el-text-color-secondary);
}
</style>
