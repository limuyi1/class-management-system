import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import tailwindcss from '@tailwindcss/vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import type { UserConfig } from 'vite'

import { cloudflare } from "@cloudflare/vite-plugin";

const includeModule = (id: string, modules: string[]) =>
  id.includes('node_modules') &&
  modules.some((moduleName) => id.includes(`/node_modules/${moduleName}`))

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }): UserConfig => {
  const root = process.cwd()
  const env = loadEnv(mode, root)

  return {
    plugins: [vue(), vueJsx(), createHtmlPlugin({
      inject: {
        data: {
          title: env.VITE_GLOB_APP_TITLE
        }
      }
    }), tailwindcss(), cloudflare()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    base: command === 'build' ? '/class-management-system/' : '/',
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
      chunkSizeWarningLimit: 1200,
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
                test: (id: string) => includeModule(id, ['element-plus', '@element-plus'])
              },
              {
                name: 'vxe',
                test: (id: string) =>
                  includeModule(id, ['vxe-table', 'vxe-pc-ui', '@vxe-ui', 'xe-utils'])
              },
              {
                name: 'editors',
                test: (id: string) =>
                  includeModule(id, ['md-editor-v3', '@vueup/vue-quill', 'codemirror'])
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
  };
})