# AGENTS.md - Coding Agent Guidelines

## Project Overview

Scores Recording System (成绩记录系统) — a Vue 3 + TypeScript + Vite desktop-oriented web app for managing student scores and evaluations. Uses Element Plus, VxeTable, Tailwind CSS, and Pinia for state management.

## Build / Dev / Lint Commands

```bash
# Install dependencies
pnpm install

# Start dev server (port from VITE_PORT in .env)
pnpm dev

# Full build (type-check + vite build)
pnpm build

# Vite build only (no type-check)
pnpm build-only

# Preview production build
pnpm preview

# Type-check with vue-tsc
pnpm type-check

# Lint and auto-fix
pnpm lint

# Format source code
pnpm format
```

There is **no test framework** configured in this project. Do not assume Vitest or Jest exists. If tests are needed, add the framework first.

## Tech Stack

- **Framework**: Vue 3.3 (Composition API, `<script setup lang="ts">`)
- **Build**: Vite 5, `@vitejs/plugin-vue`, `@vitejs/plugin-vue-jsx`
- **Language**: TypeScript 5.3, strict mode via `@vue/tsconfig`
- **UI Libraries**: Element Plus, VxeTable (`vxe-table` / `vxe-pc-ui`), FontAwesome
- **Styling**: Tailwind CSS 4 + SCSS (scoped styles in SFCs)
- **State**: Pinia + `pinia-plugin-persistedstate` (zipson serialization)
- **Router**: Vue Router 4 with hash history (`createWebHashHistory`)
- **Package Manager**: pnpm

## Path Aliases

- `@` → `./src` (configured in `vite.config.ts` and `tsconfig.app.json`)

## Code Style

### Formatting (Prettier)

Configured in `.prettierrc.json`:
- **No semicolons** (`"semi": false`)
- **Single quotes** (`"singleQuote": true`)
- **No trailing commas** (`"trailingComma": "none"`)
- **2-space indentation** (`"tabWidth": 2`)
- **100 char print width** (`"printWidth": 100`)

### Imports

Order imports in this sequence, separated by blank lines:
1. Third-party libraries (Vue, Element Plus, Pinia, etc.)
2. Internal modules using `@/` alias
3. Type-only imports use `import type { ... }` syntax

```ts
import { ref, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'

import { useDataSourceStore } from '@/stores/data-source'
import type { ListItemType } from '@/types/DataSource'
```

### TypeScript

- Use `lang="ts"` in all `<script setup>` blocks
- Prefer explicit types for function parameters and return values
- Use `type` keyword for type-only imports: `import type { Foo } from '@/types/...'`
- Interfaces/types go in `src/types/` with PascalCase filenames (e.g., `Setting.ts`, `Common.ts`)
- Use `enum` for fixed sets of values (e.g., `PagesEnum`, `InputEnum`)
- Avoid `any` where possible; use it only for truly dynamic data (e.g., parsed Excel rows)

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Pinia stores | `use<Name>Store`, kebab-case file | `useSettingStore` in `stores/setting.ts` |
| Composables/hooks | `use<PascalCase>`, file in `hooks/` | `useEnterUp` in `hooks/useEnterUp.ts` |
| Utility modules | `<name>Until.ts` in `untils/` | `xlsxUntil.ts`, `pdfUntil.ts` |
| Vue components | PascalCase filenames | `ScoreTableView.vue`, `EmptyTableView.vue` |
| Type files | PascalCase in `types/` | `Common.ts`, `DataSource.ts` |
| Enums | PascalCase with `Enum` suffix | `PagesEnum`, `InputEnum` |
| Interfaces | PascalCase with `Type` suffix | `SettingType`, `TagCategoryType` |

### Vue Components (SFC)

Use `<script setup lang="ts">` with this template order:
1. `<script setup lang="ts">` — logic
2. `<template>` — markup
3. `<style scoped lang="scss">` — styles

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSomeStore } from '@/stores/some'

const store = useSomeStore()
const { data } = storeToRefs(store)
const loading = ref(false)

/**
 * Description of function
 * @param param description
 */
const handleAction = (param: string) => {
  // logic
}

defineExpose({ handleAction })
</script>

<template>
  <div v-loading="loading">{{ data }}</div>
</template>

<style scoped lang="scss">
.wrapper {
  // styles
}
</style>
```

### Pinia Stores

Use Options API style with `persist: true` for persisted state:
```ts
import { defineStore } from 'pinia'

export const useExampleStore = defineStore('example', {
  state: () => ({
    items: [] as Array<SomeType>
  }),
  getters: {
    count: (state) => state.items.length
  },
  actions: {},
  persist: true
})
```

### Styling

- Use **scoped SCSS** in Vue SFCs
- Use **Tailwind CSS** utility classes directly in templates (e.g., `class="w-[100px]! mr-[8px]"`)
- Use Element Plus CSS variables for theming (e.g., `var(--el-color-primary)`)
- BEM-like naming for custom CSS classes (e.g., `setting-tabs__wrapper`, `operate-btn__wrapper`)
- Use `:deep()` for penetrating scoped styles to child components

### Error Handling

- Wrap async operations in try/catch with `console.error` for logging
- Use Element Plus `ElMessageBox.confirm` for destructive action confirmations
- Use `ElLoading.service()` for loading states during long operations
- Use `@ts-ignore` sparingly and only when necessary

### Comments

- Write JSDoc comments (`/** ... */`) for utility functions and composables
- Comments may be in Chinese (中文) — maintain consistency with existing code
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
├── untils/          # Utility modules
├── views/           # Page components (nested by feature)
│   ├── home/
│   ├── score/
│   ├── evaluation/
│   ├── setting/
│   └── main/
├── App.vue
└── main.ts
```

## Important Notes

- The `untils/` directory is intentionally named (not "utils") — do not rename it
- Build output goes to `docs/` directory (`vite.config.ts` build.outDir)
- The app uses hash-based routing (`/#/home`, `#/math`, etc.)
- Environment variables are prefixed with `VITE_` and loaded via `loadEnv`
- No existing Cursor rules, Copilot instructions, or prior AGENTS.md found
