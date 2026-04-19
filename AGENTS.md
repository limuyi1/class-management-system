# AGENTS.md - Coding Agent Guidelines

## Project Overview

Scores Recording System (成绩记录系统) — a Vue 3 + TypeScript + Vite desktop-oriented web app for managing student scores and evaluations. Uses Element Plus, VxeTable, Tailwind CSS, and Pinia for state management.

## Build / Dev / Lint Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (port from VITE_PORT in .env)
pnpm build            # Full build (runs type-check and vite build in parallel)
pnpm build-only       # Vite build only (no type-check)
pnpm preview          # Preview production build
pnpm type-check       # Type-check with vue-tsc
pnpm lint             # Lint and auto-fix (ESLint)
pnpm format           # Format source code (Prettier)
pnpm test             # Run Vitest tests (run mode)
pnpm test:watch       # Run Vitest tests (watch mode)
pnpm test:coverage    # Run Vitest with coverage report
```

## Testing

Tests use **Vitest** with `@vue/test-utils` and `happy-dom`. Test files are located in the `tests/` directory:

```
tests/
├── components/       # Component tests
├── hooks/           # Hook/composable tests
├── stores/          # Pinia store tests
└── utils/           # Utility function tests
```

Tests follow the pattern `*.test.ts` and import from `../../src/`.

## Tech Stack

- **Framework**: Vue 3.3+ (Composition API, `<script setup lang="ts">`)
- **Build**: Vite 5, `@vitejs/plugin-vue`, `@vitejs/plugin-vue-jsx`
- **Language**: TypeScript 5.3, strict mode via `@vue/tsconfig`
- **UI**: Element Plus, VxeTable (`vxe-table`/`vxe-pc-ui`), FontAwesome
- **Styling**: Tailwind CSS 4 + SCSS (scoped styles in SFCs)
- **State**: Pinia + `pinia-plugin-persistedstate` with Dexie (global persistence plugin)
- **Router**: Vue Router 4 with hash history (`createWebHashHistory`)
- **Package Manager**: pnpm
- **Path Alias**: `@` → `./src`

## Code Style

### Formatting (`.prettierrc.json`)

- No semicolons, single quotes, no trailing commas, 2-space indent, 100 char width

### Import Order (blank line between groups)

1. Vue core (Vue, Vue features)
2. Element Plus components/hooks
3. Third-party libraries
4. Internal modules using `@/` alias (stores, utils, config, etc.)
5. Type-only imports (`import type { ... }`)

### TypeScript

- Use `lang="ts"` in all `<script setup>` blocks
- Prefer explicit types for function parameters/return values
- Types in `src/types/` with PascalCase filenames (e.g., `Setting.ts`, `Common.ts`)
- Use `enum` for fixed value sets (e.g., `PagesEnum`, `InputEnum`)
- Interface/type names use `Type` suffix (e.g., `SettingType`, `ConfigurationType`)
- Avoid `any`; use only for truly dynamic data (e.g., parsed Excel rows)
- Use `@ts-ignore` sparingly and only when necessary

### Naming Conventions

| Item              | Convention                          | Example                                  |
| ----------------- | ----------------------------------- | ---------------------------------------- |
| Pinia stores      | `use<Name>Store`, kebab-case file   | `useSettingStore` in `stores/setting.ts` |
| Composables/hooks | `use<PascalCase>`, file in `hooks/` | `useEnterUp` in `hooks/useEnterUp.ts`    |
| Utility modules   | `<name>Until.ts` in `utils/`        | `xlsxUntil.ts`, `pdfUntil.ts`            |
| Vue components    | PascalCase filenames                | `ScoreTableView.vue`                     |
| Enums             | PascalCase with `Enum` suffix       | `PagesEnum`, `InputEnum`                 |

### Vue SFC Template Order

1. `<script setup lang="ts">` — logic
2. `<template>` — markup
3. `<style scoped lang="scss">` — styles

### Pinia Stores

Use Options API style. Persistence is configured globally via `createPersistedStateDexie()` plugin in main.ts — do NOT add `persist: true` to individual stores:

```ts
export const useExampleStore = defineStore('example', {
  state: () => ({ items: [] as Array<SomeType> }),
  getters: { count: (state) => state.items.length },
  actions: {}
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
├── config/          # App configuration (score colors, etc.)
├── db/              # Dexie database schema and migrations
├── hooks/           # Composables (use* pattern)
├── plugins/         # Vue plugins (persistence, etc.)
├── router/          # Vue Router config
├── stores/          # Pinia stores (kebab-case files)
├── types/           # TypeScript interfaces & enums
├── utils/           # Utility modules (*Until.ts)
├── views/           # Page components (home/, score/, evaluation/, setting/, main/)
├── App.vue
└── main.ts

tests/               # Test files
├── components/       # Component tests
├── hooks/           # Hook/composable tests
├── stores/          # Pinia store tests
└── utils/           # Utility function tests
```

## Important Notes

- Build output goes to `dist/` directory
- Hash-based routing (`/#/home`, `/#/score`, etc.)
- Environment variables prefixed with `VITE_`
- Pinyin prop names use tone number suffix (e.g., `xing4_ming2` for 姓名)

## Data Storage Architecture

| Store                   | File                      | Purpose                                   |
| ----------------------- | ------------------------- | ----------------------------------------- |
| `useDataSourceStore`    | `stores/data-source.ts`   | Student data array, statistics getters    |
| `useSettingStore`       | `stores/setting.ts`       | Table headers, tag categories, tags       |
| `useConfigurationStore` | `stores/configuration.ts` | App settings (font size, page type, etc.) |
| `useThemeStore`         | `stores/theme.ts`         | Theme initialization and management       |

Table headers stored as `tableHeaders: Array<SettingType>` in `setting.ts`. First header is always `{ prop: 'xing4_ming2', label: '姓名' }` (cannot be deleted). Each data row has `xing4_ming2` (student name), dynamic keys matching header props, and optional `comment`.
