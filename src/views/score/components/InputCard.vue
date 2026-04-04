<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { match } from 'pinyin-pro'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

import { useEnterUp } from '@/hooks/useEnterUp'
import { useDataSourceStore } from '@/stores/data-source'
import { useConfigurationStore } from '@/stores/configuration'
import { useSettingStore } from '@/stores/setting'
import { useAIConfigStore } from '@/stores/ai-config'
import { generateSingleComment } from '@/ai/aiService'

import { InputEnum } from '@/types/Common'

const router = useRouter()

/**
 * 输入卡片属性
 * @property type - 输入类型，SCORE 表示分数录入，COMMENT 表示评语录入
 */
interface Props {
  type?: InputEnum
}
const props = withDefaults(defineProps<Props>(), {
  type: InputEnum.SCORE
})

const emit = defineEmits(['scroll'])

const store = useDataSourceStore()
const { items: originList } = storeToRefs(store)
const configuration = useConfigurationStore()
const settingStore = useSettingStore()
const { tagCategory: tagCategoryList } = storeToRefs(settingStore)
const aiConfigStore = useAIConfigStore()

const generating = ref(false)

/**
 * 当前选中学生的标签
 * 从学生数据的 tags 字段读取，格式：{ [分类prop]: [标签数组] }
 * 没有 tags 字段时返回空对象，保证标签区域能够正常显示
 */
const currentStudentTags = computed(() => {
  if (!formData.id) return null
  const item = originList.value[formData.id - 1]
  return item?.tags || {}
})

/**
 * 当前学生是否有任何标签
 * 遍历所有标签分类，检查是否有任何标签被设置
 */
const hasAnyTags = computed(() => {
  const tags = currentStudentTags.value
  if (!tags || Object.keys(tags).length === 0) return false
  for (const cat of tagCategoryList.value) {
    const tagList = tags[cat.prop]
    if (tagList && tagList.length > 0) return true
  }
  return false
})

const handleGenerateComment = async () => {
  if (!formData.id) return

  if (!aiConfigStore.isConfigured) {
    ElMessage.warning('请先在设置页面配置 AI')
    return
  }

  generating.value = true
  try {
    const item = originList.value[formData.id - 1]
    const allTags: string[] = []
    for (const cat of tagCategoryList.value) {
      const tagList = item.tags?.[cat.prop]
      if (tagList && tagList.length > 0) {
        allTags.push(...tagList)
      }
    }

    const student = {
      name: item.xing4_ming2,
      tags: allTags,
      score: configuration.inputScoreTab ? item[configuration.inputScoreTab] : undefined
    }

    const comment = await generateSingleComment(student, aiConfigStore.prompts.singleComment, {
      modelType: aiConfigStore.modelType,
      model: aiConfigStore.model,
      apiKey: aiConfigStore.apiKey,
      baseUrl: aiConfigStore.baseUrl
    })

    formData.comment = comment
    ElMessage.success('评语生成成功')
  } catch (error) {
    console.error('生成评语失败:', error)
    ElMessage.error('生成评语失败：' + (error as Error).message)
  } finally {
    generating.value = false
  }
}

/**
 * 跳转到设置页面编辑标签
 * 打开对应学生的单行标签编辑dialog
 */
const goToEditTags = () => {
  if (!formData.name) return
  router.push({
    path: '/setting',
    query: {
      tab: 'student-info',
      'edit-tags': '1',
      'student-name': formData.name
    }
  })
}

const options = ref<any[]>([])
const nameInputRef = ref()
const scoreInputRef = ref()
const commentInputRef = ref()

/**
 * 表单数据
 * 包含：id（学生索引）, name（姓名）, score（分数）, comment（评语）
 */
const formData = reactive({
  id: null as number | null,
  name: '',
  score: null as number | null,
  comment: null as string | null
})

/**
 * 当前选中的学生索引
 * 用于回车提交时定位学生数据
 */
const currentSelectedIndex = ref<number | null>(null)

onMounted(() => {
  autoFocus()
})

/**
 * 自动聚焦到姓名输入框
 * 组件挂载时自动聚焦，方便用户直接输入
 */
