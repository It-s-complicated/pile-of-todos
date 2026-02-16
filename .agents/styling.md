# Styling Guidelines

## Tailwind CSS

- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Use `@theme` directive in style.css for custom colors
- All styling via utility classes in templates
- No CSS files in components directory

## UI Feedback Patterns

- Display success/error messages for user actions (import/export operations)
- Use conditional styling for feedback:
  - Success: `bg-green-100 text-green-800`
  - Error: `bg-red-100 text-red-800`
- Auto-dismiss messages with `setTimeout()` (typical: 5000ms)
- Use hidden file input for import: `class="hidden"` with trigger button
- Clear file input value after processing: `target.value = ''`

## Validation Feedback

- Validation errors shown as red messages that auto-dismiss after 5000ms
- Todo labels validated using **valibot** schemas
- Label validation rules:
  - Minimum length: 1 character (cannot be empty)
  - Maximum length: 500 characters
  - Allowed characters: letters, numbers, spaces, and `-.,!?@+#$%&*'()`
- Validation schema example:

```ts
import { maxLength, minLength, pipe, regex, string } from 'valibot'

const TodoLabelSchema = pipe(
  string(),
  minLength(1, 'Label cannot be empty'),
  maxLength(500, 'Label must be less than 500 characters'),
  regex(/^[a-z0-9\s\-.,!?@+#$%&*'()]+$/i, 'Label contains invalid characters'),
)
```
