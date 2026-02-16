# TypeScript Guidelines

## Configuration

- Strict mode enabled in tsconfig - all types must be explicit
- No `any` types - use `unknown` with type guards if necessary

## Import Patterns

- Use `type` keyword for type-only imports: `import type { Todo } from './db/collections'`
- Absolute imports use `@/` alias: `import { X } from '@/db/collections'`
- Relative imports for sibling files: `import { X } from '../db/collections'`

## Type Patterns

- Use `Partial<T>` for update operations
- Prefer explicit return types on exported functions
- Define props with `defineProps<{ prop: Type }>()` syntax

## Naming

- **Types/Interfaces**: PascalCase (`Todo`, `TodoFilter`)
- **Functions/Variables**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE (rare)
