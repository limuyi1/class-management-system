<script setup lang="ts">
import { computed } from 'vue'

import { getCardTemplateFields } from '@/utils/print-template/cardPresetUtil'

import type { CardTemplateType } from '@/types/PrintTools'

const props = defineProps<{ template: CardTemplateType; busy: boolean; studentFields: string[] }>()
const globals = defineModel<Record<string, string>>('globals', { required: true })
/** 常用文案先填写，署名、日期沿用默认值，按需展开；名单字段不用重复录入。 */
const keys = computed(() =>
  getCardTemplateFields(props.template).filter(
    (key) =>
      key !== '姓名' &&
      (Object.prototype.hasOwnProperty.call(globals.value, key) ||
        !props.studentFields.includes(key))
  )
)
const signatureNames = ['班级', '学校', '落款', '日期', '学期']
const contentKeys = computed(() => keys.value.filter((key) => !signatureNames.includes(key)))
const signatureKeys = computed(() => keys.value.filter((key) => signatureNames.includes(key)))
const labels: Record<string, string> = {
  称号: '表扬称号',
  正文: '表扬正文',
  日期: '颁发日期',
  学校: '学校（选填）',
  落款: '落款（选填）'
}
</script>
<template>
  <section class="card-content" aria-label="填写内容">
    <header class="card-content__heading">
      <h3>填写内容</h3>
      <p>姓名由名单填写，右侧实时预览。</p>
    </header>
    <el-form label-position="top" :disabled="busy" class="card-content__form">
      <div class="card-content__fields">
        <el-form-item
          v-for="key in contentKeys"
          :key="key"
          :label="labels[key] || key"
          :class="{ 'card-content__field--wide': !['标题', '称号'].includes(key) }"
        >
          <el-select
            v-if="key === '称号'"
            v-model="globals[key]"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入称号"
          >
            <el-option
              v-for="title in ['学习之星', '进步之星', '阅读之星', '劳动之星', '优秀班干部']"
              :key="title"
              :label="title"
              :value="title"
            />
          </el-select>
          <el-input
            v-else
            v-model="globals[key]"
            :type="['正文', '评语'].includes(key) ? 'textarea' : 'text'"
            :autosize="{ minRows: 3 }"
            resize="none"
          />
        </el-form-item>
      </div>
      <el-collapse v-if="signatureKeys.length" class="card-content__signature">
        <el-collapse-item title="署名与日期" name="signature">
          <div class="card-content__fields card-content__fields--signature">
            <el-form-item v-for="key in signatureKeys" :key="key" :label="labels[key] || key">
              <el-date-picker
                v-if="key === '日期'"
                v-model="globals[key]"
                type="date"
                value-format="YYYY-MM-DD"
                :clearable="false"
              />
              <el-input v-else v-model="globals[key]" />
            </el-form-item>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-form>
    <p v-if="!keys.length" class="card-content__hint">
      此模板使用固定文字或名单字段，需要调整时进入高级编辑。
    </p>
    <p class="card-content__hint">Excel 同名列优先于这里的公共内容。</p>
  </section>
</template>
<style scoped lang="scss">
.card-content {
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}
.card-content__heading {
  margin-bottom: 16px;
}
.card-content__heading h3 {
  margin: 0 0 6px;
  font-size: 16px;
}
.card-content__heading p,
.card-content__hint {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.card-content__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}
.card-content__field--wide {
  grid-column: 1 / -1;
}
.card-content__fields :deep(.el-form-item) {
  min-width: 0;
  margin-bottom: 16px;
}
.card-content__fields :deep(.el-form-item__label) {
  padding-bottom: 8px;
}
.card-content__fields :deep(.el-select),
.card-content__fields :deep(.el-date-editor) {
  width: 100%;
}
.card-content__signature {
  margin: 0 0 8px;
}
.card-content__fields--signature {
  padding-top: 16px;
}
.card-content__signature :deep(.el-collapse-item__content) {
  padding-bottom: 0;
}
</style>
