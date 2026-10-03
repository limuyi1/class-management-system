/**
 * Vite 构建配置
 * 集成 Vue、Tailwind CSS、HTML 标题注入等插件，配置路径别名与产物分包策略
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { createHtmlPlugin } from 'vite-plugin-html'

import type { UserConfig } from 'vite'

/** 判断模块 id 是否命中 node_modules 下的指定依赖包 */
const includeModule = (id: string, modules: string[]) =>
  id.includes('node_modules') &&
  modules.some((moduleName) => id.includes(`/node_modules/${moduleName}`))

// Vite 配置官方文档：https://vitejs.dev/config/
export default defineConfig(({ mode, command, isPreview }): UserConfig => {
  const root = process.cwd()
  const env = loadEnv(mode, root)

  return {
    // Vue 相关构建插件：Vue SFC、HTML 标题注入与 Tailwind CSS
    plugins: [
      vue(),
      createHtmlPlugin({
        inject: {
          data: {
            title: env.VITE_GLOB_APP_TITLE
          }
        }
      }),
      tailwindcss()
    ],
    resolve: {
      // 配置 @ 别名指向 src 目录
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    // 构建与生产预览使用相同的项目子路径，开发环境使用根路径
    base: command === 'build' || isPreview ? '/class-management-system/' : '/',
    server: {
      watch: {
        usePolling: true // 启用轮询
      },
      // 开发服务器端口从 .env 的 VITE_PORT 读取
      port: Number(env.VITE_PORT),
      host: '0.0.0.0',
      fs: {
        // 允许从项目根目录上一级提供文件（适配 monorepo 目录结构）
        allow: ['..']
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        output: {
          // 按依赖库分组拆分构建产物，控制各分包体积
          codeSplitting: {
            minSize: 20 * 1024,
            groups: [
              {
                name: 'vue-core',
                test: (id: string) => includeModule(id, ['vue', 'vue-router', 'pinia', '@vueuse'])
              },
              {
                name: 'element-plus',
                test: (id: string) => includeModule(id, ['element-plus', '@element-plus'])
              },
              {
                name: 'vxe',
                test: (id: string) =>
                  includeModule(id, ['vxe-table', 'vxe-pc-ui', '@vxe-ui', 'xe-utils'])
              },
              {
                name: 'editors',
                test: (id: string) => includeModule(id, ['md-editor-v3', 'codemirror'])
              },
              {
                name: 'pdf-tools',
                test: (id: string) => includeModule(id, ['pdf-lib', '@pdf-lib'])
              },
              {
                name: 'spreadsheet',
                test: (id: string) => includeModule(id, ['xlsx'])
              },
              {
                name: 'charts',
                test: (id: string) => includeModule(id, ['echarts', 'zrender'])
              },
              {
                name: 'ai-sdk',
                test: (id: string) => includeModule(id, ['@google/generative-ai'])
              },
              {
                name: 'vendor',
                test: /node_modules/,
                maxSize: 450 * 1024
              }
            ]
          }
        }
      }
    }
  }
})
