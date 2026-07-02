<script setup lang="ts">
import { shallowRef } from 'vue'
import draggable from 'vuedraggable'
import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'
import { pinyin } from 'pinyin-pro'

import { useSettingStore } from '@/stores/setting'
import type { SettingType } from '@/types/Setting'
import { NAME_PROP } from '@/types/Constants'

const store = useSettingStore()

const { scoreColumns: list } = storeToRefs(store)

const text = shallowRef('')
const editing = shallowRef(false)

// 姓名是固定的，不能编辑和删除
const isNameHeader = (item: SettingType) => {
  return item.prop === NAME_PROP
}

const add = () => {
  const label = text.value.trim()
  if (!label) {
    return
  }

  list.value.push({
    prop: pinyin(label, { toneType: 'num', type: 'array' }).join('_'),
    label,
    disabled: false
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

const setDisabled = (item: SettingType, disabled: boolean) => {
  if (isNameHeader(item)) {
    item.disabled = false
    return
  }
  item.disabled = disabled
}

const cancelAdd = () => {
  text.value = ''
  editing.value = false
}
</script>

<template>
  <div class="unit-configuration__wrapper">
    <div class="unit-configuration-grid">
      <draggable
        class="unit-configuration-item__wrapper"
        v-model="list"
        item-key="prop"
        handle=".unit-configuration-item__drag"
      >
        <template #item="{ element, index }">
          <div
            :class="[
              'unit-configuration-item',
              {
                'is-name': isNameHeader(element),
                'is-disabled': element.disabled
              }
            ]"
          >
            <font-awesome-icon
              class="unit-configuration-item__drag"
              :icon="['solid', 'grip-vertical']"
            />
            <div class="unit-configuration-item__main">
              <span class="unit-configuration-item__index">{{ index + 1 }}</span>
              <span class="unit-configuration-item__label">{{ element.label }}</span>
            </div>
            <div class="unit-configuration-item__actions">
              <el-switch
                :model-value="!element.disabled"
                :disabled="isNameHeader(element)"
                size="small"
                inline-prompt
                active-text="启"
                inactive-text="禁"
                @update:model-value="(value: boolean) => setDisabled(element, !value)"
              />
              <div v-if="!isNameHeader(element)" class="unit-configuration-item__buttons">
                <font-awesome-icon class="btn" :icon="['solid', 'edit']" @click="edit(element)" />
                <el-popconfirm title="确认要删除吗？" placement="top" @confirm="remove(element)">
                  <template #reference>
                    <font-awesome-icon class="btn" :icon="['solid', 'trash-can']" />
                  </template>
                </el-popconfirm>
              </div>
            </div>
          </div>
        </template>
      </draggable>

      <button
        v-if="!editing"
        class="unit-configuration-add"
        type="button"
        @click="editing = true"
      >
        <font-awesome-icon :icon="['solid', 'plus']" />
        <span>增加表头</span>
      </button>
      <div v-else class="unit-configuration-add is-editing">
        <el-input
          v-model="text"
          size="default"
          placeholder="请输入新的表头名称"
          @keyup.enter="add"
        />
        <div class="unit-configuration-add__actions">
          <el-button type="primary" size="small" circle @click="add">
            <template #icon><font-awesome-icon :icon="['solid', 'check']" /></template>
          </el-button>
          <el-button type="info" size="small" circle @click="cancelAdd">
            <template #icon><font-awesome-icon :icon="['solid', 'xmark']" /></template>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.unit-configuration__wrapper {
  width: 100%;
  padding: 24px 28px;

  .unit-configuration-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .unit-configuration-item__wrapper {
    display: contents;

    .unit-configuration-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: space-between;
      min-height: 112px;
      padding: 18px 16px 16px;
      background: #fff;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 400;
      color: rgba(0, 0, 0, 0.85);
      transition:
        border-color 0.2s ease,
        background-color 0.2s ease,
        opacity 0.2s ease;

      &.is-name {
        border-color: var(--el-color-primary-light-5);
        box-shadow: inset 4px 0 0 var(--el-color-primary);
      }

      &.is-disabled {
        color: #94a3b8;
        border-color: #e5eaf3;
      }

      &:hover {
        border-color: #b8c4d6;
      }

      .unit-configuration-item__main {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        padding-right: 28px;
      }

      .unit-configuration-item__index {
        width: fit-content;
        min-width: 22px;
        height: 22px;
        padding: 0 8px;
        border-radius: 11px;
        background: #f1f5f9;
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
        line-height: 22px;
        text-align: center;
      }

      .unit-configuration-item__label {
        overflow: hidden;
        min-width: 0;
        font-size: 18px;
        font-weight: 600;
        line-height: 28px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .unit-configuration-item__actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 14px;
        flex-shrink: 0;
        padding-top: 14px;
      }

      .unit-configuration-item__drag {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        padding: 9px;
        box-sizing: border-box;
        border-radius: 8px;
        color: #94a3b8;
        cursor: grab;
        outline: none;

        &:hover {
          color: #475569;
          background: #f1f5f9;
        }
      }

      .unit-configuration-item__buttons {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .btn {
        width: 36px;
        height: 36px;
        padding: 9px;
        box-sizing: border-box;
        border-radius: 8px;
        color: #64748b;
        cursor: pointer;
        outline: none;

        &:hover {
          color: var(--el-color-primary);
          background: #f1f5f9;
        }
      }
    }
  }

  .unit-configuration-add {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 112px;
    padding: 16px;
    color: var(--el-color-primary);
    background: transparent;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;

    &:hover {
      border-color: var(--el-color-primary-light-3);
      background: #f8fafc;
    }

    &.is-editing {
      flex-direction: column;
      align-items: stretch;
      justify-content: space-between;
      background: #fff;
      cursor: default;
    }
  }

  .unit-configuration-add__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    gap: 6px;
  }
}
</style>
