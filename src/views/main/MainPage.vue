<script setup lang="ts">
import { ref } from 'vue'

import LeftMenu from '@/views/main/components/LeftMenu.vue'
import { dayjs, ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import router from '@/router'

import { useDataSourceStore } from '@/stores/data-source'
import { useSettingStore } from '@/stores/setting'

import logo from '@/assets/main/logo.png'

const title = ref(import.meta.env.VITE_GLOB_APP_TITLE)
const store = useDataSourceStore()
const settingStore = useSettingStore()
const { data: tableData } = storeToRefs(store)

const handleUploadClick = () => {
  ElMessageBox.confirm('确定要重置学生信息吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    store.$reset()
    settingStore.$reset()
  })
}
</script>

<template>
  <el-container class="main-container">
    <el-header class="main-header" height="60px">
      <div class="header-left">
        <img class="header-logo" :src="logo" alt="" />
        <h1 class="header-title">{{ title }}</h1>
      </div>
      <div class="header-right">
        <el-button
          v-if="tableData && tableData.length > 0"
          type="primary"
          @click="handleUploadClick"
        >
          <template #icon>
            <font-awesome-icon :icon="['solid', 'upload']" />
          </template>
          重新上传
        </el-button>
      </div>
    </el-header>
    <el-container class="main-body">
      <el-aside class="main-aside">
        <left-menu />
      </el-aside>
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
    <el-footer class="main-footer" height="30px">
      <div>&copy; {{ dayjs().format('YYYY') }} {{ title }} - 李木一版权所有</div>
    </el-footer>
  </el-container>
</template>

<style scoped lang="scss">
.main-container {
  height: 100vh;
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--el-color-primary);
  color: #fff;
  padding: 0 20px;

  .header-left {
    display: flex;
    align-items: center;
  }

  .header-logo {
    height: 40px;
    width: 40px;
    margin-right: 16px;
  }

  .header-title {
    font-size: 20px;
    font-weight: bold;
    margin: 0;
  }
}

.main-body {
  height: calc(100vh - 60px - 30px);
}

.main-aside {
  width: auto !important;
  overflow: visible !important;
}

.main-content {
  padding: 0 !important;
  height: 100%;
}

.main-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #333;
  color: #fff;
  font-size: 14px;
}
</style>
