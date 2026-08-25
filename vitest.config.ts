/**
 * Vitest 测试配置
 * 使用 happy-dom 环境运行组件测试，与 Vite 共享 @ 路径别名
 */
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // 与构建一致，使用 Vue 插件解析 .vue 单文件组件
  plugins: [vue()],
  test: {
    // 全局注册 describe/it/expect，测试文件无需手动导入
    globals: true,
    // 用 happy-dom 模拟浏览器 DOM 环境
    environment: 'happy-dom',
    // 测试启动前加载的公共准备文件
    setupFiles: ['tests/setup.ts'],
    // 测试文件匹配规则
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    // 排除目录
    exclude: ['node_modules', 'dist', 'docs']
  },
  resolve: {
    // @ 别名指向 src 目录
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
