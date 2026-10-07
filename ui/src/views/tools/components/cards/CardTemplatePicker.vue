<script setup lang="ts">
import { ref } from 'vue'

import CardPaper from './CardPaper.vue'
import { createCardTemplate } from '@/utils/cardTemplateUtil'

import type { CardTemplateType } from '@/types/PrintTools'

defineProps<{
  template: CardTemplateType
  saved: CardTemplateType[]
  busy: boolean
  converting: boolean
}>()
const emit = defineEmits<{ choose: [template: CardTemplateType]; convert: [] }>()
const galleryVisible = ref(false)
const presets = [createCardTemplate('certificate'), createCardTemplate('card')]
const galleryTab = ref('presets')
/** 用原生文字缩略展示成品布局，选择后每次生成独立模板副本。 */
function choosePreset(index: number): void {
  emit('choose', createCardTemplate(index === 0 ? 'certificate' : 'card'))
  galleryVisible.value = false
}
/** 套用已存模板后关闭选择器，文案与名单继续留在当前工作台。 */
function chooseSaved(template: CardTemplateType): void {
  emit('choose', template)
  galleryVisible.value = false
}
/** 在工作台完成素材转换，避免两个弹窗叠加。 */
function convertNotice(): void {
  galleryVisible.value = false
  emit('convert')
}
</script>
<template>
  <div class="card-picker">
    <div class="card-picker__summary">
      <strong>{{ template.name }}</strong>
      <small>{{ template.width }} × {{ template.height }} 毫米</small>
    </div>
    <el-button :disabled="busy" @click="galleryVisible = true">更换模板</el-button>
  </div>
  <el-dialog
    v-model="galleryVisible"
    title="选择成品模板"
    width="760px"
    append-to-body
    align-center
    :close-on-click-modal="false"
  >
    <el-tabs v-model="galleryTab">
      <el-tab-pane label="成品模板" name="presets">
        <el-scrollbar max-height="55vh">
          <div class="card-picker__gallery">
            <button
              v-for="(item, index) in presets"
              :key="item.id"
              class="card-picker__choice"
              :disabled="busy"
              @click="choosePreset(index)"
            >
              <div class="card-picker__thumbnail">
                <div :style="{ transform: `scale(${280 / (item.width * 6)})` }">
                  <CardPaper
                    :template="item"
                    :fields="{
                      标题: index === 0 ? '奖 状' : '表扬卡',
                      姓名: '张小明',
                      称号: '学习之星',
                      正文: '勤奋努力，表现优异。\n特发此状，以资鼓励。',
                      班级: '三年级一班',
                      学校: '',
                      落款: '班主任',
                      日期: '2026-10-04'
                    }"
                  />
                </div>
              </div>
              <strong>{{ item.name }}</strong
              ><small>{{ item.width }} × {{ item.height }} 毫米</small>
              <span>使用此模板</span>
            </button>
          </div>
        </el-scrollbar>
      </el-tab-pane>
      <el-tab-pane :label="`我的模板（${saved.length}）`" name="saved">
        <el-scrollbar max-height="55vh">
          <div v-for="item in saved" :key="item.id" class="card-picker__saved">
            <div>
              <strong>{{ item.name }}</strong
              ><small>{{ item.width }} × {{ item.height }} 毫米</small>
            </div>
            <el-button :disabled="busy" @click="chooseSaved(item)">使用模板</el-button>
          </div>
          <el-empty
            v-if="!saved.length"
            :image-size="64"
            description="保存模板后，可在这里重复使用"
          />
        </el-scrollbar>
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <el-button :disabled="busy" :loading="converting" @click="convertNotice"
        >套用现有成绩通知版式</el-button
      >
      <el-button @click="galleryVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>
<style scoped lang="scss">
.card-picker {
  display: flex;
  align-items: center;
  gap: 20px;
  min-width: 0;
}
.card-picker__summary {
  min-width: 0;
}
.card-picker__summary strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
small {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.card-picker__saved {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-light);
}
.card-picker__gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding: 4px;
}
.card-picker__choice {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}
.card-picker__choice:hover,
.card-picker__choice:focus-visible {
  border-color: var(--el-color-primary);
}
.card-picker__thumbnail {
  width: 280px;
  height: 198px;
  overflow: hidden;
  margin-bottom: 16px;
}
.card-picker__thumbnail > div {
  transform-origin: left top;
}
.card-picker__choice strong {
  display: block;
  font-size: 16px;
  margin-bottom: 4px;
}
.card-picker__choice span {
  display: block;
  color: var(--el-color-primary);
  margin-top: 12px;
}
</style>
