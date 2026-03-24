---
title: "AI-Generated UI Review Checklist"
impact: HIGH
impactDescription: "Accepting AI output without systematic review ships accessibility violations, design system drift, and hardcoded values to production"
tags: [review, checklist, accessibility, design-tokens, quality, ai-generated]
---

## AI-Generated UI Review Checklist

Every AI-generated component must pass this 10-point checklist before merging. AI tools produce plausible but subtly incorrect code — systematic review catches issues that look correct at a glance.

**Incorrect:**
```tsx
// Accepting v0 output as-is — multiple hidden issues
export function UserCard({ user }) {           // no TypeScript props
  return (
    <div className="bg-[#f8fafc] p-4 rounded-lg shadow-md"  // hardcoded color
         onClick={() => navigate(`/users/${user.id}`)}>      // div with onClick, no keyboard
      <img src={user.avatar} className="w-12 h-12 rounded-full" /> // no alt
      <h3 className="text-[18px] font-semibold">{user.name}</h3>   // hardcoded size
      <p className="text-[#64748b]">{user.role}</p>                 // hardcoded color
    </div>
  )
}
```

**Correct:**
```tsx
// After systematic review — all 10 points addressed
interface UserCardProps {
  user: User
  onSelect?: (userId: string) => void
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <button
      type="button"
      className="bg-muted p-4 rounded-lg shadow-md text-left w-full
                 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onSelect?.(user.id)}
    >
      <img
        src={user.avatar}
        alt={`${user.name} avatar`}
        className="size-12 rounded-full"
      />
      <h3 className="text-lg font-semibold">{user.name}</h3>
      <p className="text-muted-foreground">{user.role}</p>
    </button>
  )
}
```

### The 10-Point Checklist

| # | Check | What to Look For |
|---|-------|-----------------|
| 1 | **Semantic HTML** | `<button>` not `<div onClick>`, `<nav>`, `<main>`, `<article>` |
| 2 | **ARIA roles** | Interactive elements have labels, live regions for dynamic content |
| 3 | **Design tokens** | No hardcoded hex/rgb/hsl — use Tailwind semantic classes (`bg-primary`) |
| 4 | **TypeScript props** | Explicit interface, no `any`, proper event handler types |
| 5 | **Responsive** | Works at 320px, 768px, 1024px+ — no horizontal overflow |
| 6 | **Keyboard navigation** | Tab order, Enter/Space activation, Escape to close |
| 7 | **Focus indicators** | `focus-visible:ring-2` on all interactive elements |
| 8 | **Image alt text** | Meaningful alt on images, `alt=""` for decorative |
| 9 | **Error states** | Loading, error, empty states handled — not just happy path |
| 10 | **No console/debug** | Remove `console.log`, TODO comments, placeholder data |

**Key rules:**
- Run through all 10 points for every AI-generated component — no exceptions
- Flag any hardcoded color, spacing, or typography value as a blocking issue
- Interactive `<div>` or `<span>` elements must be converted to `<button>` or `<a>`
- Missing TypeScript props interface is a blocking issue — AI often uses implicit `any`

Reference: https://www.w3.org/WAI/ARIA/apg/patterns/