const autoFocus = () => {
  nameInputRef.value.focus()
}

/**
 * 远程搜索方法 - 拼音模糊匹配学生姓名
 * 使用 pinyin-pro 库实现中文拼音匹配
 * @param query - 输入的搜索关键词
 */
const remoteMethod = (query: string) => {
  if (query) {
    options.value = originList.value.filter(
      (item: any) => item.xing4_ming2.includes(query) || match(item.xing4_ming2, query)?.length
    )
  } else {
    options.value = []
  }
}

/**
 * 填充学生数据到表单
 * 选中或回车选择学生后，自动填充该学生的已有数据并聚焦到对应输入框
 * @param index - 选中的学生索引（1-based），可能为 null
 */
const fillStudentData = (index: number | null) => {
  if (!index) return
  const item = originList.value[index - 1]

  formData.id = index
  formData.name = item.xing4_ming2
  formData.score = configuration.inputScoreTab ? item[configuration.inputScoreTab] : null
  formData.comment = item.comment || null

  emit('scroll', index)

  if (props.type === InputEnum.COMMENT) {
    commentInputRef.value?.focus()
  } else {
    scoreInputRef.value?.focus()
  }
}

/**
 * 选择学生后的处理
 * 记录当前选中的学生索引，并填充数据到表单
 * @param index - 选中的学生索引（1-based）
 */
const selectChange = (index: number) => {
  currentSelectedIndex.value = index
  fillStudentData(index)
}

/**
 * 回车键提交处理
 * 选中学生后按回车，填充该学生的已有数据
 */
useEnterUp('stuName', () => {
  fillStudentData(currentSelectedIndex.value)
})

/**
 * 提交分数或评语
 * 将表单数据保存到学生数据中，并重置表单状态
 */
const onSubmit = () => {
  if (!formData.id) return

  const item = originList.value[formData.id - 1]

  // 设置分数
  if (props.type === InputEnum.SCORE && configuration.inputScoreTab) {
    item[configuration.inputScoreTab] = formData.score
  }

  // 设置评语
  if (props.type === InputEnum.COMMENT) {
    item.comment = formData.comment === '' ? null : formData.comment
  }

  // 删除已选中的选项
  formData.id = null
  formData.name = ''
  formData.score = null
  formData.comment = null
  options.value = []

  // 重新聚焦到姓名输入框
  nameInputRef.value.focus()
}

/**
 * 编辑已有数据
 * 从表格行点击触发，加载对应学生的数据到表单
 * @param data - 学生行数据对象
 */
const editData = (data: any) => {
  remoteMethod(data.xing4_ming2)

  // 找到对应的行号
  const rowIndex = originList.value.findIndex((item: any) => item === data)

  formData.id = rowIndex + 1
  formData.name = data.xing4_ming2
  formData.score = configuration.inputScoreTab ? data[configuration.inputScoreTab] : null
  formData.comment = data.comment || null

  // 根据类型聚焦到对应输入框
  if (props.type === InputEnum.COMMENT) {
    commentInputRef.value?.focus()
  } else {
    scoreInputRef.value?.focus()
  }
}

defineExpose({ editData, autoFocus })
</script>

