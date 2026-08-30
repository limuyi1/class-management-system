<script setup lang="ts">
/**
 * AI 配置组件：配置 AI 品牌、模型、API Key、Base URL，
 * 支持拉取可用模型、测试连接，并维护各类提示词的默认值重置。
 */
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useAIConfigStore } from '@/stores/ai-config'
import { featureFlags } from '@/config/features'
import { AIModelTypeEnum, AIModelTypeLabels, DefaultAIPrompts } from '@/types/AIConfig'
import { testAIConnection, fetchAvailableModels } from '@/ai/aiService'

import type { FormInstance, FormRules } from 'element-plus'
import type { AIPromptsType } from '@/types/AIConfig'

const store = useAIConfigStore()
const { modelType, model, apiKey, baseUrl, prompts, availableModels } = storeToRefs(store)

const showApiKey = ref(false) // 是否明文显示 API Key
const testing = ref(false) // 连接测试进行中
const fetchingModels = ref(false) // 模型列表拉取中
const activePromptTab = ref<keyof AIPromptsType>('singleComment') // 当前激活的提示词标签页
const aiConfigFormRef = ref<FormInstance>() // 表单实例引用，用于字段校验

/** API Key 表单校验规则：必填且不能为空白 */
const aiConfigFormRules: FormRules = {
  apiKey: [
    {
      required: true,
      type: 'string',
      whitespace: true,
      message: '请输入 API Key',
      trigger: ['blur', 'change']
    }
  ]
}

/** AI 品牌下拉选项，由枚举标签映射而来 */
const modelOptions = Object.entries(AIModelTypeLabels).map(([value, label]) => ({
  value: value as AIModelTypeEnum,
  label
}))

/** 提示词标签页配置，包含标签名与默认占位内容 */
const promptTabs: Array<{
  key: keyof AIPromptsType
  label: string
  placeholder: string
}> = [
  { key: 'singleComment', label: '单个评语', placeholder: DefaultAIPrompts.singleComment },
  { key: 'batchComment', label: '批量评语', placeholder: DefaultAIPrompts.batchComment },
  {
    key: 'singleCommentPolish',
    label: '单个润色',
    placeholder: DefaultAIPrompts.singleCommentPolish
  },
  {
    key: 'batchCommentPolish',
    label: '批量润色',
    placeholder: DefaultAIPrompts.batchCommentPolish
  },
  { key: 'imageScore', label: '图片识别', placeholder: DefaultAIPrompts.imageScore },
  {
    key: 'tagCategoryGenerate',
    label: '分类生成',
    placeholder: DefaultAIPrompts.tagCategoryGenerate
  },
  { key: 'tagGenerate', label: '标签生成', placeholder: DefaultAIPrompts.tagGenerate },
  // 错题本功能开启时追加 AI 答题提示词
  ...(featureFlags.wrongBook
    ? [
        {
          key: 'answerGenerate' as const,
          label: 'AI答题',
          placeholder: DefaultAIPrompts.answerGenerate
        }
      ]
    : []),
  { key: 'learningAnalysis', label: '学情分析', placeholder: DefaultAIPrompts.learningAnalysis },
  {
    key: 'scoreNoticeSingleComment',
    label: '通知单评',
    placeholder: DefaultAIPrompts.scoreNoticeSingleComment
  },
  {
    key: 'scoreNoticeBatchComment',
    label: '通知批评',
    placeholder: DefaultAIPrompts.scoreNoticeBatchComment
  }
]

/**
 * AI 品牌切换处理：更新品牌并尝试重新拉取可用模型列表。
 * @param val - 新品牌
 */
const handleModelChange = async (val: AIModelTypeEnum) => {
  store.setModelType(val)

  if (!apiKey.value.trim()) return

  fetchingModels.value = true
  try {
    const models = await fetchAvailableModels({
      modelType: val,
      model: '',
      apiKey: apiKey.value,
      baseUrl: baseUrl.value
    })
    if (models.length > 0) {
      store.setAvailableModels(models)
    }
  } catch (error) {
    console.error('Failed to fetch models:', error)
  } finally {
    fetchingModels.value = false
  }
}

/**
 * 校验 API Key 是否填写有效。
 * @returns 是否校验通过
 */
