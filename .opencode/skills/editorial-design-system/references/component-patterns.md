# Component Patterns

Implementation patterns for editorial-style Vue components with Tailwind CSS.

## Navigation (Pill Buttons)

### Structure
```vue
<template>
  <nav class="flex gap-2">
    <RouterLink
      v-for="route in routes"
      :key="route.name"
      :to="route.path"
      class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200" :class="[
        isActive(route.name)
          ? 'bg-[#1a1a2e] text-white'
          : 'text-[#4a4a5a] hover:bg-[#faf9f6]',
      ]"
    >
      {{ route.label }}
    </RouterLink>
  </nav>
</template>
```

### Key Features
- Full rounded pills (`rounded-full`)
- Navy background for active state
- Cream hover background for inactive
- 8px gap between items
- 14px font size, medium weight

## Card Components

### Todo Item Card with Status Border
```vue
<script setup>
const props = defineProps({
  label: String,
  metadata: String,
  status: String // 'current', 'future', 'past', 'backlog'
})

const statusBorderColor = computed(() => ({
  current: 'bg-[#e07a5f]', // coral
  future: 'bg-[#5a8a6e]', // sage
  past: 'bg-[#7a7a8a]', // gray
  backlog: 'bg-[#d4a373]' // beige
}[props.status]))
</script>

<template>
  <div
    class="relative bg-white border border-[#e8e6e1] rounded-lg p-4 shadow-[0_1px_2px_rgba(26,26,46,0.04)] hover:shadow-[0_4px_6px_rgba(26,26,46,0.06)] hover:-translate-y-px transition-all duration-200 flex items-center gap-3"
  >
    <!-- Left status border -->
    <div
      class="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" :class="[
        statusBorderColor,
      ]"
    />

    <!-- Content -->
    <div class="flex-1">
      <p class="font-body text-base text-[#1a1a2e]">
        {{ label }}
      </p>
      <p class="text-sm text-[#7a7a8a] font-mono">
        {{ metadata }}
      </p>
    </div>
  </div>
</template>
```

## Custom Checkbox

### Implementation
```vue
<script setup>
import { Check } from 'lucide-vue-next'

const checked = defineModel()

function toggle() {
  checked.value = !checked.value
}
</script>

<template>
  <button
    class="size-5 rounded border-2 flex items-center justify-center transition-all duration-200" :class="[
      checked
        ? 'bg-[#1a1a2e] border-[#1a1a2e]'
        : 'bg-white border-[#1a1a2e]',
    ]"
    @click="toggle"
  >
    <Check
      v-if="checked"
      class="size-3.5 text-white"
      stroke-width="2.5"
    />
  </button>
</template>
```

**Note**: Uses Tailwind 4 `size-*` classes (`size-5` instead of `w-5 h-5`).

## Input Forms

### Text Input with Validation
```vue
<script setup>
import { AlertCircle } from 'lucide-vue-next'

defineProps({ error: String })
const value = defineModel()
</script>

<template>
  <div class="space-y-2">
    <input
      v-model="value"
      class="w-full px-4 py-3 bg-white border rounded-lg font-body text-base text-[#1a1a2e] placeholder:text-[#7a7a8a] focus:outline-none focus:border-[#1a1a2e] focus:shadow-[0_0_0_3px_rgba(26,26,46,0.1)] transition-all duration-200" :class="[
        error ? 'border-[#c45a5a]' : 'border-[#e8e6e1]',
      ]"
      placeholder="Enter task..."
    >

    <!-- Validation Error -->
    <div
      v-if="error"
      class="flex items-center gap-2 text-sm text-[#c45a5a] animate-in slide-in-from-top-1"
    >
      <AlertCircle class="size-4" />
      {{ error }}
    </div>
  </div>
</template>
```

## Buttons

### Primary Button (Navy)
```vue
<button
  class="
    px-6 py-3 bg-[#1a1a2e] text-white rounded-lg
    font-body font-medium text-sm
    hover:bg-[#2a2a3e] active:scale-[0.98]
    transition-all duration-150
    disabled:opacity-50 disabled:cursor-not-allowed
  "
>
  {{ label }}
</button>
```

