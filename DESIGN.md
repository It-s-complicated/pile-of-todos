---
name: Pile of Todos
description: A calm personal weekly planning surface for capturing, triaging, syncing, and finishing tasks.
colors:
  ink-black-surface: '#0c0e10'
  hidden-depth: '#050607'
  charcoal-work-layer-low: '#111416'
  charcoal-work-layer: '#171a1d'
  charcoal-work-layer-high: '#1c2023'
  slate-raised-surface: '#22262a'
  graphite-hover: '#282d31'
  paper-text: '#e2e6eb'
  quiet-text: '#a8abb0'
  soft-outline: '#72767a'
  hairline-outline: '#44484d'
  sage-confirmation: '#b8cbc1'
  sage-confirmation-high: '#c4d3ca'
  sage-container: '#45564e'
  sage-ink: '#33443c'
  sage-container-text: '#d4e8dd'
  dusty-rose-queue: '#e2bec1'
  dusty-rose-container: '#4d3538'
  dusty-rose-ink: '#533a3c'
  dusty-rose-container-text: '#dab7ba'
  pale-blue-future: '#f3f6ff'
  pale-blue-container: '#dbe9ff'
  pale-blue-ink: '#515e70'
  pale-blue-container-text: '#495668'
  soft-red-error: '#fa746f'
  soft-red-error-dim: '#c54d4a'
  red-error-container: '#871f21'
  red-error-ink: '#490006'
  red-error-container-text: '#ff9993'
typography:
  display:
    fontFamily: 'Epilogue, sans-serif'
    fontSize: '1.875rem'
    fontWeight: 800
    lineHeight: 1
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Epilogue, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Epilogue, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'Inter, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  supporting:
    fontFamily: 'Inter, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: 'Inter, sans-serif'
    fontSize: '0.625rem'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '0.32em'
rounded:
  pill: '9999px'
  control: '16px'
  surface: '24px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '24px'
  xxl: '40px'
components:
  button-primary:
    backgroundColor: '{colors.sage-confirmation}'
    textColor: '{colors.sage-ink}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '14px 20px'
    height: '48px'
  button-primary-hover:
    backgroundColor: '{colors.sage-confirmation-high}'
    textColor: '{colors.sage-ink}'
    rounded: '{rounded.control}'
  button-secondary:
    backgroundColor: '{colors.slate-raised-surface}'
    textColor: '{colors.paper-text}'
    typography: '{typography.supporting}'
    rounded: '{rounded.control}'
    padding: '12px 16px'
    height: '48px'
  input-default:
    backgroundColor: '{colors.slate-raised-surface}'
    textColor: '{colors.paper-text}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: '12px 16px'
    height: '48px'
  task-card:
    backgroundColor: '{colors.charcoal-work-layer}'
    textColor: '{colors.paper-text}'
    rounded: '{rounded.surface}'
    padding: '24px'
  status-pill:
    backgroundColor: '{colors.charcoal-work-layer}'
    textColor: '{colors.sage-confirmation}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '8px 12px'
    height: '40px'
---

# Design System: Pile of Todos

## 1. Overview

**Creative North Star: "The Quiet Workbench"**

Pile of Todos is a dim, focused working surface for one person's weekly planning rhythm. It should feel like a dependable desk at the end of a concentrated day: every control is visible, every task has a place, and the interface keeps its voice low while the user decides what matters.

The system is dark because the scene is personal planning in a focused work session, often near the edge of the day when glare feels intrusive and calm contrast helps sustained scanning. It is not a neon productivity toy. The visual language uses soft mechanical controls, quiet tonal layers, and small color signals that confirm state rather than decorate the page.

The product must reject overly bright palettes, loud gradients, massive animations, generic SaaS dashboard tropes, overly cute todo-app styling, marketing-demo polish, neon productivity styling, and generic notes-app cloning.

**Key Characteristics:**

- Compact, tactile surfaces with generous corner rounding and low-contrast borders.
- Muted semantic color used for task state, sync confidence, and primary actions only.
- A fixed bottom composer that treats capture as the main product gesture.
- Dark tonal layering with soft shadows only when a surface floats above the workbench.
- Short, practical copy that supports triage without narrating the obvious.

## 2. Colors

The palette is a restrained dark neutral system with sage as the primary confirmation color, dusty rose for queued or backlog-adjacent work, pale blue for future scheduling, and soft red for errors.

### Primary

- **Sage Confirmation** (`sage-confirmation`): Used for primary actions, current-week status, synced states, selected controls, and focus rings. Its rarity is what makes it reassuring.
- **Sage Confirmation High** (`sage-confirmation-high`): Used for primary hover states when a control needs tactile lift without becoming bright.
- **Sage Container** (`sage-container`): Used as a quiet backing tint for selected or complete states.

