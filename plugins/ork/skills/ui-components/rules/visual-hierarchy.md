---
title: Design visual hierarchy using weight, contrast, and spatial relationships — not color alone
impact: HIGH
impactDescription: "Clear visual hierarchy reduces cognitive load and guides users to the right action without confusion"
tags: visual-hierarchy, layout, buttons, spacing, proximity, eye-tracking, accessibility
---

## Visual Hierarchy & Layout

**Incorrect — competing primaries and flat hierarchy:**
```tsx
// WRONG: Two primary buttons side-by-side (creates decision paralysis)
<div className="flex gap-2">
  <button className="bg-primary text-white px-4 py-2 rounded">Save</button>
  <button className="bg-primary text-white px-4 py-2 rounded">Cancel</button>
</div>

// WRONG: Emphasizing everything equally — nothing stands out
<h1 className="font-bold text-xl">Title</h1>
<p className="font-bold text-xl">Body copy that competes with heading</p>
<span className="font-bold text-xl">Label also fighting for attention</span>
```

**Correct — three-tier button hierarchy with de-emphasized secondary:**
```tsx
// RIGHT: One primary CTA. Secondary is outlined. Tertiary is ghost/text.
<div className="flex items-center gap-3">
  {/* Primary — full color, highest visual weight */}
  <Button variant="default">Save changes</Button>

  {/* Secondary — outline, reduced weight */}
  <Button variant="outline">Preview</Button>

  {/* Tertiary — ghost/text, lowest weight */}
  <Button variant="ghost">Cancel</Button>
</div>

// RIGHT: De-emphasize secondary content rather than only boosting primary
<h1 className="text-2xl font-bold text-foreground">Page title</h1>
<p className="text-base text-muted-foreground">Supporting description</p>
<span className="text-sm text-muted-foreground/70">Metadata label</span>
```

### Hierarchy Principles

| Principle | Rule | Rationale |
|-----------|------|-----------|
| Button tiers | primary → outline → ghost | One primary per view maximum |
| De-emphasis | Mute secondary content | Easier than boosting everything |
| F/Z scan path | Critical info top-left → right | Matches natural eye movement |
| Von Restorff | Isolate ONE element per view | Uniqueness signals importance |
| Proximity | Group related elements closely | Spacing communicates relationship |
| Max-width | Contain layout, don't fill screen | Prevents unreadable line lengths |

### Layout Rules

```tsx
// RIGHT: Contain content width for readability
<main className="max-w-4xl mx-auto px-4">
  {/* Never stretch to 100vw on wide screens */}
</main>

// RIGHT: Use deliberate spacing to show/break relationships
<section className="space-y-1">   {/* Tight = related items */}
  <label>Email</label>
  <input type="email" />
</section>
<section className="mt-8">       {/* Gap = new section */}
  <label>Password</label>
  <input type="password" />
</section>
```

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Grayscale test | Design in grayscale first — hierarchy must work without color |
| Button count | Maximum ONE primary button per view |
| Emphasis strategy | De-emphasize secondary; don't over-emphasize primary |
| Von Restorff | Use isolation sparingly — max one "different" element per view |
| Readability cap | `max-w-prose` or `max-w-4xl` on all content containers |
