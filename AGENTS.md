# AGENTS.md - 编码代理指南

## 项目概述

成绩记录系统（Scores Recording System）—— 一个基于 Vue 3 + TypeScript + Vite 的桌面向 Web 应用，用于管理学生成绩与评语。使用 Element Plus、VxeTable、Tailwind CSS 和 Pinia 进行状态管理。

## 构建 / 开发 / Lint 命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器（端口来自 .env 中的 VITE_PORT）
pnpm build            # 完整构建（并行运行 type-check 和 vite build）
pnpm build-only       # 仅 Vite 构建（不做 type-check）
pnpm preview          # 预览生产构建
pnpm type-check       # 使用 vue-tsc 做类型检查
pnpm lint             # Lint 检查（ESLint）
pnpm lint:fix         # Lint 并自动修复（ESLint）
pnpm format           # 格式化源代码（Prettier）
pnpm test             # 运行 Vitest 测试（run 模式）
pnpm test:watch       # 运行 Vitest 测试（watch 模式）
pnpm test:coverage    # 运行 Vitest 并生成覆盖率报告
```

### 开发服务器策略

- 除非用户明确要求，否则不要启动开发服务器（`pnpm dev`、`npm run dev`、`yarn dev`、`bun dev` 等）。

### 依赖安装策略

- 不要自动运行 `pnpm install`、`npm install`、`yarn install` 或依赖更新命令。
- 除非用户明确要求安装或更新包，否则默认依赖已由用户安装完成。
- 除非用户明确要求，否则不要删除、重建、清理、修剪或以其他方式修改 `node_modules/`。
- 如果 `pnpm test`、`pnpm build` 或其他脚本尝试触发依赖安装/重建，停止并报告具体问题，而不是继续安装尝试。
- 如果本地测试二进制文件缺失（例如 `node_modules/.bin/vitest`），报告当前代理环境下无法运行验证，并请用户恢复依赖。

## 测试

测试使用 **Vitest** 配合 `@vue/test-utils` 和 `happy-dom`。测试文件位于 `tests/` 目录：

```
tests/
├── components/       # 组件测试
├── hooks/           # Hook/组合式函数测试
├── stores/          # Pinia store 测试
└── utils/           # 工具函数测试
```

测试遵循 `*.test.ts` 命名模式，并从 `../../src/` 导入。

## 技术栈

- **框架**：Vue 3.3+（组合式 API，`<script setup lang="ts">`）
- **构建**：Vite 5，`@vitejs/plugin-vue`，`@vitejs/plugin-vue-jsx`
- **语言**：TypeScript 5.3，通过 `@vue/tsconfig` 开启严格模式
- **UI**：Element Plus、VxeTable（`vxe-table`/`vxe-pc-ui`）、FontAwesome
- **样式**：Tailwind CSS 4 + SCSS（SFC 中的 scoped 样式）
- **状态**：Pinia + 自定义的 `createPersistedStateDexie()` 插件，底层基于 Dexie
- **路由**：Vue Router 4，使用 hash 历史模式（`createWebHashHistory`）
- **包管理器**：pnpm
- **路径别名**：`@` → `./src`

## 代码风格

### 格式化（`.prettierrc.json`）

- 不使用分号、使用单引号、不使用尾随逗号、2 空格缩进、行宽 100 字符

### 导入顺序（分组之间用空行分隔）

1. Vue 核心（Vue、Vue 特性）
2. Element Plus 组件/hook
3. 第三方库
4. 使用 `@/` 别名的内部模块（stores、utils、config 等）
5. 仅类型导入（`import type { ... }`）

### TypeScript

- 所有 `<script setup>` 块使用 `lang="ts"`
- 优先为函数参数/返回值显式标注类型
- 类型放在 `src/types/`，文件名使用 PascalCase（如 `Setting.ts`、`Common.ts`）
- 固定值集合使用 `enum`（如 `PagesEnum`、`InputEnum`）
- 接口/类型名使用 `Type` 后缀（如 `SettingType`、`ConfigurationType`）
- 避免使用 `any`；仅在真正动态的数据（如解析的 Excel 行）中使用
- 谨慎使用 `@ts-ignore`，仅在必要时使用

### 命名规范

| 项目              | 规范                                | 示例                                      |
| ----------------- | ----------------------------------- | ----------------------------------------- |
| Pinia store       | `use<Name>Store`，文件用 kebab-case | `useSettingStore`，位于 `stores/setting.ts` |
| 组合式函数/hook   | `use<PascalCase>`，文件在 `hooks/`  | `useEnterUp`，位于 `hooks/useEnterUp.ts`  |
| 工具模块          | `utils/` 下的 `<name>Util.ts`       | `xlsxUtil.ts`、`pdfUtil.ts`               |
| Vue 组件          | PascalCase 文件名                   | `ScoreTableView.vue`                      |
| 枚举              | PascalCase + `Enum` 后缀            | `PagesEnum`、`InputEnum`                  |

### Vue SFC 模板顺序

1. `<script setup lang="ts">` — 逻辑
2. `<template>` — 模板
3. `<style scoped lang="scss">` — 样式

### Pinia Store

使用 Options API 风格。持久化通过 main.ts 中的 `createPersistedStateDexie()` 插件全局配置 —— 不要给单个 store 添加 `persist: true`：

```ts
export const useExampleStore = defineStore('example', {
  state: () => ({ items: [] as Array<SomeType> }),
  getters: { count: (state) => state.items.length },
  actions: {}
})
```

### 样式

- Vue SFC 中使用 scoped SCSS
- 模板中使用 Tailwind CSS 工具类
- 使用 Element Plus CSS 变量进行主题定制
- BEM 式命名（如 `setting-tabs__wrapper`）
- 使用 `:deep()` 穿透 scoped 样式

### 错误处理

- 用 try/catch 包裹异步操作，并用 `console.error` 记录日志
- 使用 `ElMessageBox.confirm` 进行破坏性操作的确认
- 使用 `ElLoading.service()` 处理加载状态

### 注释

- 工具函数和组合式函数使用 JSDoc 注释（`/** ... */`）
- 注释可以使用中文 —— 保持一致
- 不要为显而易见的代码添加注释

## 项目结构

```
src/
├── ai/              # AI 相关功能
├── assets/          # 静态资源、样式
├── components/      # 共享/全局组件
├── config/          # 应用配置（分数颜色等）
├── constants/       # 共享运行时常量（字段名、数据库表枚举）
├── db/              # Dexie 数据库 schema 与迁移
├── hooks/           # 组合式函数（use* 模式）
├── plugins/         # Vue 插件（持久化等）
├── router/          # Vue Router 配置
├── stores/          # Pinia store（kebab-case 文件）
├── types/           # TypeScript 接口与枚举
├── utils/           # 工具模块（*Util.ts）
├── views/           # 页面组件（home/、score/、evaluation/、setting/、main/）
├── App.vue
└── main.ts

