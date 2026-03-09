---
title: Design intentional empty states with clear structure, actionable CTAs, and skeleton-first loading
impact: HIGH
impactDescription: "Empty states are onboarding moments — a blank screen erodes trust; a well-designed empty state converts users"
tags: empty-states, loading, skeleton, onboarding, ux-patterns, accessibility
---

## Empty State Patterns

**Incorrect — blank screen and unusable no-results state:**
```tsx
// WRONG: Renders nothing when list is empty
function ProjectList({ projects }) {
  return (
    <ul>
      {projects.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  )
}

// WRONG: Clinical message with no guidance or action
{projects.length === 0 && <p>No projects.</p>}

// WRONG: Flash empty state before data loads (jarring UX)
{!isLoading && data.length === 0 && <EmptyState />}
{isLoading && <Spinner />}
```

**Correct — skeleton-first, then structured empty state:**
```tsx
// RIGHT: Skeleton while loading → empty state only if data is truly absent
function ProjectList({ isLoading, projects }: Props) {
  if (isLoading) return <ProjectListSkeleton />

  if (projects.length === 0) return <EmptyProjects />

  return (
    <ul className="space-y-2">
      {projects.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  )
}

// RIGHT: Structured empty state — icon + headline + description + CTA
function EmptyProjects() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
      role="status"
      aria-label="No projects yet"
    >
      {/* 1. Illustration or icon */}
      <div className="rounded-full bg-muted p-4">
        <FolderPlusIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>

      {/* 2. Encouraging headline (not clinical) */}
      <h2 className="text-lg font-semibold text-foreground">
        Create your first project
      </h2>

      {/* 3. Context description */}
      <p className="max-w-sm text-sm text-muted-foreground">
        Projects help you organise work and collaborate with your team.
        Get started in under a minute.
      </p>

      {/* 4. Primary action */}
      <Button>
        <PlusIcon className="mr-2 h-4 w-4" aria-hidden />
        New project
      </Button>
    </div>
  )
}
```

### Empty State Taxonomy

| Cause | Tone | CTA Example |
|-------|------|-------------|
| First-time (onboarding) | Encouraging, welcoming | "Create your first project" |
| No search results | Neutral, helpful | "Try different keywords or clear filters" |
| Error / failed to load | Reassuring, recovery | "Something went wrong — try again" |
| Permission / access | Clear, non-alarming | "Ask your admin for access" |

### Structure Checklist

```
[x] Icon or illustration (visual anchor)
[x] Headline — actionable, not clinical ("Create X" not "No X found")
[x] Description — 1-2 sentences of context
[x] Primary CTA button — one clear next step
[ ] Optional: secondary link for help docs
```

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Blank screen | Never acceptable — always design an empty state |
| Loading order | Skeleton first → empty state if truly empty (no flash) |
| Headline tone | Encouraging and action-oriented, never clinical |
| CTA count | One primary action maximum per empty state |
| Role attribute | `role="status"` on the container for screen reader announcement |
| Cause-specific | Different empty states for first-time, no-results, error, permissions |
