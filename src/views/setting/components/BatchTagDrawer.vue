<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import type { BatchTagDrawerProps, BatchTagDrawerEmits } from '@/types/BatchTagDrawer'
import { NAME_PROP } from '@/types/Constants'

const props = defineProps<BatchTagDrawerProps>()

const emit = defineEmits<BatchTagDrawerEmits>()

const settingStore = useSettingStore()
const { tagCategory: categories, tags: tagOptions } = storeToRefs(settingStore)

const currentIndex = ref(0)
const currentStudentTags = ref<Set<string>>(new Set())

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

const getTagColor = (category: string) => {
  const catIndex = categories.value.findIndex((c) => c.label === category)
  return tagColorVars[catIndex % tagColorVars.length]
}

const totalTagCount = computed(() => {
  let count = 0
  for (const cat of categories.value) {
    const tags = tagOptions.value[cat.prop] || []
    count += tags.length
  }
  return count
})

const taggedStudentCount = computed(() => {
  return props.studentList.filter((student) => {
    if (!student.tags) return false
    for (const [, tagList] of Object.entries(student.tags)) {
      if (Array.isArray(tagList) && tagList.length > 0) return true
    }
    return false
  }).length
})

const getCurrentStudent = () => props.studentList[currentIndex.value]

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

const toggleTag = (tag: string) => {
  if (currentStudentTags.value.has(tag)) {
    currentStudentTags.value.delete(tag)
  } else {
    currentStudentTags.value.add(tag)
  }
}

const isTagSelected = (tag: string) => currentStudentTags.value.has(tag)

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

  const prevTags = JSON.stringify(student.tags || {})
  const newTags = JSON.stringify(tags)

  if (prevTags !== newTags) {
    student.tags = tags
  }
}

const goToPrevStudent = () => {
  saveCurrentTags()
  if (currentIndex.value > 0) {
    currentIndex.value--
    loadCurrentStudentTags()
  }
}

const goToNextStudent = () => {
  saveCurrentTags()
  if (currentIndex.value < props.studentList.length - 1) {
    currentIndex.value++
    loadCurrentStudentTags()
  }
}

const closeDrawer = () => {
  emit('update:visible', false)
}

const confirmAndClose = () => {
  saveCurrentTags()
  emit('confirm', props.studentList)
  emit('update:visible', false)
}

const drawerVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

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
    size="420px"
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
    font-size: 14px;
    color: #303133;
  }

  .current-student {
    padding: 16px 0;
    border-bottom: 1px solid #e4e7ed;

    .student-label {
      color: #909399;
    }

    .student-name {
      color: #303133;
      font-weight: 600;
    }
  }

  .tags-section {
    flex: 1;
    overflow-y: auto;
    padding: 16px 0;

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
      margin-bottom: 16px;

      .category-name {
        font-size: 14px;
        font-weight: 600;
        color: #303133;
        margin-bottom: 8px;
      }

      .category-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .tag-item {
          cursor: pointer;
          margin-bottom: 4px;
        }
      }
    }
  }

  .progress-info {
    padding-top: 12px;
    border-top: 1px solid #e4e7ed;
    font-size: 14px;
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
