<script setup lang="tsx">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import PageHeader from '@/components/PageHeader.vue'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

import type { VxeTablePropTypes } from 'vxe-table'
import { NAME_PROP } from '@/types/Constants'

const store = useDataSourceStore()
const settingStore = useSettingStore()
const { enabledData: tableData } = storeToRefs(store)
const { tableHeaders: headers } = storeToRefs(settingStore)

const tableRef = ref()
const editConfig = ref<VxeTablePropTypes.EditConfig>({
  trigger: 'dblclick',
  mode: 'cell',
  showIcon: false
})

const isNotEmpty = computed(() => store.enabledData?.length)
</script>

<template>
  <div class="home-page app-page-shell">
    <page-header :icon="['solid', 'users']" title="学生信息" subtitle="双击单元格编辑学生信息" />
    <div class="home-page-content" v-if="isNotEmpty">
      <vxe-table
        ref="tableRef"
        border
        align="center"
        height="100%"
        :edit-config="editConfig"
        :data="tableData"
      >
        <vxe-column type="seq" title="序号" width="60" fixed="left" :resizable="false" />
        <vxe-column
          :field="NAME_PROP"
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
  min-height: 0;
}

.home-page-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #fff;
}
</style>
