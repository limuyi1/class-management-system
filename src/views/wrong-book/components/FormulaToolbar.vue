<script setup lang="ts">
/** 公式工具栏 — 提供常用 LaTeX 公式与自定义公式的预览与插入 */
import { ref } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/** 插入公式事件 */
interface Emits {
  (e: 'insert', formula: string): void
}

const emit = defineEmits<Emits>()

/** 自定义公式输入、实时预览与错误提示 */
const formulaInput = ref('')
const formulaPreview = ref('')
const formulaError = ref('')

/** 常用公式模板列表 */
const commonFormulas = [
  { label: '分数', formula: '\\frac{a}{b}' },
  { label: '平方', formula: 'x^2' },
  { label: '根号', formula: '\\sqrt{x}' },
  { label: '下标', formula: 'x_{i}' },
  { label: '乘号', formula: '\\times' },
  { label: '除号', formula: '\\div' },
  { label: '不等于', formula: '\\neq' },
  { label: '小于等于', formula: '\\leq' },
  { label: '大于等于', formula: '\\geq' },
  { label: '约等于', formula: '\\approx' },
  { label: '正负', formula: '\\pm' },
  { label: '无穷', formula: '\\infty' },
  { label: '角度', formula: '\\degree' },
  { label: '三角形', formula: '\\triangle' },
  { label: '圆', formula: '\\odot' },
  { label: '垂直', formula: '\\perp' },
  { label: '平行', formula: '\\parallel' },
  { label: '角', formula: '\\angle' },
  { label: '度', formula: '^{\\circ}' },
  { label: '向量', formula: '\\vec{a}' }
]

/**
 * 将常用公式以行内公式形式插入编辑器
 * @param formula - LaTeX 公式源码
 */
const insertFormula = (formula: string) => {
  emit('insert', `$${formula}$`)
}

/** 校验并插入自定义公式，失败时展示错误提示 */
const insertCustomFormula = () => {
  if (!formulaInput.value.trim()) return

  try {
    katex.renderToString(formulaInput.value)
    formulaError.value = ''
    emit('insert', `$${formulaInput.value}$`)
    formulaInput.value = ''
  } catch (e) {
    formulaError.value = '公式格式错误，请检查'
  }
}

/** 实时渲染自定义公式预览，失败时展示错误提示 */
const previewFormula = () => {
  if (!formulaInput.value.trim()) {
    formulaPreview.value = ''
    return
  }
  try {
    formulaPreview.value = katex.renderToString(formulaInput.value, {
      throwOnError: false,
      displayMode: true
    })
    formulaError.value = ''
  } catch (e) {
    formulaError.value = '公式格式错误'
    formulaPreview.value = ''
  }
}
</script>

<template>
  <div class="formula-toolbar">
    <div class="formula-header">
      <span class="formula-title">常用公式</span>
    </div>
    <!-- 常用公式按钮区 -->
    <div class="formula-list">
      <div
        v-for="item in commonFormulas"
        :key="item.formula"
        class="formula-item"
        :title="item.formula"
        @click="insertFormula(item.formula)"
      >
        <span v-html="katex.renderToString(item.formula, { throwOnError: false })" />
        <span class="formula-label">{{ item.label }}</span>
      </div>
    </div>
    <!-- 自定义公式输入与预览 -->
    <div class="formula-custom">
      <div class="formula-header">
        <span class="formula-title">自定义公式</span>
      </div>
      <div class="formula-input-row">
        <el-input
          v-model="formulaInput"
          placeholder="输入 LaTeX 公式，如: \frac{a}{b}"
          @input="previewFormula"
          @keyup.enter="insertCustomFormula"
        />
        <el-button type="primary" size="small" @click="insertCustomFormula">插入</el-button>
      </div>
      <div v-if="formulaError" class="formula-error">{{ formulaError }}</div>
      <div v-if="formulaPreview" class="formula-preview" v-html="formulaPreview" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.formula-toolbar {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;

  .formula-header {
    margin-bottom: 8px;

    .formula-title {
      font-size: 13px;
      font-weight: 500;
      color: #303133;
    }
  }

  .formula-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .formula-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 40px;
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      background: #ecf5ff;
    }

    :deep(.katex) {
      font-size: 16px;
    }

    .formula-label {
      font-size: 10px;
      color: #909399;
      margin-top: 2px;
    }
  }

  .formula-custom {
    border-top: 1px solid #e4e7ed;
    padding-top: 12px;

    .formula-input-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;

      .el-input {
        flex: 1;
      }
    }

    .formula-error {
      color: #f56c6c;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .formula-preview {
      background: #fff;
      padding: 12px;
      border-radius: 4px;
      text-align: center;
      border: 1px solid #dcdfe6;

      :deep(.katex-display) {
        margin: 0;
      }
    }
  }
}
</style>
