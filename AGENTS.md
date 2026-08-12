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
- **Data Layer**: TanStack DB (`@tanstack/vue-db`) with a durable localStorage mutation queue and Valibot validation
- **Sync/Backend**: `@supabase-labs/tanstack-db`, Supabase Auth, Realtime, RPCs, and Postgres
- **Database Tooling**: Drizzle ORM + Drizzle Kit for schema and migrations
- **Styling**: Tailwind CSS 4.2+ via `@tailwindcss/vite`, plus `unplugin-fonts`
- **Language/Tooling**: TypeScript 7, `vue-tsc`, Oxlint, and OXC formatter

## Guidelines

- [Vue Conventions](.agents/vue-conventions.md)
- [TypeScript](.agents/typescript.md)
- [Database](.agents/database.md)
- [Supabase + TanStack DB](.agents/supabase-tanstack-db.md)
- [Styling](.agents/styling.md)
- [Architecture](.agents/architecture.md)

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "working on Vue 3 todo views, composables, and live queries"
  load: "node_modules/@tanstack/vue-db/skills/vue-db/SKILL.md"
- task: "working on Supabase Auth, PostgREST, Realtime, RLS, or RPCs"
  load: ".agents/skills/supabase/SKILL.md"
- task: "working on Valibot schemas or transport validation"
  load: ".agents/skills/valibot/SKILL.md"
- task: "updating Postgres schema, privileges, RLS, or migrations"
  load: ".agents/skills/supabase-postgres-best-practices/SKILL.md"

<!-- intent-skills:end -->

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
