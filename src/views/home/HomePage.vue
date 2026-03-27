<script setup lang="tsx">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

import type { VxeTablePropTypes } from 'vxe-table'

const store = useDataSourceStore()
const settingStore = useSettingStore()
const { data: tableData } = storeToRefs(store)
const { tableHeaders: headers } = storeToRefs(settingStore)

const tableRef = ref()
const editConfig = ref<VxeTablePropTypes.EditConfig>({
  trigger: 'dblclick',
  mode: 'cell',
  showIcon: false
})

const isNotEmpty = computed(() => store.data?.length)
</script>

<template>
  <div class="home-page">
    <div class="home-page-header">
      <div class="header-icon">
        <font-awesome-icon :icon="['solid', 'users']" />
      </div>
      <div class="header-text">
        <h2>学生信息</h2>
        <p>双击单元格编辑学生信息</p>
      </div>
    </div>
    <div class="home-page-content" v-if="isNotEmpty">
      <vxe-table
        ref="tableRef"
        border
        show-overflow
        auto-resize
        align="center"
        height="auto"
        :edit-config="editConfig"
        :data="tableData"
      >
        <vxe-column type="seq" title="序号" width="60" fixed="left" :resizable="false" />
        <vxe-column
          field="xing4_ming2"
          title="姓名"
          width="100"
          fixed="left"
          sortable
          resizable
          :edit-render="{ name: 'input' }"
        />
        <vxe-column
          v-for="item in headers"
          :key="item.prop"
          :field="item.prop"
          :title="item.label"
          sortable
          resizable
          min-width="150"
          :edit-render="{ name: 'input' }"
        />
      </vxe-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
}

.home-page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 16px 20px;
  background: var(--theme-gradient);
  border-radius: 12px;
  color: #fff;

  .header-icon {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    font-size: 22px;
  }

  .header-text {
    h2 {
      margin: 0 0 2px 0;
      font-size: 18px;
      font-weight: 600;
    }

    p {
      margin: 0;
      font-size: 13px;
      opacity: 0.85;
    }
  }
}

.home-page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
}
</style>