### Secondary

- **Dusty Rose Queue** (`dusty-rose-queue`): Used for backlog, retry, archived, and queued states. It should read as a warm pending signal, not a warning.
- **Dusty Rose Container** (`dusty-rose-container`): Used as the tinted badge background for secondary states.

### Tertiary

- **Pale Blue Future** (`pale-blue-future`): Used for future-week tasks and syncing-in-progress signals. It is deliberately pale so future work feels scheduled, not urgent.
- **Pale Blue Container** (`pale-blue-container`): Used only as a low-emphasis support tint for tertiary states.

### Neutral

- **Ink Black Surface** (`ink-black-surface`): The page background and base shell. Never replace it with pure black.
- **Hidden Depth** (`hidden-depth`): The lowest tonal stop, reserved for deep shadow impressions and background gradients.
- **Charcoal Work Layer** (`charcoal-work-layer`): The default card and work surface.
- **Slate Raised Surface** (`slate-raised-surface`): The raised field, pill, badge, and skeleton surface.
- **Graphite Hover** (`graphite-hover`): Used for hover states where color would overstate intent.
- **Paper Text** (`paper-text`): Primary foreground text.
- **Quiet Text** (`quiet-text`): Supporting text, labels, secondary navigation, and descriptions.
- **Soft Outline** (`soft-outline`) and **Hairline Outline** (`hairline-outline`): Borders, dividers, and low-contrast structure. Most borders use low opacity.

### Named Rules

**The Quiet Signal Rule.** Sage is for confirmation, current selection, focus, and the primary add gesture. Do not use it as decoration.

**The Tinted Dark Rule.** The surface is dark but never pure black. Every neutral must carry a slight blue-green cast so the interface feels like a workbench, not a terminal.

**The Semantic Pastel Rule.** Rose, blue, and red are state colors. They explain schedule, sync, or error status. They are forbidden as ornamental accents.

## 3. Typography

**Display Font:** Epilogue, with sans-serif fallback  
**Body Font:** Inter, with sans-serif fallback  
**Label/Mono Font:** Inter, with sans-serif fallback

**Character:** Epilogue gives the product its compact personal identity in headings and the Pile of Todos mark. Inter carries the working interface because task labels, controls, and sync states must remain familiar, legible, and fast to scan.

### Hierarchy

- **Display** (800, `1.875rem`, `1`): Used for the compact brand mark and the largest workspace headers. Do not introduce larger marketing-style hero sizes.
- **Headline** (800, `1.5rem`, `1.1`): Used for workspace titles and dialog headings.
- **Title** (600, `1.125rem`, `1.25`): Used for empty-state titles and compact section titles.
- **Body** (400, `1rem`, `1.5`): Used for task labels, editable fields, and primary reading text. Prose should stay under 75 characters per line where possible.
- **Supporting** (400, `0.875rem`, `1.5`): Used for subtitles, helper text, navigation labels, and secondary descriptions.
- **Label** (600, `0.625rem`, `1`, `0.32em`, uppercase): Used for field labels, sync pills, metadata badges, and section eyebrows.

### Named Rules

**The Working Sans Rule.** UI labels, buttons, badges, and data use Inter. Epilogue is for names and headings only.

**The Tight Scale Rule.** This is a product interface. Keep hierarchy tight and fixed. Do not use fluid display sizes or dramatic type jumps.

## 4. Elevation

The system uses tonal layering first and shadows second. Resting surfaces are separated by charcoal layers, low-opacity borders, and spacing. Shadows appear only when a surface floats, sticks, overlays, or responds to hover.

### Shadow Vocabulary

- **Status Lift** (`0 10px 24px rgba(0, 0, 0, 0.16)`): Used for compact pills and small status surfaces.
- **Card Rest** (`0 10px 28px rgba(0, 0, 0, 0.16)`): Used for task cards at rest.
- **Panel Lift** (`0 16px 40px rgba(0, 0, 0, 0.18)`): Used for empty states and informational panels.
- **Card Hover** (`0 20px 40px rgba(0, 0, 0, 0.24)`): Used only when a task card is actively hovered.
- **Floating Composer** (`0 20px 40px rgba(0, 0, 0, 0.38)`): Used for the fixed new-task composer and week selector.
- **Menu Overlay** (`0 24px 60px rgba(0, 0, 0, 0.22)`): Used for dropdown panels attached to the sticky header.

### Named Rules

**The Tonal First Rule.** If a surface can be distinguished with color, border opacity, and spacing, do not add a new shadow.

**The Floating Surface Rule.** Heavy shadow is reserved for fixed, sticky, or overlay surfaces. A normal card never gets the composer shadow.

## 5. Components

### Buttons

Soft mechanical controls that move slightly on contact.

