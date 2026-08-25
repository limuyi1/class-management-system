<script setup lang="ts">
/**
 * 单元配置组件：设置全局成绩满分，并维护可拖拽排序的成绩表头。
 * 姓名列固定不可编辑、删除、禁用，其余表头可新增、编辑、删除与启停。
 */
import { shallowRef } from 'vue'
import draggable from 'vuedraggable'
import { ElMessageBox } from 'element-plus'

import { storeToRefs } from 'pinia'
import { pinyin } from 'pinyin-pro'

import { useSettingStore } from '@/stores/setting'
import { useConfigurationStore } from '@/stores/configuration'
import type { SettingType } from '@/types/Setting'
import { NAME_PROP } from '@/constants'

const store = useSettingStore()
const configurationStore = useConfigurationStore()

const { scoreColumns: list } = storeToRefs(store)
const { scoreFullMark } = storeToRefs(configurationStore)

const text = shallowRef('') // 新增表头的输入内容
const editing = shallowRef(false) // 是否处于新增编辑态

/**
 * 判断当前表头是否为固定的姓名列。
 * @param item - 表头配置项
 * @returns 是否为姓名列
 */
const isNameHeader = (item: SettingType) => {
  return item.prop === NAME_PROP
}

/**
 * 新增表头：以输入名称的中文拼音生成 prop，并追加到表头列表末尾。
 */
const add = () => {
  const label = text.value.trim()
  if (!label) {
    return
  }

  list.value.push({
    // 拼音数字声调形式拼接下划线，作为数据行的字段键
    prop: pinyin(label, { toneType: 'num', type: 'array' }).join('_'),
    label,
    disabled: false
  })
  text.value = ''
  editing.value = false
}

/**
 * 编辑表头名称，姓名列不允许编辑。
 * @param item - 待编辑的表头配置项
 */
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

/**
 * 删除表头，姓名列不允许删除。
 * @param item - 待删除的表头配置项
 */
const remove = (item: SettingType) => {
  if (isNameHeader(item)) {
    return
  }
  list.value.splice(list.value.indexOf(item), 1)
}

/**
 * 切换表头的启用/禁用状态，姓名列始终强制为启用。
 * @param item - 目标表头配置项
 * @param disabled - 目标禁用状态
 */
const setDisabled = (item: SettingType, disabled: boolean) => {
  if (isNameHeader(item)) {
    item.disabled = false
    return
  }
  item.disabled = disabled
}

/**
 * 取消新增，清空输入并退出编辑态。
 */
const cancelAdd = () => {
  text.value = ''
  editing.value = false
}
</script>

<template>
  <div class="unit-configuration__wrapper">
    <!-- 全局成绩满分设置 -->
    <div class="fullmark-card">
      <div class="fullmark-card__label">
        <font-awesome-icon :icon="['solid', 'gauge-high']" />
        <span>成绩满分（全局）</span>
      </div>
      <el-input-number
        v-model="scoreFullMark"
        :min="1"
        :max="1000"
        :precision="0"
        :step="10"
      />
      <span class="fullmark-card__hint">用于成绩录入与 AI 识图的分数上限校验</span>
    </div>

    <div class="unit-configuration-grid">
      <!-- 表头卡片网格：可拖拽排序，支持启停、编辑与删除 -->
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

  .fullmark-card {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding: 16px 20px;
    background: #f8fafc;
    border: 1px solid #dbe3ef;
    border-radius: 8px;

    &__label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #334155;

      svg {
        color: var(--el-color-primary);
      }
    }

    &__hint {
      color: #94a3b8;
      font-size: 12px;
    }
  }

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
