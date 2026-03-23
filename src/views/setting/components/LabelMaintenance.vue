<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { pinyin } from 'pinyin-pro'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useSettingStore } from '@/stores/setting'

import { ElMessageBox, type InputInstance } from 'element-plus'
import type { TagCategoryType } from '@/types/Setting'

const store = useSettingStore()

const { tagCategory: list, tags } = storeToRefs(store)

const InputRef = ref<InputInstance>()
const inputValue = ref('')
const inputVisible = ref(false)
const activeCategory = ref(list.value[0]?.prop || '')

const currentTags = computed(() => {
  return tags.value[activeCategory.value] || []
})

const selectCategory = (item: TagCategoryType) => {
  activeCategory.value = item.prop
}

const addCategory = () => {
  ElMessageBox.prompt('', '请输入新的字典分类', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(({ value }) => {
      const newCategory = {
        prop: pinyin(value, { toneType: 'num', type: 'array' }).join('_'),
        label: value
      }
      list.value.push(newCategory)
      if (list.value.length === 1) {
        activeCategory.value = newCategory.prop
      }
      inputValue.value = ''
    })
    .catch(() => {})
}

const removeCategory = (item: TagCategoryType) => {
  list.value.splice(list.value.indexOf(item), 1)
  delete tags.value[item.prop]
  activeCategory.value = ''
}

const handleClose = (tag: string) => {
  const categoryTags = tags.value[activeCategory.value]
  if (categoryTags) {
    categoryTags.splice(categoryTags.indexOf(tag), 1)
  }
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    InputRef.value!.input!.focus()
  })
}

const handleInputConfirm = () => {
  if (inputValue.value) {
    if (!tags.value[activeCategory.value]) {
      tags.value[activeCategory.value] = []
    }
    tags.value[activeCategory.value].push(inputValue.value)
  }
  inputVisible.value = false
  inputValue.value = ''
}
</script>

<template>
  <div class="label-maintenance__wrapper">
    <div class="label-maintenance-aside">
      <div class="label-maintenance-aside-header">
        <div class="label-maintenance-aside-title">字典分类</div>
        <el-tooltip effect="dark" content="新增分类" placement="top">
          <el-button type="primary" circle size="small" @click="addCategory">
            <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
          </el-button>
        </el-tooltip>
      </div>
      <div
        :class="{
          'label-maintenance-aside-item': true,
          active: activeCategory === item.prop
        }"
        v-for="item in list"
        :key="item.prop"
        @click="selectCategory(item)"
      >
        <span class="item-label">{{ item.label }}</span>
        <el-popconfirm title="确认要删除吗？" placement="top" @confirm="removeCategory(item)">
          <template #reference>
            <div><font-awesome-icon class="item-icon" :icon="['solid', 'trash']" /></div>
          </template>
        </el-popconfirm>
      </div>
    </div>
    <div class="label-maintenance-main">
      <div class="label-maintenance-main-title">
        {{ list.find((item) => item.prop === activeCategory)?.label || '标签' }}
      </div>
      <div class="label-maintenance-main-tags" v-if="activeCategory">
        <el-tag
          v-for="tag in currentTags"
          :key="tag"
          effect="light"
          size="large"
          closable
          @close="handleClose(tag)"
        >
          {{ tag }}
        </el-tag>
        <el-input
          class="w-[150px]!"
          v-if="inputVisible"
          ref="InputRef"
          v-model="inputValue"
          @keyup.enter="handleInputConfirm"
          @blur="handleInputConfirm"
        />
        <el-button v-else dashed @click="showInput">
          <font-awesome-icon :icon="['solid', 'plus']" />
          <span>添加标签</span>
        </el-button>
      </div>
      <div class="label-maintenance-main-empty" v-else>请先添加字典分类</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.label-maintenance__wrapper {
  display: flex;
  height: 100%;
  width: 100%;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;

  .label-maintenance-aside {
    height: 100%;
    width: 200px;
    border-right: 1px solid #e2e8f0;
    background: #fcfcfc;
    border-radius: 8px 0 0 8px;
    padding: 12px;

    .label-maintenance-aside-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .label-maintenance-aside-title {
      height: 32px;
      font-size: 18px;
      font-weight: 700;
      line-height: 32px;
      color: rgba(0, 0, 0, 0.85);
    }

    .label-maintenance-aside-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      height: 40px;
      cursor: pointer;
      border-bottom: 1px solid rgba(226, 232, 240, 0.85);
      font-size: 16px;
      font-weight: 400;
      color: rgba(0, 0, 0, 0.85);
      padding: 0 8px;

      .item-label {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-icon {
        margin-left: 8px;
        outline: none;
      }

      &:hover {
        background-color: #f5f5f5;
        color: var(--el-color-primary);
      }
    }

    .label-maintenance-aside-item.active {
      background-color: #ecf5ff;
      color: var(--el-color-primary);
    }

    .label-maintenance-aside-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 3px;
      height: 100%;
      background-color: var(--el-color-primary);
    }
  }

  .label-maintenance-main {
    flex: 1;
    padding: 16px;

    .label-maintenance-main-title {
      height: 32px;
      font-size: 18px;
      font-weight: 700;
      line-height: 32px;
      color: rgba(0, 0, 0, 0.85);
      margin-bottom: 16px;
    }

    .label-maintenance-main-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .label-maintenance-main-empty {
      color: #909399;
      font-size: 14px;
    }
  }
}
</style>
