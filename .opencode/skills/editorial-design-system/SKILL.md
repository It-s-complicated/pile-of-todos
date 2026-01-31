---
name: editorial-design-system
description: Apply a refined, magazine-inspired "Editorial Workspace" aesthetic to Vue.js applications with Tailwind CSS. Use when building or redesigning Vue apps that need sophisticated typography, warm color palettes, and elegant micro-interactions. Ideal for productivity apps, dashboards, content management tools, or any application requiring a premium, thoughtfully-designed feel that avoids generic "AI slop" aesthetics.
---

# Editorial Design System

Apply a magazine-inspired editorial aesthetic to Vue.js applications with warm colors, sophisticated typography, and refined micro-interactions.

## Core Principles

**Theme**: Editorial Workspace - Professional yet warm, organized yet creative
**Metaphor**: Editorial planning desk with paper, ink, and careful organization
**Avoid**: Generic Tailwind defaults, system fonts, default browser styling

### Code Quality Standards

**Always Use Theme Variables**: Never hardcode color values or other design tokens directly in component templates. Always reference CSS custom properties or Tailwind theme values:

```vue
<!-- ❌ DON'T: Hardcoded values -->
<div class="bg-[#1a1a2e] text-[#e07a5f] border-[#e8e6e1]">

<!-- ✅ DO: Use theme variables -->
<div class="bg-navy text-coral border-border">
<!-- Or with CSS custom properties: -->
<div class="bg-[var(--color-navy)] text-[var(--color-coral)]">
```

**Why**: Theme variables ensure consistency, enable easy theming, and make the design system maintainable. If a color needs to change, update it in one place (the theme) rather than hunting through dozens of components.

## Quick Start

1. **Load Design Tokens**: Read [references/design-tokens.md](references/design-tokens.md) for complete CSS variables
2. **Apply Typography**: Use Playfair Display for headlines, Source Sans 3 for body
3. **Implement Components**: See [references/component-patterns.md](references/component-patterns.md) for card, navigation, and form patterns
4. **Add Animations**: Reference [references/animations.md](references/animations.md) for transitions and micro-interactions

## Design Foundation

### Typography
- **Display**: Playfair Display (serif) - headlines, view titles
- **Body**: Source Sans 3 (sans-serif) - UI elements, todo text
- **Mono**: IBM Plex Mono - metadata, week numbers

Load via unplugin-fonts (recommended):
```ts
// vite.config.ts
import UnpluginFonts from 'unplugin-fonts/vite'

UnpluginFonts({
  google: {
    families: [
      {
        name: 'IBM Plex Mono',
        styles: 'wght@400;500',
      },
      {
        name: 'Playfair Display',
        styles: 'wght@400..700',  // Variable font
      },
      {
        name: 'Source Sans 3',
        styles: 'wght@400..700',  // Variable font
      },
    ],
  },
})
```

### Color Palette (Warm & Sophisticated)
```css
--color-navy: #1a1a2e;       /* Primary actions */
--color-coral: #e07a5f;      /* Accent, CTAs */
--color-cream: #faf9f6;      /* Background */
--color-paper: #ffffff;      /* Cards */
--color-text-primary: #1a1a2e;
--color-text-secondary: #4a4a5a;
--color-text-muted: #7a7a8a;
```

### Key Visual Elements
- **Status Indicators**: 3px left border accents (coral=current, sage=future, gray=past, beige=backlog)
- **Cards**: White backgrounds with subtle borders (#e8e6e1), 8px radius
- **Navigation**: Pill-shaped buttons with navy active states
- **Shadows**: Subtle layered shadows (0 1px 2px to 0 10px 24px)

## Implementation Workflow

**IMPORTANT**: This design system requires **Tailwind CSS v4** features only. Do not use deprecated v3 syntax or plugins.

1. **Setup**: Configure unplugin-fonts in vite.config.ts
2. **Variables**: Define CSS custom properties in style.css
3. **Tailwind**: Configure custom colors in `style.css` using `@theme` directive
4. **Components**: Apply editorial styling to existing components
5. **Polish**: Add hover effects, transitions, and micro-interactions

### Tailwind 4 Conventions

**Use `size-*` for square dimensions**: When an element has equal width and height, always prefer `size-*` over separate `w-* h-*` classes:
- `size-4` instead of `w-4 h-4` (16px × 16px)
- `size-8` instead of `w-8 h-8` (32px × 32px)
- `size-16` instead of `w-16 h-16` (64px × 64px)

## Required Dependencies

```bash
npm install lucide-vue-next
```

## Resources

### references/design-tokens.md
Complete design tokens including:
- Full color palette with hex values
- Typography scale and font specifications
- Spacing scale (4px to 48px)
- Shadow definitions
- Border radius scale
- Transition timing functions

### references/component-patterns.md
Component implementation patterns:
- Navigation with pill buttons
- Card layouts with status borders
- Custom checkbox styling
- Input form patterns
- Modal/dialog styling
- Empty state designs

### references/animations.md
Animation specifications:
- Page load staggered entrance
- Hover lift effects
- Checkbox toggle animations
- Button transitions
- Modal fade/scale animations
- Form validation feedback

## Quality Standards

Before completing implementation:
- [ ] **No hardcoded values** - All colors, spacing, and design tokens use CSS variables or Tailwind theme classes
- [ ] Theme variables defined in `style.css` with `@theme` directive (Tailwind 4)
- [ ] All colors reference theme (e.g., `bg-navy`, `text-coral`) not hex codes
- [ ] Typography uses specified Google Fonts via CSS variables
- [ ] All interactive elements have defined hover states
- [ ] Animations run at 60fps with proper easing
- [ ] Custom form elements replace browser defaults
- [ ] Responsive behavior verified at all breakpoints
- [ ] Visual hierarchy is clear and intentional