- **Shape:** Gently rounded controls (`16px`) for main actions, full pills (`9999px`) for compact auth, sync, and icon actions.
- **Primary:** Sage fill with sage-ink text, uppercase Inter label, medium weight, and a minimum height of `48px` for task creation and dialog confirmation.
- **Hover / Focus:** Primary hover brightens to the high sage token, translates up by `2px`, and may gain a small sage-tinted shadow. Focus uses a visible sage ring.
- **Secondary / Ghost:** Secondary controls use raised charcoal fill or a low-opacity outline. Icon actions stay circular and quiet until hover.
- **Disabled:** Disabled buttons keep the same shape, drop to reduced opacity, remove hover lift, and use `cursor-not-allowed`.

### Chips

Metadata chips are small, rounded, and semantic.

- **Style:** Full-pill shape with `10px` label type, wide uppercase tracking, and tinted container backgrounds.
- **State:** Current and complete use sage, backlog and archived use dusty rose, future uses pale blue, past or error uses soft red.
- **Rule:** Chips explain task state. They are not decorative badges.

### Cards / Containers

Task surfaces are tactile but not ornamental.

- **Corner Style:** Large rounded corners (`24px`) on cards, empty states, panels, and the composer.
- **Background:** Default task cards use the charcoal work layer. Raised fields and skeletons use the slate raised surface.
- **Shadow Strategy:** Task cards use card-rest shadow at rest and card-hover shadow only on hover. Static informational panels use panel lift sparingly.
- **Border:** Hairline outline at low opacity. Never use a colored side stripe.
- **Internal Padding:** Task cards use `16px` on small screens and `24px` on larger screens.

### Inputs / Fields

Inputs should feel embedded in the work surface and ready for quick capture.

- **Style:** Raised charcoal background, `16px` radius, low-opacity outline, `16px` horizontal padding, and Inter body text.
- **Focus:** Border shifts toward sage with a soft sage ring. The global focus outline must remain visible.
- **Error / Disabled:** Error messages use red container tint with a full border and compact copy. Disabled fields reduce opacity and keep their position.

### Navigation

Navigation is familiar, compact, and stateful.

- **Style:** Sticky top header with translucent dark surface, low-opacity bottom border, and primary lanes visible before secondary history lanes.
- **Active State:** Active nav gets sage text, a faint sage fill on mobile, and a one-pixel underline on larger screens.
- **Hover State:** Hover changes text toward sage or lifts the background by one tonal layer.
- **Mobile Treatment:** Primary lanes become a compact four-column segmented surface. Completed and archived live in the More views panel.

### Fixed Task Composer

The composer is the signature control.

- **Position:** Fixed near the bottom center with a maximum width of `48rem`.
- **Surface:** Large rounded floating panel with high-opacity charcoal fill, low-opacity border, blur, and the floating composer shadow.
- **Behavior:** Week options reveal only after the user types. Capture stays direct, and scheduling stays secondary.

### Sync and Auth Pills

Sync confidence is visible but quiet.

- **Style:** Full-pill containers with tiny uppercase labels and small semantic dots.
- **Behavior:** Retry appears inline only when needed. Auth state sits in a rounded panel and should not dominate the planning workflow.

## 6. Do's and Don'ts

### Do:

- **Do** use the existing dark token stack for all surfaces. The workbench depends on tonal separation, not random grays.
- **Do** reserve sage for primary actions, current selection, focus, synced states, and completed work.
- **Do** keep task capture prominent with the fixed composer. It is the core product gesture.
- **Do** use skeleton states in the existing charcoal layers instead of center-screen spinners.
- **Do** keep motion between `150ms` and `320ms`, using state feedback only.
- **Do** preserve visible focus states on every control, especially task checkboxes, nav items, fields, and week radio options.
- **Do** keep copy short and practical: labels should help capture, triage, move, sync, or archive.

### Don't:

- **Don't** use overly bright palettes.
- **Don't** use loud gradients.
- **Don't** use massive animations.
- **Don't** use generic SaaS dashboard tropes.
- **Don't** use overly cute todo-app styling.
- **Don't** make the UI feel like a marketing demo, a neon productivity toy, or a clone of a generic notes app.
- **Don't** use pure black or pure white. Use the tinted neutral system.
- **Don't** use a colored `border-left` or `border-right` stripe greater than `1px` on cards, list items, callouts, or alerts.
- **Don't** use gradient text.
- **Don't** add decorative glassmorphism. Existing blur belongs to sticky and floating surfaces only.
- **Don't** create identical marketing-style card grids. This is a task surface.
- **Don't** introduce modals before inline or progressive controls. The current week selector is the exception because it changes a task destination.
- **Don't** use display fonts in UI labels, buttons, badges, or data.
- **Don't** add full-saturation accents to inactive states.