const validateApiKey = async (): Promise<boolean> => {
  if (!aiConfigFormRef.value) {
    return apiKey.value.trim().length > 0
  }

  try {
    await aiConfigFormRef.value.validateField('apiKey')
    return true
  } catch {
    return false
  }
}

/** 拉取可用模型：校验通过后请求并选中首个模型 */
const handleFetchModels = async () => {
  if (!(await validateApiKey())) return

  fetchingModels.value = true
  try {
    const models = await fetchAvailableModels({
      modelType: modelType.value,
      model: model.value,
      apiKey: apiKey.value,
      baseUrl: baseUrl.value
    })
    if (models.length > 0) {
      store.setAvailableModels(models)
      store.setModel(models[0])
      ElMessage.success(`获取成功，共 ${models.length} 个模型`)
    } else {
      ElMessage.warning('未获取到模型，请检查 API Key')
    }
  } catch (error) {
    console.error('Failed to fetch models:', error)
    ElMessage.error('获取模型失败')
  } finally {
    fetchingModels.value = false
  }
}

/** 测试当前 AI 配置的连接是否可用 */
const handleTestConnection = async () => {
  if (!(await validateApiKey())) return

  testing.value = true
  try {
    const result = await testAIConnection({
      modelType: modelType.value,
      model: model.value,
      apiKey: apiKey.value,
      baseUrl: baseUrl.value
    })
    if (result) {
      ElMessage.success('连接成功！')
    } else {
      ElMessage.error('连接失败，请检查配置')
    }
  } catch (error) {
    ElMessage.error('连接失败：' + (error as Error).message)
  } finally {
    testing.value = false
  }
}

/**
 * 重置单个提示词为默认值。
 * @param promptKey - 提示词键
 * @param label - 提示词展示名
 */
const handleResetPrompt = (promptKey: keyof AIPromptsType, label: string) => {
  store.resetPrompt(promptKey)
  ElMessage.success(`${label}提示词已重置为默认值`)
}

