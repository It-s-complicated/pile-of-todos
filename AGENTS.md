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

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
