<script setup lang="ts">
/** 主布局页面 — 左侧导航菜单 + 右侧路由出口 */
import { ref } from 'vue'

import LeftMenu from '@/views/main/components/LeftMenu.vue'
import ThemeSelector from '@/components/ThemeSelector.vue'
import { dayjs } from 'element-plus'

import logo from '@/assets/main/logo.png'

const title = ref(import.meta.env.VITE_GLOB_APP_TITLE)
const author = ref(import.meta.env.VITE_APP_AUTHOR || '班务管理系统')
</script>

<template>
  <el-container class="main-container">
    <el-header class="main-header" height="60px">
      <div class="header-left">
        <img class="header-logo" :src="logo" alt="" />
        <h1 class="header-title">{{ title }}</h1>
      </div>
      <div class="header-right">
        <theme-selector />
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
      <div>&copy; {{ dayjs().format('YYYY') }} {{ title }} - {{ author }}版权所有</div>
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
  background: var(--theme-gradient);
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

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
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
  overflow: hidden;
}

.main-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--theme-footer-bg);
  color: #fff;
  font-size: 14px;
}
</style>