/** 重置全部提示词为默认值（需二次确认） */
const handleResetAllPrompts = async (): Promise<void> => {
  try {
    await ElMessageBox.confirm(
      '将覆盖所有自定义提示词并恢复为默认值，此操作无法撤销。确定继续吗？',
      '重置全部提示词',
      {
        confirmButtonText: '重置全部',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    store.resetPrompts()
    ElMessage.success('所有提示词已重置为默认值')
  } catch {
    // 用户取消时保持当前提示词不变
  }
}
</script>

<template>
  <div class="ai-configuration">
    <el-row :gutter="16">
      <el-col :span="8">
        <!-- 左侧卡片：AI 模型与连接配置 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <font-awesome-icon :icon="['solid', 'robot']" />
              <span>AI 模型配置</span>
            </div>
          </template>

          <el-form
            ref="aiConfigFormRef"
            :model="store"
            :rules="aiConfigFormRules"
            label-position="top"
          >
            <el-form-item label="AI 品牌">
              <el-select
                v-model="modelType"
                style="width: 100%"
                placeholder="选择 AI 品牌"
                @change="handleModelChange"
              >
                <el-option
                  v-for="item in modelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="具体模型">
              <div class="model-select-wrapper">
                <el-select
                  v-model="model"
                  style="width: 100%"
                  placeholder="点击刷新获取模型"
                  :loading="fetchingModels"
                  allow-create
                  filterable
                  default-first-option
                  @change="(val: string) => store.setModel(val)"
                >
                  <el-option
                    v-for="item in availableModels"
                    :key="item"
                    :label="item"
                    :value="item"
                  />
                </el-select>
                <el-tooltip content="刷新模型列表" placement="top">
                  <el-button
                    size="small"
                    circle
                    :loading="fetchingModels"
                    @click="handleFetchModels"
                  >
                    <template #icon><font-awesome-icon :icon="['solid', 'rotate']" /></template>
                  </el-button>
                </el-tooltip>
              </div>
            </el-form-item>

            <el-form-item label="API Key" prop="apiKey">
              <el-input
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="请输入 API Key"
              >
                <template #suffix>
                  <font-awesome-icon
                    :icon="showApiKey ? ['far', 'eye-slash'] : ['far', 'eye']"
                    class="eye-icon"
                    @click="showApiKey = !showApiKey"
                  />
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="Base URL（可选）">
              <el-input v-model="baseUrl" placeholder="留空使用默认地址" />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="testing"
                @click="handleTestConnection"
                style="width: 100%"
              >
                <template #icon><font-awesome-icon :icon="['solid', 'plug']" /></template>
                测试连接
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="16">
        <!-- 右侧卡片：各类提示词编辑与重置 -->
        <el-card class="prompt-card">
          <template #header>
            <div class="card-header prompt-card-header">
              <div class="prompt-card-header__title">
                <font-awesome-icon :icon="['solid', 'file-lines']" />
                <span>提示词配置</span>
              </div>
              <el-button type="danger" size="small" plain @click="handleResetAllPrompts">
                <template #icon>
                  <font-awesome-icon :icon="['solid', 'rotate-left']" />
                </template>
                重置全部
              </el-button>
            </div>
          </template>

          <el-tabs v-model="activePromptTab" class="prompt-tabs">
            <el-tab-pane
              v-for="tab in promptTabs"
              :key="tab.key"
              :name="tab.key"
              :label="tab.label"
            >
              <div class="prompt-editor-toolbar">
                <el-button
                  type="primary"
                  size="small"
                  text
                  @click="handleResetPrompt(tab.key, tab.label)"
                >
                  <template #icon><font-awesome-icon :icon="['solid', 'rotate-left']" /></template>
                  重置
                </el-button>
              </div>
              <el-input
                v-model="prompts[tab.key]"
                type="textarea"
                :rows="10"
                :placeholder="tab.placeholder"
              />
            </el-tab-pane>
          </el-tabs>

          <!-- 提示词占位变量说明，帮助用户编写自定义提示词 -->
          <div class="prompt-tips">
            <div class="tip-title">提示：</div>
            <div class="tip-item">
              • <code v-pre>{{ name }}</code> - 学生姓名
            </div>
            <div class="tip-item">
              • <code v-pre>{{ tags }}</code> - 单个评语为学生标签；批量评语为轻量化标签短字符串
            </div>
            <div class="tip-item">
              • <code v-pre>{{ comment }}</code> - 单个润色的当前已有评语
            </div>
            <div class="tip-item">
              单个/批量期末评语默认不使用成绩字段，请围绕学生标签和学期表现编写提示词
            </div>
            <div class="tip-item">
              • <code v-pre>{{ students }}</code> - 批量学生数据（JSON数组）
            </div>
            <div class="tip-item">
              • <code v-pre>{{ category }}</code> - 标签分类名称
            </div>
            <div class="tip-item">
              • <code v-pre>{{ count }}</code> - 生成数量
            </div>
            <div class="tip-item">
              • <code v-pre>{{ requirement }}</code> - 自定义生成要求
            </div>
            <div class="tip-item">
              • <code v-pre>{{ dashboard }}</code> - 班级总览数据（JSON对象）
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.ai-configuration {
  padding: 16px;
  height: 100%;
  overflow-y: auto;

  .el-row {
    height: 100%;
  }

  .el-col {
    height: 100%;
  }
}

.config-card {
  border-radius: 10px;
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    svg {
      color: var(--theme-primary);
    }
  }

  :deep(.el-card__body) {
    padding-top: 12px;
  }

  .model-select-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;

    :deep(.el-select) {
      flex: 1;
      width: auto;
    }

    .el-button {
      flex-shrink: 0;
    }
  }
}

.prompt-card {
  border-radius: 10px;
  height: 100%;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;

    svg {
      color: var(--theme-primary);
    }
  }

  .prompt-card-header {
    justify-content: space-between;

    &__title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .prompt-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 12px;
    }
  }

  .prompt-editor-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
  }

  .prompt-tips {
    margin-top: 12px;
    padding: 12px;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 12px;
    color: #64748b;

    .tip-title {
      font-weight: 600;
      margin-bottom: 6px;
    }

    .tip-item {
      margin-bottom: 4px;

      code {
        background: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        color: #475569;
      }
    }
  }
}

.eye-icon {
  cursor: pointer;
  color: #94a3b8;
  font-size: 14px;

  &:hover {
    color: #64748b;
  }
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #475569;
}
</style>