tests/               # 测试文件
├── components/       # 组件测试
├── hooks/           # Hook/组合式函数测试
├── stores/          # Pinia store 测试
└── utils/           # 工具函数测试
```

## 字体资源策略

- `src/assets/font/SourceHanSerifSC-Regular.otf` 是一个体积较大的仅作备份的字体资源。不要将其用作默认 UI 字体，不要在新样式中引用它，也不要将其嵌入新的 PNG/PDF/导出实现中。
- 不要扩展对 `SourceHanSerifSC-Regular.otf` 的现有依赖。当所需字形覆盖范围明确时，优先使用系统字体或已有的专用子集字体（如 `SourceHanSerifSC-LabelSubset.otf`）。
- 任何新的运行时用途启用该备份字体都需要用户明确批准。

## 重要说明

- 构建输出到 `dist/` 目录
- 使用 hash 路由（`/#/home`、`/#/score` 等）
- 环境变量以 `VITE_` 为前缀
- 学生字段的 prop 键名使用英文标识（`name` 表示姓名，`studentId` 表示学生ID），定义在 `src/constants/student.ts`

## 数据存储架构

| Store                   | 文件                      | 用途                                   |
| ----------------------- | ------------------------- | -------------------------------------- |
| `useDataSourceStore`    | `stores/data-source.ts`   | 学生数据数组、统计 getter               |
| `useSettingStore`       | `stores/setting.ts`       | 表头、标签分类、标签                     |
| `useConfigurationStore` | `stores/configuration.ts` | 应用设置（字体大小、页面类型等）         |
| `useThemeStore`         | `stores/theme.ts`         | 主题初始化与管理                         |

表头以 `scoreColumns: Array<SettingType>` 存储在 `setting.ts` 中。第一列始终是姓名列（prop 为 `name`，来自 `NAME_PROP`），且不可删除。每一行数据都有 `name`（学生姓名）、`studentId`、与表头 prop 对应的动态键，以及可选的 `comment`。