<template>
  <div class="input-card">
    <div class="card-header">
      <font-awesome-icon :icon="['solid', 'pen-to-square']" />
      <span>{{ props.type === InputEnum.SCORE ? '输入分数' : '填写评语' }}</span>
    </div>
    <div class="card-body">
      <el-form ref="form" label-position="top" :model="formData">
        <el-form-item label="学生姓名">
          <el-select
            ref="nameInputRef"
            name="stuName"
            style="width: 100%"
            v-model="formData.id"
            size="default"
            placeholder="搜索学生姓名..."
            filterable
            remote
            :remote-method="remoteMethod"
            @change="selectChange"
          >
            <el-option
              v-for="(item, index) in options"
              :key="index"
              :label="item.xing4_ming2"
              :value="originList.indexOf(item) + 1"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="props.type === InputEnum.SCORE" label="考试成绩">
          <el-input-number
            ref="scoreInputRef"
            style="width: 100%"
            v-model.number="formData.score"
            size="default"
            :min="0"
            :max="100"
            :precision="1"
            :disabled="!formData.id"
            placeholder="0~100分"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item
          v-if="props.type === InputEnum.COMMENT && currentStudentTags"
          label="学生标签"
        >
          <div v-if="hasAnyTags" class="student-tags" @click="goToEditTags">
            <div
              v-for="cat in tagCategoryList.filter((c) => currentStudentTags[c.prop]?.length)"
              :key="cat.prop"
              class="tag-category"
            >
              <span class="category-label">{{ cat.label }}：</span>
              <el-tag
                v-for="tag in currentStudentTags[cat.prop]"
                :key="tag"
                size="small"
                type="success"
                class="student-tag"
              >
                {{ tag }}
              </el-tag>
            </div>
          </div>
          <div v-else class="empty-tags-tip" @click="goToEditTags">
            <font-awesome-icon :icon="['fas', 'exclamation-circle']" />
            <span>暂无标签，点击添加</span>
          </div>
        </el-form-item>
        <el-form-item v-if="props.type === InputEnum.COMMENT" label="学生评语">
          <el-input
            ref="commentInputRef"
            style="width: 100%"
            v-model.trim="formData.comment"
            size="default"
            type="textarea"
            maxlength="500"
            show-word-limit
            placeholder="请输入对学生的评价..."
            :rows="3"
            :disabled="!formData.id"
          />
        </el-form-item>
        <el-form-item v-if="props.type === InputEnum.COMMENT">
          <el-tooltip
            :disabled="!formData.id || hasAnyTags"
            :content="formData.id && !hasAnyTags ? '该学生暂无标签，请先在设置页面添加标签' : ''"
            placement="top"
          >
            <div style="width: 100%">
              <el-button
                class="ai-generate-btn"
                style="width: 100%"
                size="default"
                round
                :disabled="!formData.id || !hasAnyTags"
                :loading="generating"
                @click="handleGenerateComment"
              >
                <template #icon
                  ><font-awesome-icon :icon="['solid', 'wand-magic-sparkles']"
                /></template>
                AI 生成评语
              </el-button>
            </div>
          </el-tooltip>
        </el-form-item>
        <el-form-item>
          <el-button
            class="submit-btn"
            style="width: 100%"
            type="primary"
            size="default"
            round
            :disabled="!formData.id"
            @click="onSubmit"
          >
            <template #icon><font-awesome-icon :icon="['solid', 'paper-plane']" /></template>
            提 交
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.input-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  .card-body {
    padding: 10px 12px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--theme-gradient);
  color: #fff;
  font-size: 13px;
  font-weight: 600;

  svg {
    font-size: 14px;
  }
}

.submit-btn {
  height: 36px;
  font-size: 14px;
  background: var(--theme-gradient);
  border: none;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: #cbd5e1;
  }
}

.ai-generate-btn {
  height: 36px;
  font-size: 14px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border: none;
  color: #fff;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: #cbd5e1;
    color: #94a3b8;
  }

  svg {
    margin-right: 4px;
  }
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #64748b;
  font-size: 12px;
}

:deep(.el-form-item) {
  margin-bottom: 10px;
}

:deep(.el-select__wrapper),
:deep(.el-input-number) {
  border-radius: 6px;
}

:deep(.el-textarea__inner) {
  border-radius: 6px;
}

.student-tags {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f8fafc;
  border-radius: 6px;
  padding: 8px 10px;

  .tag-category {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 12px;

    .category-label {
      color: #64748b;
      font-weight: 500;
      min-width: 42px;
    }

    .student-tag {
      margin-right: 0;
    }

    .no-tag {
      color: #94a3b8;
      font-size: 11px;
    }
  }
}

.empty-tags-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #fef3c7;
  border: 1px dashed #f59e0b;
  border-radius: 6px;
  color: #d97706;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #fde68a;
    border-color: #f59e0b;
  }

  svg {
    font-size: 14px;
  }
}
</style>
