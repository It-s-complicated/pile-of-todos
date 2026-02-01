# Design Plan: Editorial Workspace Theme

## Overview
Transform the ai-todo-app from its current generic Tailwind defaults into a refined, magazine-inspired "Editorial Workspace" aesthetic. This design treats task management like editorial planning with sophisticated typography, warm colors, and elegant micro-interactions.

## Design Direction
**Theme**: Editorial Workspace - Magazine-inspired, refined, sophisticated
**Tone**: Professional yet warm, organized yet creative
**Metaphor**: Editorial planning desk with paper, ink, and careful organization

---

## 1. Typography System

### Font Choices
| Role | Font | Usage |
|------|------|-------|
| Display/Headlines | **Playfair Display** (Google Fonts) | View titles, large headings |
| Body/UI | **Source Sans 3** (Google Fonts) | Navigation, buttons, todo text, labels |
| Monospace | **IBM Plex Mono** | Week numbers, metadata |

### Typography Scale
```css
/* Headlines */
--font-display: 'Playfair Display', serif;
--font-body: 'Source Sans 3', sans-serif;
--font-mono: 'IBM Plex Mono', monospace;

/* Sizes */
--text-hero: 2.5rem (40px) - View titles
--text-xl: 1.5rem (24px) - Section headers
--text-lg: 1.125rem (18px) - Emphasized text
--text-base: 1rem (16px) - Body text
--text-sm: 0.875rem (14px) - Labels, metadata
--text-xs: 0.75rem (12px) - Fine print
```

### Implementation Notes
- Load fonts from Google Fonts CDN in index.html
- Use tight letter-spacing (-0.02em) on headlines
- Use normal letter-spacing (0) on body text
- Font weights: 400 (regular), 600 (semibold), 700 (bold)

---

## 2. Color Palette

### Primary Colors
```css
/* Brand */
--color-navy: #1a1a2e;           /* Primary actions, nav active */
--color-coral: #e07a5f;          /* Accent, CTAs, highlights */
--color-coral-dark: #c45a3f;     /* Coral hover state */

/* Backgrounds */
--color-cream: #faf9f6;          /* Main app background */
--color-paper: #ffffff;          /* Card backgrounds */
--color-paper-elevated: #ffffff; /* Modal/popover backgrounds */

/* Text */
--color-text-primary: #1a1a2e;   /* Headlines, primary text */
--color-text-secondary: #4a4a5a; /* Body text */
--color-text-muted: #7a7a8a;     /* Metadata, hints */
--color-text-inverse: #ffffff;   /* Text on dark backgrounds */

/* Status Colors */
--color-success: #5a8a6e;        /* Completed items, success messages */
--color-success-light: #e8f0eb;  /* Success backgrounds */
--color-warning: #d4a373;        /* Warnings, unfinished items */
--color-warning-light: #faf3e8;  /* Warning backgrounds */
--color-danger: #c45a5a;         /* Archive, destructive actions */
--color-danger-light: #f5e8e8;   /* Danger backgrounds */

/* Borders & Dividers */
--color-border: #e8e6e1;         /* Card borders, dividers */
--color-border-hover: #d8d6d1;   /* Border hover state */

/* Week Status Indicators (left border accents) */
--color-week-current: #e07a5f;   /* Current week - coral */
--color-week-future: #5a8a6e;    /* Future weeks - sage */
--color-week-past: #7a7a8a;      /* Past weeks - gray */
--color-week-backlog: #d4a373;   /* Backlog - warm beige */
```

