---
title: "AI UI Generation Failure Modes"
version: 1.0.0
---

# AI UI Generation Failure Modes

Top 10 failure modes of AI-generated UI components, ordered by frequency. Each includes detection method and fix.

## 1. Hardcoded Color Values

**Frequency:** Very common (80%+ of AI output)
**Problem:** AI generates `bg-[#3b82f6]`, `text-[#64748b]`, or inline `style={{ color: "#..." }}` instead of design tokens.
**Detection:** `grep -rn 'bg-\[#\|text-\[#\|border-\[#\|style={{' src/components/`
**Fix:** Replace with semantic token classes: `bg-primary`, `text-muted-foreground`, `border-border`.

## 2. Non-Semantic HTML

**Frequency:** Very common
**Problem:** AI uses `<div onClick>` instead of `<button>`, `<div>` instead of `<nav>`, `<span>` for headings.
**Detection:** ESLint `jsx-a11y/no-noninteractive-element-interactions`, `jsx-a11y/click-events-have-key-events`.
**Fix:** Replace with semantic elements: `<button>`, `<nav>`, `<main>`, `<article>`, `<section>`.

## 3. Missing Loading/Error States

**Frequency:** Common (60%+)
**Problem:** AI generates the happy path only. No loading skeleton, no error boundary, no empty state.
**Detection:** Search for state handling: `grep -rn 'isLoading\|isError\|isEmpty' component.tsx`. If absent, states are missing.
**Fix:** Use iterative prompting (Pass 2) to add states. See `rules/ai-iteration-patterns.md`.

## 4. Implicit `any` TypeScript

**Frequency:** Common
**Problem:** AI generates `function Card({ data })` without TypeScript interface, creating implicit `any`.
**Detection:** `tsc --noEmit` with `strict: true` in tsconfig.
**Fix:** Add explicit props interface with union types for variants.

## 5. Bloated Imports

**Frequency:** Common
**Problem:** AI imports entire icon libraries (`import * from "lucide-react"`) or unused dependencies.
**Detection:** `size-limit` CI check, ESLint `no-unused-imports` rule.
**Fix:** Import individual icons: `import { Search, ChevronDown } from "lucide-react"`.

## 6. Missing Focus Management

**Frequency:** Common
**Problem:** No `focus-visible:ring` on interactive elements, no focus trap in modals, no focus return after close.
**Detection:** Tab through the component — if focus is invisible or gets lost, it fails.
**Fix:** Add `focus-visible:ring-2 focus-visible:ring-ring` to all interactive elements. Use Radix Dialog for focus trapping.

## 7. Incorrect ARIA Usage

**Frequency:** Moderate (40%+)
**Problem:** AI adds ARIA attributes incorrectly — `aria-label` on non-interactive elements, redundant roles, conflicting attributes.
**Detection:** axe-core or Storybook a11y addon catches most ARIA errors.
**Fix:** Follow WAI-ARIA Authoring Practices. Remove ARIA when semantic HTML conveys the same meaning.

## 8. Desktop-Only Layout

**Frequency:** Moderate
**Problem:** AI generates layouts that overflow on mobile. Fixed widths, no responsive breakpoints, horizontal scroll.
**Detection:** Chrome DevTools responsive mode at 320px width.
**Fix:** Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). Test at 320px, 768px, 1024px.

## 9. String Concatenation for Classes

**Frequency:** Moderate
**Problem:** AI generates `className={"base " + (active ? "bg-blue-500" : "bg-gray-200")}` instead of CVA or `cn()`.
**Detection:** Grep for template literals or string concatenation in className.
**Fix:** Use `cn()` from `@/lib/utils` or CVA for variant-based styling. See `rules/ai-refactoring-conformance.md`.

## 10. Stale or Deprecated APIs

**Frequency:** Occasional
**Problem:** AI generates code using deprecated APIs — `framer-motion` (now `motion/react`), React class components, old Next.js pages router patterns.
**Detection:** Code review, comparing against current documentation.
**Fix:** Specify exact library versions and import paths in prompts. See `rules/ai-prompt-patterns.md`.

## Quick Detection Script

Run this after receiving AI-generated components:

```bash
# Check for common failure modes in AI-generated components
echo "=== Hardcoded colors ==="
grep -rn 'bg-\[#\|text-\[#\|border-\[#' "$1"

echo "=== Non-semantic interactive elements ==="
grep -rn '<div.*onClick\|<span.*onClick' "$1"

echo "=== Missing TypeScript props ==="
grep -rn 'function.*{.*})\s*{' "$1" | grep -v 'Props\|interface\|type '

echo "=== Bloated imports ==="
grep -rn 'import \*' "$1"

echo "=== String class concatenation ==="
grep -rn "className={['\"]" "$1"
```
