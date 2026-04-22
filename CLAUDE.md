# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Class Management System (班务管理系统) — a Vue 3 + TypeScript desktop-oriented web app for teachers to manage student scores, evaluations, and wrong-answer notebooks. Supports multi-theme theming, AI integration (Gemini/Doubao), and local-first data persistence via Dexie (IndexedDB).

## Build Commands

```bash
pnpm install       # Install dependencies
pnpm dev           # Start dev server (port from VITE_PORT in .env)
pnpm build         # Full build (runs type-check + vite build in parallel)
pnpm build-only    # Vite build only (no type-check)
pnpm preview       # Preview production build
pnpm type-check    # Type-check with vue-tsc
pnpm lint          # Lint and auto-fix with ESLint
pnpm format        # Format source code with Prettier
pnpm test          # Run Vitest tests (run mode)
pnpm test:watch    # Run Vitest tests (watch mode)
pnpm test:coverage # Run Vitest with coverage
```

## Tech Stack

- **Framework**: Vue 3.3+ with Composition API (`<script setup lang="ts">`)
- **Build**: Vite 5 with `@vitejs/plugin-vue` and `@vitejs/plugin-vue-jsx`
- **Language**: TypeScript 5.3, strict mode via `@vue/tsconfig`
- **UI**: Element Plus, VxeTable (`vxe-table`/`vxe-pc-ui`), FontAwesome
- **Styling**: Tailwind CSS 4 + scoped SCSS in SFCs
- **State**: Pinia + custom `createPersistedStateDexie()` plugin backed by Dexie
- **Router**: Vue Router 4 with hash history (`createWebHashHistory`)
- **Database**: Dexie (IndexedDB wrapper) for local-first persistence
- **Package Manager**: pnpm
- **Path Alias**: `@` → `./src`

## Architecture

### Pinia Stores

| Store | File | Purpose |
|-------|------|---------|
| `useDataSourceStore` | `stores/data-source.ts` | Student data array, score statistics getters |
| `useSettingStore` | `stores/setting.ts` | Table headers, tag categories, student tags |
| `useConfigurationStore` | `stores/configuration.ts` | App settings (font size, page type, input score tab) |
| `useThemeStore` | `stores/theme.ts` | Theme initialization and CSS variable application |
| `useAIConfigStore` | `stores/ai-config.ts` | AI API configuration (Gemini/Doubao) |
| `useWrongBookStore` | `stores/wrong-book.ts` | Wrong question notebook data |

**Important**: Persistence is configured globally via `createPersistedStateDexie()` plugin in `main.ts` — do NOT add `persist: true` to individual stores.

### Data Model

Student data uses pinyin prop names with tone number suffixes. Key constant:
- `NAME_PROP = 'xing4_ming2'` (derived from `pinyin-pro` library)

Table headers stored as `tableHeaders: Array<{ prop: string, label: string }>` in `setting.ts`. First header is always `{ prop: 'xing4_ming2', label: '姓名' }` and cannot be deleted. Each data row has:
- `xing4_ming2` — student name (required)
- Dynamic keys matching header props (e.g., `yu3_wen2` for 语文)
- `comment` — evaluation text (optional)
- `tags` — `Record<string, string[]>` for tag assignments
- `disabled` — boolean for hiding student

### Views/Pages

- `views/home/` — Student info homepage
- `views/score/` — Score input with pinyin fuzzy matching, statistics
- `views/evaluation/` — End-of-term evaluation comments with PDF export
- `views/wrong-book/` — Wrong question notebook with folder tree
- `views/setting/` — Settings center (student info, tags, units, AI config, backup)
- `views/main/` — App shell with collapsible left menu and theme selector

## Code Style

### Import Order (blank line between groups)
1. Vue core (Vue, Vue features)
2. Element Plus components/hooks
3. Third-party libraries
4. Internal modules using `@/` alias (stores, utils, config)
5. Type-only imports (`import type { ... }`)

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Pinia stores | `use<Name>Store`, kebab-case file | `useSettingStore` in `stores/setting.ts` |
| Composables/hooks | `use<PascalCase>`, file in `hooks/` | `useEnterUp` in `hooks/useEnterUp.ts` |
| Utility modules | `*Until.ts` in `utils/` | `xlsxUntil.ts`, `pdfUntil.ts` |
| Vue components | PascalCase filenames | `ScoreTableView.vue` |
| Enums | PascalCase with `Enum` suffix | `PagesEnum`, `InputEnum` |
| Types/Interfaces | PascalCase, `Type` suffix | `SettingType`, `ConfigurationType` |

### Styling

- Scoped SCSS in Vue SFCs
- Tailwind CSS utility classes in templates
- Element Plus CSS variables for theming
- Theme colors via CSS custom properties (`--theme-*`)

## Important Notes

- Build output goes to `docs/` directory (static site deployment)
- Hash-based routing: `/#/home`, `/#/math`, `/#/comment`, `/#/wrong-book`, `/#/setting`
- Environment variables prefixed with `VITE_`
- AI integration in `src/ai/` supports Gemini and Doubao models
- Wrong question notebook uses folder tree structure with `parentId` references

## Testing

Tests use **Vitest** with `@vue/test-utils` and `happy-dom`. Test files in `tests/` follow `*.test.ts` pattern and import from `../../src/`.
