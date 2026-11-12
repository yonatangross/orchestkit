---
title: "Design Token Injection in AI Prompts"
impact: "HIGH"
impactDescription: "Without explicit token names in prompts, AI tools generate hardcoded hex/rgb values that drift from the design system and break theme switching"
tags: [design-tokens, oklch, tailwind, theming, ai-prompt, color-system]
---

## Design Token Injection in AI Prompts

Always pass design token variable names in AI prompts. AI tools cannot infer your token system — they default to hardcoded values that break dark mode, theme switching, and design system consistency.

**Incorrect:**
```
# Vague color instruction
"Make a blue primary button with a red error state"
```

AI output:
```tsx
// Hardcoded values — breaks dark mode, ignores design system
<button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
  Submit
</button>
<p className="text-[#ef4444]">Error message</p>
```

**Correct:**
```
# Explicit token names in prompt
"Use these design tokens:
 - Primary: bg-primary, text-primary-foreground, hover:bg-primary/90
 - Destructive: text-destructive
 - Muted: bg-muted, text-muted-foreground
 - Border: border-border
 - Ring: ring-ring for focus states
 All colors use OKLCH via CSS custom properties."
```

AI output:
```tsx
// Token-based — works with dark mode, respects design system
<Button variant="default">Submit</Button>
<p className="text-destructive">Error message</p>
```

### Token Injection Template

Include this block in every AI UI prompt:

```
Design tokens (use these exact class names):
Colors:
  - bg-primary / text-primary-foreground — main actions
  - bg-secondary / text-secondary-foreground — secondary actions
  - bg-destructive / text-destructive-foreground — errors, delete
  - bg-muted / text-muted-foreground — disabled, hints
  - border-border — all borders
  - ring-ring — focus rings
Spacing: p-4 (card), p-6 (section), gap-4 (form fields), gap-2 (inline)
Radius: rounded-md (buttons), rounded-lg (cards), rounded-full (avatars)
Typography: text-sm (labels), text-base (body), text-lg (headings)

DO NOT use hardcoded hex, rgb, or hsl values.
DO NOT use arbitrary Tailwind values like bg-[#3b82f6].
```

### OKLCH Token Architecture

```css
/* Modern OKLCH tokens — wider gamut, perceptually uniform */
:root {
  --color-primary: oklch(0.55 0.2 250);
  --color-primary-foreground: oklch(0.98 0.005 250);
  --color-destructive: oklch(0.55 0.2 25);
  --color-muted: oklch(0.95 0.01 250);
  --color-muted-foreground: oklch(0.55 0.01 250);
}

.dark {
  --color-primary: oklch(0.7 0.18 250);
  --color-destructive: oklch(0.65 0.2 25);
  --color-muted: oklch(0.2 0.01 250);
  --color-muted-foreground: oklch(0.65 0.01 250);
}
```

**Key rules:**
- Include the full token injection block in every AI prompt — AI tools cannot read your CSS variables
- Flag any `bg-[#...]`, `text-[#...]`, or inline `style={{ color: "..." }}` as a blocking review issue
- After generation, search-and-replace any remaining hardcoded values with token classes
- Verify dark mode works — hardcoded values are invisible against dark backgrounds
- Use OKLCH for new token definitions — wider gamut and perceptually uniform lightness

Reference: https://ui.shadcn.com/docs/theming
