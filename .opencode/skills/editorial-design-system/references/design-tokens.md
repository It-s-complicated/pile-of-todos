# Design Tokens

Complete design token reference for the Editorial Design System.

## Color Palette

### Brand Colors
```css
--color-navy: #1a1a2e;           /* Primary actions, nav active */
--color-coral: #e07a5f;          /* Accent, CTAs, highlights */
--color-coral-dark: #c45a3f;     /* Coral hover state */
```

### Background Colors
```css
--color-cream: #faf9f6;          /* Main app background */
--color-paper: #ffffff;          /* Card backgrounds */
--color-paper-elevated: #ffffff; /* Modal/popover backgrounds */
```

### Text Colors
```css
--color-text-primary: #1a1a2e;   /* Headlines, primary text */
--color-text-secondary: #4a4a5a; /* Body text */
--color-text-muted: #7a7a8a;     /* Metadata, hints */
--color-text-inverse: #ffffff;   /* Text on dark backgrounds */
```

### Status Colors
```css
--color-success: #5a8a6e;        /* Completed items, success */
--color-success-light: #e8f0eb;  /* Success backgrounds */
--color-warning: #d4a373;        /* Warnings, attention */
--color-warning-light: #faf3e8;  /* Warning backgrounds */
--color-danger: #c45a5a;         /* Destructive actions */
--color-danger-light: #f5e8e8;   /* Danger backgrounds */
```

### Week Status Indicators (Left Border Accents)
```css
--color-week-current: #e07a5f;   /* Current week - coral */
--color-week-future: #5a8a6e;    /* Future weeks - sage */
--color-week-past: #7a7a8a;      /* Past weeks - gray */
--color-week-backlog: #d4a373;   /* Backlog - warm beige */
```

### Borders & Dividers
```css
--color-border: #e8e6e1;         /* Card borders, dividers */
--color-border-hover: #d8d6d1;   /* Border hover state */
```

## Typography

### Font Families
```css
--font-display: 'Playfair Display', serif;      /* Headlines */
--font-body: 'Source Sans 3', sans-serif;       /* UI text */
--font-mono: 'IBM Plex Mono', monospace;        /* Metadata */
```

### Typography Scale
```css
--text-hero: 2.5rem (40px)       /* View titles */
--text-xl: 1.5rem (24px)         /* Section headers */
--text-lg: 1.125rem (18px)       /* Emphasized text */
--text-base: 1rem (16px)         /* Body text */
--text-sm: 0.875rem (14px)       /* Labels, metadata */
--text-xs: 0.75rem (12px)        /* Fine print */
```

### Font Weights
- 400 (regular)
- 500 (medium)
- 600 (semibold)
- 700 (bold)

### Letter Spacing
```css
--tracking-tight: -0.02em;       /* Headlines */
--tracking-normal: 0;            /* Body text */
```

## Spacing Scale

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

## Shadows

```css
/* Subtle (cards at rest) */
--shadow-sm: 0 1px 2px rgba(26, 26, 46, 0.04);

/* Medium (hover states) */
--shadow-md: 0 4px 6px rgba(26, 26, 46, 0.06);

/* Large (modals, elevated) */
--shadow-lg: 0 10px 24px rgba(26, 26, 46, 0.12);
```

## Border Radius

```css
--radius-sm: 4px;                 /* Small elements */
--radius-md: 8px;                 /* Cards, inputs */
--radius-lg: 12px;                /* Modals */
--radius-full: 9999px;            /* Pills, buttons */
```

## Transitions

```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;

/* Easing functions */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

## Complete CSS Variables Template

```css
:root {
  /* Brand Colors */
  --color-navy: #1a1a2e;
  --color-coral: #e07a5f;
  --color-coral-dark: #c45a3f;

  /* Backgrounds */
  --color-cream: #faf9f6;
  --color-paper: #ffffff;
  --color-paper-elevated: #ffffff;

  /* Text */
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #4a4a5a;
  --color-text-muted: #7a7a8a;
  --color-text-inverse: #ffffff;

  /* Status */
  --color-success: #5a8a6e;
  --color-success-light: #e8f0eb;
  --color-warning: #d4a373;
  --color-warning-light: #faf3e8;
  --color-danger: #c45a5a;
  --color-danger-light: #f5e8e8;

  /* Week Indicators */
  --color-week-current: #e07a5f;
  --color-week-future: #5a8a6e;
  --color-week-past: #7a7a8a;
  --color-week-backlog: #d4a373;

  /* Borders */
  --color-border: #e8e6e1;
  --color-border-hover: #d8d6d1;

  /* Typography */
  --font-display: 'Playfair Display', serif;
  --font-body: 'Source Sans 3', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(26, 26, 46, 0.04);
  --shadow-md: 0 4px 6px rgba(26, 26, 46, 0.06);
  --shadow-lg: 0 10px 24px rgba(26, 26, 46, 0.12);

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```
