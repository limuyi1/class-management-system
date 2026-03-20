<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { pinyin } from 'pinyin-pro'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useSettingStore } from '@/stores/setting'
import { ElMessageBox, type InputInstance } from 'element-plus'

const store = useSettingStore()

const { tagCategory: list } = storeToRefs(store)

const InputRef = ref<InputInstance>()
const inputValue = ref('')
const dynamicTags = ref(['Tag 1', 'Tag 2', 'Tag 3'])
const inputVisible = ref(false)
const activeCategory = ref(list.value[0]?.prop || '')

const add = () => {
  ElMessageBox.prompt('', '请输入新的字典分类', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(({ value }) => {
      list.value.push({
        prop: pinyin(value),
        label: value
      })
    })
    .catch(() => {})
}

const handleClose = (tag: string) => {
  dynamicTags.value.splice(dynamicTags.value.indexOf(tag), 1)
}

const showInput = () => {
  inputVisible.value = true
  nextTick(() => {
    InputRef.value!.input!.focus()
  })
}

const handleInputConfirm = () => {
  if (inputValue.value) {
    dynamicTags.value.push(inputValue.value)
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
          <el-button type="primary" circle size="small" @click="add">
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
      >
        <span>{{ item.label }}</span>
        <font-awesome-icon :icon="['solid', 'trash']" />
      </div>
    </div>
    <div class="label-maintenance-main">
      <div class="student-info-box">
        <el-tag
          v-for="tag in dynamicTags"
          :key="tag"
          effect="light"
          size="large"
          closable
          @close="handleClose(tag)"
        >
          {{ tag }}
        </el-tag>
        <el-input
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

    .label-maintenance-aside-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
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
      height: 48px;
      cursor: pointer;
      border-bottom: 1px solid rgba(226, 232, 240, 0.85);
      font-size: 16px;
      font-weight: 400;
      color: rgba(0, 0, 0, 0.85);
      padding: 0 16px;
    }

    .label-maintenance-aside-item.active {
      background-color: #ecf5ff;
      color: var(--el-color-primary);
    }

    .label-maintenance-aside-item:hover {
      background-color: #f5f5f5;
    }

    .label-maintenance-aside-item.active:before {
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
    padding: 16px;

    .student-info-box {
      display: flex;
      gap: 8px;
    }
  }
}
</style>
