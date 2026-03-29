# AGENTS.md - Coding Agent Guidelines

## Project Overview

Scores Recording System (成绩记录系统) — a Vue 3 + TypeScript + Vite desktop-oriented web app for managing student scores and evaluations. Uses Element Plus, VxeTable, Tailwind CSS, and Pinia for state management.

## Build / Dev / Lint Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (port from VITE_PORT in .env)
pnpm build            # Full build (type-check + vite build)
pnpm build-only       # Vite build only (no type-check)
pnpm preview          # Preview production build
pnpm type-check       # Type-check with vue-tsc
pnpm lint             # Lint and auto-fix (ESLint)
pnpm format           # Format source code (Prettier)
```

There is **no test framework** configured. Do not assume Vitest or Jest exists.

## Tech Stack

- **Framework**: Vue 3.3 (Composition API, `<script setup lang="ts">`)
- **Build**: Vite 5, `@vitejs/plugin-vue`, `@vitejs/plugin-vue-jsx`
- **Language**: TypeScript 5.3, strict mode via `@vue/tsconfig`
- **UI**: Element Plus, VxeTable (`vxe-table`/`vxe-pc-ui`), FontAwesome
- **Styling**: Tailwind CSS 4 + SCSS (scoped styles in SFCs)
- **State**: Pinia + `pinia-plugin-persistedstate` (zipson serialization)
- **Router**: Vue Router 4 with hash history (`createWebHashHistory`)
- **Package Manager**: pnpm
- **Path Alias**: `@` → `./src`

## Code Style

### Formatting (`.prettierrc.json`)

- No semicolons, single quotes, no trailing commas, 2-space indent, 100 char width

### Imports (blank line between groups)

1. Third-party libraries (Vue, Element Plus, Pinia)
2. Internal modules using `@/` alias
3. Type-only imports (`import type { ... }`)

### TypeScript

- Use `lang="ts"` in all `<script setup>` blocks
- Prefer explicit types for function parameters/return values
- Types in `src/types/` with PascalCase filenames (e.g., `Setting.ts`)
- Use `enum` for fixed value sets (e.g., `PagesEnum`)
- Interface/type names use `Type` suffix (e.g., `SettingType`)
- Avoid `any`; use only for truly dynamic data (e.g., parsed Excel rows)

### Naming Conventions

| Item              | Convention                          | Example                                  |
| ----------------- | ----------------------------------- | ---------------------------------------- |
| Pinia stores      | `use<Name>Store`, kebab-case file   | `useSettingStore` in `stores/setting.ts` |
| Composables/hooks | `use<PascalCase>`, file in `hooks/` | `useEnterUp` in `hooks/useEnterUp.ts`    |
| Utility modules   | `<name>Until.ts` in `untils/`       | `xlsxUntil.ts`, `pdfUntil.ts`            |
| Vue components    | PascalCase filenames                | `ScoreTableView.vue`                     |
| Enums             | PascalCase with `Enum` suffix       | `PagesEnum`, `InputEnum`                 |

### Vue SFC Template Order

1. `<script setup lang="ts">` — logic
2. `<template>` — markup
3. `<style scoped lang="scss">` — styles

### Pinia Stores

Use Options API style with `persist: true`:

```ts
export const useExampleStore = defineStore('example', {
  state: () => ({ items: [] as Array<SomeType> }),
  getters: { count: (state) => state.items.length },
  actions: {},
  persist: true
})
```

### Styling

- Scoped SCSS in Vue SFCs
- Tailwind CSS utility classes in templates
- Element Plus CSS variables for theming
- BEM-like naming (e.g., `setting-tabs__wrapper`)
- Use `:deep()` for penetrating scoped styles

### Error Handling

- Wrap async operations in try/catch with `console.error` for logging
- Use `ElMessageBox.confirm` for destructive action confirmations
- Use `ElLoading.service()` for loading states
- Use `@ts-ignore` sparingly and only when necessary

### Comments

- JSDoc comments (`/** ... */`) for utility functions and composables
- Comments may be in Chinese — maintain consistency
- Do not add comments to trivial code

## Project Structure

```
src/
├── ai/              # AI-related features
├── assets/          # Static assets, styles
├── components/      # Shared/global components
├── config/          # App configuration
├── hooks/           # Composables (use* pattern)
├── router/          # Vue Router config
├── stores/          # Pinia stores
├── types/           # TypeScript interfaces & enums
├── utils/           # Utility modules
├── views/           # Page components (home/, score/, evaluation/, setting/, main/)
├── App.vue
└── main.ts
```

## Important Notes

- `utils/` - 工具函数目录 — do not rename
- Build output goes to `docs/` directory
- Hash-based routing (`/#/home`, `#/math`, etc.)
- Environment variables prefixed with `VITE_`

## Data Storage Architecture

| Store                   | File                      | Purpose                                   |
| ----------------------- | ------------------------- | ----------------------------------------- |
| `useDataSourceStore`    | `stores/data-source.ts`   | Student data array, statistics getters    |
| `useSettingStore`       | `stores/setting.ts`       | Table headers, tag categories, tags       |
| `useConfigurationStore` | `stores/configuration.ts` | App settings (font size, page type, etc.) |

Table headers stored as `tableHeaders: Array<SettingType>` in `setting.ts`. First header is always `{ prop: 'xing4_ming2', label: '姓名' }` (cannot be deleted). Each data row has `xing4_ming2` (student name), dynamic keys matching header props, and optional `comment`.
