# AI Todo App

A Vue 3 + TanStack DB todo application with weekly planning features.

## Commands

- `npm run dev` - Start Vite development server (http://localhost:5173)
- `npm run build` - Run TypeScript type check and build for production
- `npm run preview` - Preview production build locally
- `npx vue-tsc --noEmit` - Run TypeScript type checking without emitting files

## Tech Stack

- **Framework**: Vue 3.5+ with Composition API and Vue Router 5 typed routing
- **Build Tooling**: Vite+
- **Data Layer**: TanStack DB (`@tanstack/vue-db`) with local-first LocalStorage persistence and Valibot validation
- **Sync/Backend**: ElectricSQL client + `@tanstack/electric-db-collection`, Supabase Auth, and Postgres
- **Database Tooling**: Drizzle ORM + Drizzle Kit for schema and migrations
- **Styling**: Tailwind CSS 4.2+ via `@tailwindcss/vite`, plus `unplugin-fonts`
- **Language/Tooling**: TypeScript 6, `vue-tsc`, Oxlint, and OXC formatter

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

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
