import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import type { UserConfig } from 'vite'

const includeModule = (id: string, modules: string[]) =>
  id.includes('node_modules') &&
  modules.some((moduleName) => id.includes(`/node_modules/${moduleName}`))

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  const root = process.cwd()
  const env = loadEnv(mode, root)

  return {
    plugins: [
      vue(),
      vueJsx(),
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
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      watch: {
        usePolling: true // 启用轮询
      },
      port: Number(env.VITE_PORT),
      host: '0.0.0.0',
      fs: {
        // Allow serving files from one level up to the project rootW
        allow: ['..']
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'static',
      chunkSizeWarningLimit: 750,
      rolldownOptions: {
        output: {
          codeSplitting: {
            minSize: 20 * 1024,
            groups: [
              {
                name: 'vue-core',
                test: (id: string) => includeModule(id, ['vue', 'vue-router', 'pinia', '@vueuse'])
              },
              {
                name: 'element-plus',
                test: (id: string) => includeModule(id, ['element-plus', '@element-plus']),
                maxSize: 450 * 1024
              },
              {
                name: 'vxe',
                test: (id: string) =>
                  includeModule(id, ['vxe-table', 'vxe-pc-ui', '@vxe-ui', 'xe-utils']),
                maxSize: 450 * 1024
              },
              {
                name: 'editors',
                test: (id: string) =>
                  includeModule(id, ['md-editor-v3', '@vueup/vue-quill', 'codemirror']),
                maxSize: 450 * 1024
              },
              {
                name: 'pdf-tools',
                test: (id: string) => includeModule(id, ['pdf-lib', '@pdf-lib']),
                maxSize: 450 * 1024
              },
              {
                name: 'spreadsheet',
                test: (id: string) => includeModule(id, ['xlsx']),
                maxSize: 450 * 1024
              },
              {
                name: 'charts',
                test: (id: string) => includeModule(id, ['echarts', 'zrender']),
                maxSize: 450 * 1024
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
