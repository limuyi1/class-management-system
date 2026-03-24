<script setup lang="ts">
import { ref } from 'vue'
import draggable from 'vuedraggable'
import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'
import { pinyin } from 'pinyin-pro'

import { useSettingStore } from '@/stores/setting'
import type { SettingType } from '@/types/Setting'

const store = useSettingStore()

const { tableHeaders: list } = storeToRefs(store)

const text = ref('')
const editing = ref(false)

// 姓名是固定的，不能编辑和删除
const isNameHeader = (item: SettingType) => {
  return item.prop === 'xing4_ming2'
}

const add = () => {
  list.value.push({
    prop: pinyin(text.value, { toneType: 'num', type: 'array' }).join('_'),
    label: text.value
  })
  text.value = ''
  editing.value = false
}

const edit = (item: SettingType) => {
  if (isNameHeader(item)) {
    return
  }
  ElMessageBox.prompt('', '请输入新的表头名称', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: item.label
  })
    .then(({ value }) => {
      item.label = value
    })
    .catch(() => {})
}

const remove = (item: SettingType) => {
  if (isNameHeader(item)) {
    return
  }
  list.value.splice(list.value.indexOf(item), 1)
}
</script>

<template>
  <div class="unit-configuration__wrapper">
    <el-card>
      <div class="unit-configuration-title">表头管理</div>
      <draggable
        class="unit-configuration-item__wrapper"
        v-model="list"
        item-key="prop"
        handle=".unit-configuration-item"
      >
        <template #item="{ element, index }">
          <div :class="['unit-configuration-item', { 'is-name': isNameHeader(element) }]">
            <span>{{ index + 1 }}. {{ element.label }}</span>
            <div class="flex items-center" v-if="!isNameHeader(element)">
              <font-awesome-icon class="btn" :icon="['solid', 'edit']" @click="edit(element)" />
              <el-popconfirm title="确认要删除吗？" placement="top" @confirm="remove(element)">
                <template #reference>
                  <font-awesome-icon class="btn" :icon="['solid', 'trash-can']" />
                </template>
              </el-popconfirm>
            </div>
          </div>
        </template>
      </draggable>
      <el-button class="unit-configuration-btn" v-if="!editing" dashed @click="editing = true">
        <font-awesome-icon :icon="['solid', 'plus']" />增加表头
      </el-button>
      <div class="flex justify-between items-center mt-[12px]" v-if="editing">
        <el-input
          class="flex-1 mr-2"
          v-model="text"
          size="large"
          placeholder="请输入新的表头名称"
          @keyup.enter="add"
        />
        <div class="flex items-center">
          <el-button-group>
            <el-button type="primary" size="large" @click="add">
              <template #icon><font-awesome-icon :icon="['solid', 'check']" /></template>
            </el-button>
            <el-button type="info" size="large" @click="editing = false">
              <template #icon><font-awesome-icon :icon="['solid', 'xmark']" /></template>
            </el-button>
          </el-button-group>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.unit-configuration__wrapper {
  width: 600px;
  margin: 0 auto;

  .unit-configuration-title {
    height: 32px;
    font-size: 18px;
    font-weight: 700;
    line-height: 32px;
    color: rgba(0, 0, 0, 0.85);
    margin-bottom: 16px;
  }

  .unit-configuration-item__wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;

    .unit-configuration-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 40px;
      padding: 0 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 400;
      line-height: 24px;
      color: rgba(0, 0, 0, 0.85);
      cursor: all-scroll;

      &.is-name {
        cursor: default;
        background: #ecf5ff;
        border-color: var(--el-color-primary-light-5);
      }

      .btn {
        color: var(--el-color-primary);
        cursor: pointer;
        margin-left: 4px;
        outline: none;
      }
    }
  }

  .unit-configuration-btn {
    width: 100%;
    height: 40px;
    padding: 0 16px;
    margin-top: 12px;
    font-size: 18px;
    font-weight: 400;
    cursor: pointer;
  }
}
</style>
