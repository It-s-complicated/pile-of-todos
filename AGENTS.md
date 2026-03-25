# AI Todo App

A Vue 3 + TanStack DB todo application with weekly planning features.

## Commands

- `npm run dev` - Start Vite development server (http://localhost:5173)
- `npm run build` - Run TypeScript type check and build for production
- `npm run preview` - Preview production build locally
- `npx vue-tsc --noEmit` - Run TypeScript type checking without emitting files

## Tech Stack

- **Framework**: Vue 3.5+ with Composition API
- **Build Tool**: Vite 7.2+
- **Database**: TanStack DB (LocalStorage) with valibot validation
- **Styling**: Tailwind CSS 4.1+ with Vite plugin
- **TypeScript**: 5.9+ with strict mode enabled

## Guidelines

- [Vue Conventions](.agents/vue-conventions.md)
- [TypeScript](.agents/typescript.md)
- [Database](.agents/database.md)
- [Electric SQL + TanStack DB](.agents/electric-sql.md)
- [Styling](.agents/styling.md)
- [Architecture](.agents/architecture.md)

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
skills:
  - task: "working on Vue 3 todo views, composables, and live queries"
    load: "node_modules/@tanstack/vue-db/skills/vue-db/SKILL.md"
  - task: "working on TanStack DB collections, local storage, and valibot schemas"
    load: "node_modules/@tanstack/db/skills/db-core/collection-setup/SKILL.md"
  - task: "working on Electric SQL sync, shape params, and per-user todo syncing"
    load: "node_modules/@electric-sql/client/skills/electric-shapes/SKILL.md"
  - task: "debugging stale, slow, or broken Electric sync"
    load: "node_modules/@electric-sql/client/skills/electric-debugging/SKILL.md"
  - task: "updating Drizzle or Postgres schema and migrations for synced todos"
    load: "node_modules/@electric-sql/client/skills/electric-orm/SKILL.md"
<!-- intent-skills:end -->
