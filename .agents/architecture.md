# Architecture Guidelines

## File Structure

```
src/
├── components/     - Reusable Vue components (PascalCase.vue)
├── composables/    - Vue composition functions (useXxx.ts)
├── db/             - Database setup and collections
├── router/         - Vue Router configuration
├── views/          - Page-level components (PascalCaseView.vue)
├── App.vue         - Root component
├── main.ts         - Application entry point
├── env.d.ts        - Vue type declarations
└── style.css       - Tailwind CSS import and theme
```

## Error Handling

- Use optional chaining and null checks: `todo?.label`
- Early returns for error conditions
- Check array indices before access: `if (index !== -1)`
- Async functions should handle promise rejections (await without try/catch is OK in UI code)

## PWA Configuration

- Manifest in vite.config.ts (not separate file)
- Icons: 192x192 and 512x512 PNG in public/
- Service worker auto-update enabled

## Testing

No test framework is currently configured. When adding tests:

- Use Vitest for unit testing
- Use @vue/test-utils for component testing
- Tests in `tests/` directory
- Run single test: `npm test -- path/to/test.spec.ts`
