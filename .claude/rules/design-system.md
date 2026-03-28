# Glob: **/*.{tsx,css}

## Design System

Dark mode only. Three elevation tiers.

### Colors (use CSS variables or hex values)

- bg-base: `#09090B` — page background
- bg-surface: `#18181B` — cards, sidebar, header
- bg-elevated: `#27272A` — inputs, dropdowns, hover states
- text-primary: `#FAFAFA` — headings, important text
- text-secondary: `#A1A1AA` — body text, descriptions
- text-muted: `#52525B` — placeholders, disabled text
- border-default: `#3F3F46` — input borders, dividers
- border-subtle: `#27272A` — section dividers
- accent: `#6366F1` — primary actions, active states, links

### Semantic Colors

- success: `#10B981`
- warning: `#F59E0B`
- error: `#EF4444`
- info: `#3B82F6`

### Component Patterns

- Rounded corners: `rounded-lg` for inputs, `rounded-xl` for cards, `rounded-2xl` for modals
- Transitions: always add `transition-colors` on interactive elements
- Hover states: lighten border or background by one tier
- Focus states: `focus:outline-none focus:border-[#6366F1]`
- Button padding: `px-3 py-1.5` for small, `px-4 py-2` for default
- Text sizes: `text-xs` for labels/badges, `text-sm` for body, `text-base` for headings

### Typography

- Font: Geist via CDN (loaded in index.html, NOT npm)
- Font weights: 400 (normal), 500 (medium), 600 (semibold)
- Tracking: `tracking-tight` for headings, `tracking-wider` for uppercase labels

### Animation

- Use Framer Motion for layout animations and modals
- Spring transitions: `type: 'spring', damping: 30, stiffness: 400`
- Sidebar collapse: animated `marginLeft` on main content
