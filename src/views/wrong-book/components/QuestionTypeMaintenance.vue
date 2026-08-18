<script setup lang="ts">
/** 题型管理 — 支持题型的增删改与拖拽排序 */
import { ref } from 'vue'
import draggable from 'vuedraggable'
import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'

import { useWrongBookStore } from '@/stores/wrong-book'

const wrongBookStore = useWrongBookStore()
const { questionTypes: list } = storeToRefs(wrongBookStore)

const text = ref('')
const editing = ref(false)

/** 新增题型，校验重名后追加到列表 */
const add = () => {
  if (list.value.some((t) => t.value === text.value)) {
    ElMessageBox.alert('该题型已存在', '提示')
    return
  }
  list.value.push({
    value: text.value,
    label: text.value
  })
  text.value = ''
  editing.value = false
}

/**
 * 弹窗修改题型名称，校验重名后更新
 * @param item - 待编辑的题型
 */
const edit = (item: { value: string; label: string }) => {
  ElMessageBox.prompt('', '请输入新的题型名称', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: item.label
  })
    .then(({ value }) => {
      if (list.value.some((t) => t.value !== item.value && t.value === value)) {
        ElMessageBox.alert('该题型已存在', '提示')
        return
      }
      item.value = value
      item.label = value
    })
    .catch(() => {})
}

/**
 * 从列表中删除指定题型
 * @param item - 待删除的题型
 */
const remove = (item: { value: string; label: string }) => {
  list.value.splice(list.value.indexOf(item), 1)
}
</script>

<template>
  <div class="unit-configuration__wrapper">
    <el-card>
      <div class="unit-configuration-title">题型管理</div>
      <draggable
        class="unit-configuration-item__wrapper"
        v-model="list"
        item-key="value"
        handle=".unit-configuration-item"
      >
        <template #item="{ element, index }">
          <div class="unit-configuration-item">
            <span>{{ index + 1 }}. {{ element.label }}</span>
            <div class="flex items-center">
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
        <template #icon><font-awesome-icon :icon="['solid', 'plus']" /></template>
        增加题型
      </el-button>
      <div class="flex justify-between items-center mt-[12px]" v-if="editing">
        <el-input
          class="flex-1 mr-2"
          v-model="text"
          size="large"
          placeholder="请输入新的题型名称"
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
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;

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
