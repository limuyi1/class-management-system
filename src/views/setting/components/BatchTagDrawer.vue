<script setup lang="ts">
/**
 * 批量打标签抽屉：逐学生展示并编辑标签，支持上一个/下一个切换、
 * 进度统计与保存，切换学生时自动保存当前编辑结果。
 */
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import type { BatchTagDrawerProps, BatchTagDrawerEmits } from '@/types/BatchTagDrawer'
import { NAME_PROP } from '@/constants'

const props = defineProps<BatchTagDrawerProps>()

const emit = defineEmits<BatchTagDrawerEmits>()

const settingStore = useSettingStore()
const { tagCategories: categories, tags: tagOptions } = storeToRefs(settingStore)

const currentIndex = ref(0)
const currentStudentTags = ref<Set<string>>(new Set())

/** 标签分类对应的主题色变量，按分类索引循环取色 */
const tagColorVars = [
  'var(--theme-tag-1)',
  'var(--theme-tag-2)',
  'var(--theme-tag-3)',
  'var(--theme-tag-4)',
  'var(--theme-tag-5)',
  'var(--theme-tag-6)',
  'var(--theme-tag-7)',
  'var(--theme-tag-8)'
]

/**
 * 根据分类名获取对应主题色。
 * @param category - 分类名
 * @returns 主题色 CSS 变量
 */
const getTagColor = (category: string) => {
  const catIndex = categories.value.findIndex((c) => c.label === category)
  return tagColorVars[Math.max(catIndex, 0) % tagColorVars.length]
}

/** 所有分类下的标签总数，用于判断是否展示空态 */
const totalTagCount = computed(() => {
  let count = 0
  for (const cat of categories.value) {
    const tags = tagOptions.value[cat.prop] || []
    count += tags.length
  }
  return count
})

/** 已打标签的学生数量 */
const taggedStudentCount = computed(() => {
  return props.studentList.filter((student) => {
    if (!student.tags) return false
    for (const [, tagList] of Object.entries(student.tags)) {
      if (Array.isArray(tagList) && tagList.length > 0) return true
    }
    return false
  }).length
})

/** 获取当前下标对应的学生 */
const getCurrentStudent = () => props.studentList[currentIndex.value]

/** 加载当前学生的标签到编辑集合 */
const loadCurrentStudentTags = () => {
  const student = getCurrentStudent()
  if (!student) return
  const tagSet = new Set<string>()
  if (student.tags) {
    for (const [, tagList] of Object.entries(student.tags)) {
      if (Array.isArray(tagList)) {
        tagList.forEach((tag: string) => tagSet.add(tag))
      }
    }
  }
  currentStudentTags.value = tagSet
}

/**
 * 切换单个标签的选中状态。
 * @param tag - 标签名
 */
const toggleTag = (tag: string) => {
  if (currentStudentTags.value.has(tag)) {
    currentStudentTags.value.delete(tag)
  } else {
    currentStudentTags.value.add(tag)
  }
}

/**
 * 判断标签是否已选中。
 * @param tag - 标签名
 * @returns 是否选中
 */
const isTagSelected = (tag: string) => currentStudentTags.value.has(tag)

/** 将当前编辑集合写回学生，并按标签所属分类重组结构 */
const saveCurrentTags = () => {
  const student = getCurrentStudent()
  if (!student) return

  const tags: Record<string, string[]> = {}
  currentStudentTags.value.forEach((tag) => {
    for (const cat of categories.value) {
      const catTags = tagOptions.value[cat.prop] || []
      if (catTags.includes(tag)) {
        if (!tags[cat.prop]) tags[cat.prop] = []
        tags[cat.prop].push(tag)
        break
      }
    }
  })

  // 仅在标签实际变化时写回，避免无意义更新
  const prevTags = JSON.stringify(student.tags || {})
  const newTags = JSON.stringify(tags)

  if (prevTags !== newTags) {
    student.tags = tags
  }
}

/** 保存当前学生编辑结果并通知父组件 */
const saveBatchProgress = () => {
  saveCurrentTags()
  emit('save', props.studentList)
}