### Accent Button (Coral)
```vue
<button
  class="
    px-6 py-3 bg-[#e07a5f] text-white rounded-lg
    font-body font-medium text-sm
    hover:bg-[#c45a3f] active:scale-[0.98]
    transition-all duration-150
  "
>
  {{ label }}
</button>
```

### Secondary Button
```vue
<button
  class="
    px-6 py-3 bg-[#faf9f6] text-[#1a1a2e] rounded-lg
    font-body font-medium text-sm
    border border-[#e8e6e1]
    hover:bg-[#f0efe9] active:scale-[0.98]
    transition-all duration-150
  "
>
  {{ label }}
</button>
```

### Icon Button
```vue
<button
  class="
    size-8 flex items-center justify-center
    rounded-lg text-[#7a7a8a]
    hover:bg-[#faf9f6] hover:text-[#1a1a2e]
    transition-all duration-150
  "
  :title="tooltip"
>
  <slot />
</button>
```

**Note**: Using Tailwind 4's `size-*` shorthand for square dimensions.

## Modal/Dialog

### Modal Container
```vue
<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      v-if="open"
      class="
        fixed inset-0 bg-black/40 backdrop-blur-sm
        animate-in fade-in duration-200
      "
      @click="close"
    />

    <!-- Modal -->
    <div
      v-if="open"
      class="
        fixed inset-0 flex items-center justify-center p-4
        pointer-events-none
      "
    >
      <div
        class="
          bg-white rounded-xl p-6 max-w-md w-full
          shadow-[0_10px_24px_rgba(26,26,46,0.12)]
          animate-in zoom-in-95 fade-in duration-300
          pointer-events-auto
        "
        @click.stop
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
```

## Empty States

### Empty State Pattern
```vue
<script setup>
import { Inbox } from 'lucide-vue-next'

defineProps({
  title: { type: String, default: 'No items yet' },
  description: { type: String, default: 'Get started by adding your first item above.' }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div
      class="
        size-16 rounded-full bg-[#faf9f6]
        flex items-center justify-center mb-4
      "
    >
      <Inbox class="size-8 text-[#7a7a8a]" />
    </div>

    <h3 class="font-display text-xl text-[#1a1a2e] mb-2">
      {{ title }}
    </h3>

    <p class="font-body text-[#7a7a8a] max-w-sm">
      {{ description }}
    </p>
  </div>
</template>
```

## Import/Export Buttons

### Action Button Group
```vue
<script setup>
import { Download, Upload } from 'lucide-vue-next'
</script>

<template>
  <div class="flex gap-2">
    <button
      class="
        flex items-center gap-2 px-3 py-2
        bg-[#5a8a6e] text-white rounded-lg
        text-sm font-medium
        hover:bg-[#4a7a5e] transition-colors duration-150
      "
      @click="export"
    >
      <Download class="size-4" />
      Export
    </button>

    <button
      class="
        flex items-center gap-2 px-3 py-2
        bg-[#d4a373] text-white rounded-lg
        text-sm font-medium
        hover:bg-[#c49363] transition-colors duration-150
      "
      @click="import"
    >
      <Upload class="size-4" />
      Import
    </button>
  </div>
</template>
```

## View Headers

### Page Header with Title
```vue
<script setup>
defineProps({
  title: String,
  subtitle: String
})
</script>

<template>
  <header class="mb-8">
    <h1
      class="
        font-display text-[2.5rem] leading-tight
        text-[#1a1a2e] tracking-tight
      "
    >
      {{ title }}
    </h1>

    <p
      v-if="subtitle"
      class="mt-2 font-body text-lg text-[#4a4a5a]"
    >
      {{ subtitle }}
    </p>
  </header>
</template>
```

## Background Texture (Optional Polish)

### Subtle Paper Grain
```css
/* Add to main app container */
.app-background {
  background-color: #faf9f6;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  background-blend-mode: overlay;
  opacity: 0.03;
}
```

Or use a simpler CSS-only approach:
```css
body {
  background-color: #faf9f6;
  background-image:
    radial-gradient(circle at 20% 80%, rgba(224, 122, 95, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(90, 138, 110, 0.03) 0%, transparent 50%);
}
```
