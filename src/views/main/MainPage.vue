<script setup lang="ts">
/** 主布局页面 — 左侧导航菜单 + 右侧路由出口 */
import { ref } from 'vue'

import LeftMenu from '@/views/main/components/LeftMenu.vue'
import ThemeSelector from '@/components/ThemeSelector.vue'
import { dayjs } from 'element-plus'

import logo from '@/assets/main/logo.png'

/** 应用标题与作者信息，来自环境变量 */
const title = ref(import.meta.env.VITE_GLOB_APP_TITLE)
const author = ref(import.meta.env.VITE_APP_AUTHOR || '班务管理系统')

// 仅缓存核心工作页，避免工具页切换后残留旧状态、占用内存。
const cachedPages = ['OverviewPage', 'ScorePage', 'EvaluationPage']
</script>

<template>
  <el-container class="main-container">
    <!-- 顶部栏：应用标题与主题切换 -->
    <el-header class="main-header" height="60px">
      <div class="header-left">
        <img class="header-logo" :src="logo" alt="" />
        <h1 class="header-title">{{ title }}</h1>
      </div>
      <div class="header-right">
        <theme-selector />
      </div>
    </el-header>
    <!-- 主体：左侧导航菜单 + 右侧页面内容 -->
    <el-container class="main-body">
      <el-aside class="main-aside">
        <left-menu />
      </el-aside>
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <keep-alive :include="cachedPages">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </el-main>
    </el-container>
    <!-- 底部版权栏 -->
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