### Usage Guidelines
- Background: Always use cream (#faf9f6) for the main app background
- Cards: Pure white (#ffffff) with subtle border (#e8e6e1)
- Primary buttons: Navy (#1a1a2e) background with white text
- Accent/CTA buttons: Coral (#e07a5f) with white text
- Completed todos: Muted text with subtle strikethrough
- Status indicators: 3px left border on todo items

---

## 3. Layout & Spacing

### Container
- Max-width: 800px (increased from 672px for more breathing room)
- Centered with auto margins
- Padding: 24px on mobile, 32px on tablet+

### Spacing Scale
```css
--space-1: 0.25rem (4px)
--space-2: 0.5rem (8px)
--space-3: 0.75rem (12px)
--space-4: 1rem (16px)
--space-5: 1.25rem (20px)
--space-6: 1.5rem (24px)
--space-8: 2rem (32px)
--space-10: 2.5rem (40px)
--space-12: 3rem (48px)
```

### Component Spacing
- Navigation gap: 8px between items
- Todo list gap: 12px between items
- Card padding: 16px (p-4)
- Section margins: 32px (mb-8)

---

## 4. Component Styles

### Navigation (App.vue)
```
Style: Pill-shaped buttons with refined active states
- Background: transparent (default), navy (active)
- Text: secondary color (default), white (active)
- Padding: 8px 16px
- Border-radius: 9999px (full rounded)
- Font: Source Sans 3, 14px, weight 500
- Hover: Light cream background
- Active indicator: Navy background with coral left accent (2px)
```

### Todo Input Form
```
- Input field: White background, 1px border (#e8e6e1), 8px radius
- Focus: Navy border (#1a1a2e), subtle shadow
- Select dropdown: Same styling as input
- Add button: Navy background, white text, 8px radius
- Validation error: Coral background with icon
```

### Todo Item Card
```
Structure:
┌─────────────────────────────────────┐
│█│ [✓]  Todo label text         [⋯] │
│ │        Week 42 · Added today      │
└─────────────────────────────────────┘

Left border (3px):
- Current week: Coral (#e07a5f)
- Future: Sage green (#5a8a6e)
- Past/Unfinished: Gray (#7a7a8a)
- Backlog: Warm beige (#d4a373)

Card:
- Background: White
- Border: 1px solid #e8e6e1
- Border-radius: 8px
- Padding: 16px
- Shadow: 0 1px 3px rgba(0,0,0,0.04)
- Hover: Lift effect (translateY(-1px), increased shadow)

Checkbox:
- Custom styled (not default browser)
- 20px × 20px
- Unchecked: 2px navy border, white fill
- Checked: Navy fill with white checkmark
- Transition: 200ms ease

Actions (Move, Archive):
- Icon buttons (use Lucide icons)
- 32px × 32px touch targets
- Muted color, hover to full color
- Tooltip on hover (optional)
```

### Week Selector Modal
```
- Backdrop: Black at 40% opacity with blur
- Modal: White background, 12px radius
- Padding: 24px
- Shadow: Large elevated shadow
- Select: Full width, styled input
- Primary button: Coral background
- Secondary button: Light gray background
```

### Empty State
```
- Centered content
- Icon: Large (64px) muted icon
- Message: "No todos yet" in muted text
- Subtext: Context-aware hint (e.g., "Add your first task above")
```

### Import/Export Buttons
```
- Export: Sage green background
- Import: Warm beige background
- Small size (padding 6px 12px)
- Icon + text layout
```

---

## 5. Micro-interactions & Animation

### Transitions
```css
/* Standard transition */
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;

/* Easing */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### Specific Animations

**Page Load:**
- Staggered list item entrance
- Each item: opacity 0→1, translateY(10px→0)
- Stagger delay: 50ms between items
- Duration: 300ms
- Easing: ease-out

**Todo Item Hover:**
- Transform: translateY(-1px)
- Shadow: Increase from subtle to medium
- Duration: 200ms

**Checkbox Toggle:**
- Scale pulse: 1 → 1.1 → 1 on check
- Checkmark draws in with SVG stroke animation
- Duration: 200ms

**Button Hover:**
- Background color shift
- Duration: 150ms

**Navigation Active State:**
- Smooth background color transition
- Duration: 200ms

**Modal:**
- Backdrop: Fade in (200ms)
- Content: Scale from 0.95→1, fade in (300ms)
- Easing: ease-out

**Form Validation Error:**
- Slide down + fade in
- Shake animation on error
- Duration: 300ms

---

## 6. Visual Details & Polish

### Background Texture
- Subtle paper grain overlay on cream background
- Use CSS noise texture or SVG pattern
- Opacity: 3-5% (very subtle)

### Shadows
```css
/* Subtle (cards at rest) */
--shadow-sm: 0 1px 2px rgba(26, 26, 46, 0.04);

/* Medium (hover states) */
--shadow-md: 0 4px 6px rgba(26, 26, 46, 0.06);

/* Large (modals, elevated) */
--shadow-lg: 0 10px 24px rgba(26, 26, 46, 0.12);
```

### Border Radius Scale
```css
--radius-sm: 4px;    /* Small elements */
--radius-md: 8px;    /* Cards, inputs */
--radius-lg: 12px;   /* Modals */
--radius-full: 9999px; /* Pills, buttons */
```

### Icons
- Use **Lucide** icons (install via npm)
- Icon sizes: 16px (inline), 20px (buttons), 24px (navigation)
- Stroke width: 1.5px
- Color: Inherit from text

---

## 7. Responsive Behavior

### Mobile (< 640px)
- Navigation: Horizontal scroll with snap points
- Todo items: Full width, stacked actions
- Input form: Vertical stack
- Reduced padding: 16px

### Tablet (640px - 1024px)
- Navigation: Wrap to multiple rows
- Todo items: Full width
- Standard padding: 24px

### Desktop (> 1024px)
- Navigation: Single row
- Max-width container: 800px
- Generous padding: 32px

---

## 8. Implementation Priority

### Phase 1: Foundation (Critical)
1. Add Google Fonts to index.html
2. Update style.css with new color variables
3. Update tailwind config with custom colors
4. Install Lucide icons

### Phase 2: Global Elements
1. Redesign navigation with pill buttons
2. Style input form with new aesthetic
3. Update import/export buttons

### Phase 3: Todo Items
1. Redesign TodoItem.vue with card layout
2. Add left border status indicators
3. Implement custom checkbox
4. Add hover animations

### Phase 4: Modals & Views
1. Redesign WeekSelector modal
2. Style empty states
3. Add page load animations
4. Polish all transitions

### Phase 5: Polish
1. Add paper texture background
2. Fine-tune all animations
3. Test all interactions
4. Verify responsive behavior

---

## 9. Files to Modify

### High Priority
- `index.html` - Add Google Fonts
- `src/style.css` - Update theme variables
- `src/App.vue` - Redesign navigation and forms
- `src/components/TodoItem.vue` - Complete redesign
- `src/components/TodoList.vue` - Empty states, animations
- `src/components/WeekSelector.vue` - Modal redesign

### Medium Priority
- `src/views/*.vue` - Update view headers
- `tailwind.config.js` - Add custom colors if needed

### Dependencies to Add
```bash
npm install lucide-vue-next
```

---

## 10. Quality Checklist

Before considering implementation complete:
- [ ] All colors use variables (no hardcoded hex values)
- [ ] Typography uses specified fonts
- [ ] All interactive elements have hover states
- [ ] Animations run at 60fps
- [ ] Custom checkbox implemented and working
- [ ] Left border status indicators visible
- [ ] Navigation responsive on all screen sizes
- [ ] Empty states designed and implemented
- [ ] Form validation errors styled
- [ ] No default browser styling visible (buttons, inputs, checkboxes)
- [ ] Paper texture subtle but visible
- [ ] All transitions use specified easing

---

## 11. Implementation Requirements

**CRITICAL**: This design plan must be implemented using the `frontend-design` skill. The implementing agent MUST:

1. **Load the design skill** before starting implementation:
   ```
   Use skill: frontend-design
   ```

2. **Follow the skill guidelines**:
   - Create distinctive, production-grade frontend interfaces
   - Avoid generic "AI slop" aesthetics
   - Use real working code with exceptional attention to aesthetic details
   - Implement creative choices with precise execution

3. **Adhere to design principles from the skill**:
   - Typography must be beautiful, unique, and interesting (no Arial, Inter, or system fonts)
   - Color & theme must be cohesive with dominant colors and sharp accents
   - Motion should include CSS-only animations for effects and micro-interactions
   - Spatial composition should use unexpected layouts, asymmetry, generous negative space
   - Backgrounds must create atmosphere and depth with textures, gradients, or patterns

4. **Verify implementation**:
   - Run type checking: `npx vue-tsc --noEmit`
   - Test all interactive elements
   - Verify responsive behavior
   - Check accessibility (contrast ratios, focus states)

---

## Reference Materials

### Google Fonts URLs
```html
<!-- Add to <head> in index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Lucide Icons (Vue)
```vue
<script setup>
import { Archive, ArrowRight, Calendar, Check, Download, Upload } from 'lucide-vue-next'
</script>
```

### CSS Variables Template
```css
:root {
  /* Colors */
  --color-navy: #1a1a2e;
  --color-coral: #e07a5f;
  --color-cream: #faf9f6;
  --color-paper: #ffffff;
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #4a4a5a;
  --color-text-muted: #7a7a8a;
  --color-success: #5a8a6e;
  --color-warning: #d4a373;
  --color-danger: #c45a5a;
  --color-border: #e8e6e1;

  /* Typography */
  --font-display: 'Playfair Display', serif;
  --font-body: 'Source Sans 3', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* Spacing */
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Effects */
  --shadow-sm: 0 1px 2px rgba(26, 26, 46, 0.04);
  --shadow-md: 0 4px 6px rgba(26, 26, 46, 0.06);
  --shadow-lg: 0 10px 24px rgba(26, 26, 46, 0.12);
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Transitions */
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
}
```

---

## Success Criteria

The implementation is successful when:
1. The app feels like a premium, thoughtfully-designed product
2. Users can immediately understand the visual hierarchy
3. Micro-interactions delight without distracting
4. The design supports the "editorial planning" metaphor
5. No element looks like a default browser or Tailwind component
6. The app is memorable and distinctive from generic todo apps

---

*Document Version: 1.0*
*Created: January 2026*
*Design Skill Required: frontend-design*
