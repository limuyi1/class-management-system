<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'

import { useAIConfigStore } from '@/stores/ai-config'
import { AIModelTypeEnum, AIModelTypeLabels, DefaultAIPrompts } from '@/types/AIConfig'
import { testAIConnection, fetchAvailableModels } from '@/ai/aiService'

const store = useAIConfigStore()
const { modelType, model, apiKey, baseUrl, prompts, availableModels } = storeToRefs(store)

const showApiKey = ref(false)
const testing = ref(false)
const fetchingModels = ref(false)
const activePromptTab = ref('singleComment')

const modelOptions = Object.entries(AIModelTypeLabels).map(([value, label]) => ({
  value: value as AIModelTypeEnum,
  label
}))

const promptTabs = [
  { key: 'singleComment', label: '单个评语', placeholder: DefaultAIPrompts.singleComment },
  { key: 'batchComment', label: '批量评语', placeholder: DefaultAIPrompts.batchComment },
  { key: 'imageScore', label: '图片识别', placeholder: DefaultAIPrompts.imageScore },
  { key: 'tagGenerate', label: '标签生成', placeholder: DefaultAIPrompts.tagGenerate },
  { key: 'answerGenerate', label: 'AI答题', placeholder: DefaultAIPrompts.answerGenerate },
  { key: 'learningAnalysis', label: '学情分析', placeholder: DefaultAIPrompts.learningAnalysis }
]

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

const handleFetchModels = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请先输入 API Key')
    return
  }

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

const handleTestConnection = async () => {
  if (!apiKey.value.trim()) {
    ElMessage.warning('请先输入 API Key')
    return
  }

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

const handleResetPrompt = () => {
  store.resetPrompts()
  ElMessage.success('提示词已重置为默认值')
}
</script>

<template>
  <div class="ai-configuration">
    <el-row :gutter="16">
      <el-col :span="8">
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <font-awesome-icon :icon="['solid', 'robot']" />
              <span>AI 模型配置</span>
            </div>
          </template>

          <el-form label-position="top" class="compact-form">
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

            <el-form-item label="API Key">
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
        <el-card class="prompt-card">
          <template #header>
            <div class="card-header">
              <font-awesome-icon :icon="['solid', 'file-lines']" />
              <span>提示词配置</span>
              <el-button type="primary" size="small" text @click="handleResetPrompt">
                <template #icon><font-awesome-icon :icon="['solid', 'rotate-left']" /></template>
                重置
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
              <el-input
                v-model="prompts[tab.key as keyof typeof prompts]"
                type="textarea"
                :rows="10"
                :placeholder="tab.placeholder"
              />
            </el-tab-pane>
          </el-tabs>

          <div class="prompt-tips">
            <div class="tip-title">提示：</div>
            <div class="tip-item">
              • <code v-pre>{{ name }}</code> - 学生姓名
            </div>
            <div class="tip-item">
              • <code v-pre>{{ tags }}</code> - 学生标签（数组）
            </div>
            <div class="tip-item">
              • <code v-pre>{{ score }}</code> - 成绩数组，建议按 <code>{`{ label, value }`}</code> 理解
            </div>
            <div class="tip-item">
              批量结构示例：<code>[{`{ label: '第一次月考', value: 82 }`}]</code>
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

  .compact-form {
    :deep(.el-form-item) {
      margin-bottom: 12px;
    }

    :deep(.el-form-item__label) {
      padding-bottom: 4px;
      font-size: 12px;
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

    .el-button {
      margin-left: auto;
    }
  }

  .prompt-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 12px;
    }
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
