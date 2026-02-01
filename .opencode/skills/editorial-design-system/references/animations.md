# Animations & Micro-interactions

Animation specifications and implementation patterns for the Editorial Design System.

## Animation Principles

- **Purposeful**: Every animation serves a functional purpose (feedback, guidance, delight)
- **Performant**: Use transform and opacity only for 60fps animations
- **Consistent**: Same timing and easing across similar interactions
- **Subtle**: Enhance without distracting from content

## Timing Standards

```css
--transition-fast: 150ms ease;    /* Button hovers, quick feedback */
--transition-base: 200ms ease;    /* Standard transitions */
--transition-slow: 300ms ease;    /* Page transitions, modals */

/* Easing functions */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);       /* Entering elements */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* Complex transitions */
```

## Page Load: Staggered List Entrance

### Implementation
```vue
<template>
  <div class="space-y-3">
    <div
      v-for="(item, index) in items"
      :key="item.id"
      :style="{ animationDelay: `${index * 50}ms` }"
      class="
        opacity-0 translate-y-2.5
        animate-[fade-in-up_300ms_ease-out_forwards]
      "
    >
      <TodoCard :item="item" />
    </div>
  </div>
</template>

<style>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
```

### Tailwind Config Extension
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      animation: {
        'fade-in-up': 'fade-in-up 300ms ease-out forwards',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
}
```

## Card Hover: Lift Effect

### Implementation
```vue
<div
  class="
    bg-white border border-[#e8e6e1] rounded-lg p-4
    shadow-[0_1px_2px_rgba(26,26,46,0.04)]
    hover:shadow-[0_4px_6px_rgba(26,26,46,0.06)]
    hover:-translate-y-px
    transition-all duration-200 ease-out
  "
>
  <!-- Card content -->
</div>
```

### CSS-only Alternative
```css
.card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
  box-shadow: 0 1px 2px rgba(26, 26, 46, 0.04);
}

.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(26, 26, 46, 0.06);
}
```

## Checkbox Toggle

### Scale Pulse Animation
```vue
<template>
  <button
    class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200" :class="[
      checked && 'scale-pulse',
    ]"
    @click="toggle"
  >
    <Check v-if="checked" class="w-3.5 h-3.5" />
  </button>
</template>

<style>
.scale-pulse {
  animation: scale-pulse 200ms ease-out;
}

@keyframes scale-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
</style>
```

## Button Hover

### Background Color Shift
```vue
<button
  class="
    px-6 py-3 bg-[#1a1a2e] text-white rounded-lg
    font-medium text-sm
    transition-colors duration-150
    hover:bg-[#2a2a3e]
    active:scale-[0.98] active:duration-75
  "
>
  Action
</button>
```

## Navigation Active State

### Smooth Background Transition
```vue
<nav class="flex gap-2">
  <a
    v-for="link in links"
    :key="link.path"
    :class="[
      'px-4 py-2 rounded-full text-sm font-medium',
      'transition-all duration-200',
      isActive(link.path)
        ? 'bg-[#1a1a2e] text-white'
        : 'text-[#4a4a5a] hover:bg-[#faf9f6]'
    ]"
  >
    {{ link.label }}
  </a>
</nav>
```

## Modal Entrance

### Backdrop + Content Animation
```vue
<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 bg-black/40 backdrop-blur-sm"
        @click="close"
      />
    </Transition>

    <!-- Modal -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="fixed inset-0 flex items-center justify-center p-4"
      >
        <div
          class="bg-white rounded-xl p-6 max-w-md w-full shadow-lg"
          @click.stop
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
```

## Form Validation Error

### Slide Down + Fade In
```vue
<template>
  <div class="space-y-2">
    <input v-model="value" class="input">

    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="error"
        class="flex items-center gap-2 text-sm text-[#c45a5a]"
      >
        <AlertCircle class="w-4 h-4" />
        {{ error }}
      </div>
    </Transition>
  </div>
</template>
```

### Shake Animation (on validation fail)
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.shake {
  animation: shake 300ms ease-in-out;
}
```

## List Item Removal

### Exit Animation
```vue
<template>
  <TransitionGroup
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2.5"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-x-0"
    leave-to-class="opacity-0 -translate-x-4"
    tag="div"
    class="space-y-3"
  >
    <TodoItem
      v-for="item in items"
      :key="item.id"
      :item="item"
    />
  </TransitionGroup>
</template>
```

## Tooltip (Optional Enhancement)

### Fade In Tooltip
```vue
<template>
  <div class="relative group">
    <button class="icon-button">
      <Archive class="w-5 h-5" />
    </button>

    <div
      class="
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2
        px-2 py-1 bg-[#1a1a2e] text-white text-xs rounded
        opacity-0 invisible
        group-hover:opacity-100 group-hover:visible
        transition-all duration-150
        whitespace-nowrap
      "
    >
      Archive item
      <!-- Arrow -->
      <div
        class="
          absolute top-full left-1/2 -translate-x-1/2
          border-4 border-transparent border-t-[#1a1a2e]
        "
      />
    </div>
  </div>
</template>
```

## Loading State

### Skeleton Loading
```vue
<template>
  <div class="space-y-3">
    <div
      v-for="i in 3"
      :key="i"
      class="
        h-16 bg-[#e8e6e1] rounded-lg
        animate-pulse
      "
    />
  </div>
</template>
```

### Custom Loading Spinner
```vue
<template>
  <div class="flex items-center justify-center py-12">
    <div
      class="
        size-8 border-2 border-[#e8e6e1] border-t-[#e07a5f]
        rounded-full
        animate-spin
      "
    />
  </div>
</template>
```

**Note**: Uses Tailwind 4 `size-*` class instead of `w-* h-*`.

## Success Feedback

### Checkmark Animation
```vue
<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-50"
    enter-to-class="opacity-100 scale-100"
  >
    <div
      v-if="showSuccess"
      class="
        flex items-center gap-2
        px-4 py-3 bg-[#e8f0eb] text-[#5a8a6e] rounded-lg
      "
    >
      <CheckCircle class="w-5 h-5" />
      <span class="font-medium">Changes saved successfully</span>
    </div>
  </Transition>
</template>
```

## Reduced Motion Support

Always respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Or with Tailwind:
```html
<div class="motion-reduce:transition-none motion-reduce:animate-none">
  <!-- Content -->
</div>
```