/** 切换到上一个学生：先保存当前，再加载上一个学生的标签 */
const goToPrevStudent = () => {
  saveBatchProgress()
  if (currentIndex.value > 0) {
    currentIndex.value--
    loadCurrentStudentTags()
  }
}

/** 切换到下一个学生：先保存当前，再加载下一个学生的标签 */
const goToNextStudent = () => {
  saveBatchProgress()
  if (currentIndex.value < props.studentList.length - 1) {
    currentIndex.value++
    loadCurrentStudentTags()
  }
}

/** 取消关闭抽屉 */
const closeDrawer = () => {
  emit('update:visible', false)
}

/** 保存并关闭：写回当前学生后通知父组件确认 */
const confirmAndClose = () => {
  saveCurrentTags()
  emit('confirm', props.studentList)
  emit('update:visible', false)
}

/** 双向绑定的抽屉显隐状态 */
const drawerVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

// 抽屉打开时重置到第一个学生并加载其标签
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      currentIndex.value = 0
      loadCurrentStudentTags()
    }
  }
)
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="快捷打标签"
    direction="rtl"
    size="560px"
    :show-close="false"
    destroy-on-close
  >
    <div class="quick-tag-drawer">
      <div class="drawer-header">
        <el-button type="primary" link :disabled="studentList.length <= 1" @click="goToPrevStudent">
          <template #icon><font-awesome-icon :icon="['fas', 'chevron-left']" /></template>
          <span>上一个</span>
        </el-button>
        <span class="progress-text">{{ currentIndex + 1 }} / {{ studentList.length }}</span>
        <el-button type="primary" link :disabled="studentList.length <= 1" @click="goToNextStudent">
          <span>下一个</span>
          <font-awesome-icon :icon="['fas', 'chevron-right']" class="ml-1" />
        </el-button>
      </div>

      <div class="current-student">
        <span class="student-label">当前学生：</span>
        <span class="student-name">{{ getCurrentStudent()?.[NAME_PROP] || '' }}</span>
      </div>

      <div class="tags-section">
        <div v-if="totalTagCount === 0" class="empty-tags-tip" @click="emit('goTab', 'label-maintenance')">
          <font-awesome-icon :icon="['fas', 'tag']" />
          <span>暂无标签，点击添加</span>
        </div>
        <div v-else v-for="cat in categories" :key="cat.prop" class="tag-category">
          <div class="category-name">{{ cat.label }}</div>
          <div class="category-tags">
            <el-tag
              v-for="tag in tagOptions[cat.prop] || []"
              :key="tag"
              :effect="isTagSelected(tag) ? 'dark' : 'plain'"
              :color="isTagSelected(tag) ? getTagColor(cat.label) : undefined"
              class="tag-item"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </div>

      <div class="progress-info">
        <span>已标记：{{ taggedStudentCount }} 人</span>
        <el-progress
          :percentage="Math.round((taggedStudentCount / studentList.length) * 100)"
          :stroke-width="6"
          :show-text="false"
          class="progress-bar"
        />
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="closeDrawer">取消</el-button>
        <el-button type="primary" @click="confirmAndClose">保存并关闭</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.quick-tag-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid #e4e7ed;
  }

  .progress-text {
    font-size: 15px;
    color: #303133;
  }

  .current-student {
    padding: 18px 0;
    border-bottom: 1px solid #e4e7ed;
    font-size: 15px;

    .student-label {
      color: #909399;
    }

    .student-name {
      color: #303133;
      font-weight: 600;
      font-size: 18px;
    }
  }

  .tags-section {
    flex: 1;
    overflow-y: auto;
    padding: 20px 0;

    .empty-tags-tip {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 0;
      color: #909399;
      cursor: pointer;

      svg {
        font-size: 32px;
        margin-bottom: 8px;
      }
    }

    .tag-category {
      margin-bottom: 22px;

      .category-name {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 12px;
      }

      .category-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 12px;

        .tag-item {
          cursor: pointer;
          min-height: 34px;
          padding: 0 14px;
          margin-bottom: 4px;
          font-size: 15px;
          line-height: 32px;
        }
      }
    }
  }

  .progress-info {
    padding-top: 14px;
    border-top: 1px solid #e4e7ed;
    font-size: 15px;
    color: #606266;

    .progress-bar {
      margin-top: 8px;
    }
  }
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
