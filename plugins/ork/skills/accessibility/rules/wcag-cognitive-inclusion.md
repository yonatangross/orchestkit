---
title: Design for cognitive accessibility including ADHD, autism, and dyslexia support
category: modern-web
impact: HIGH
impactDescription: "Cognitive accessibility ensures users with ADHD, autism, dyslexia, and cognitive fatigue can navigate and understand content without being overwhelmed"
tags: wcag, cognitive, adhd, autism, dyslexia, accessibility, inclusion
---

# Cognitive Inclusion (WCAG 2.2 + 2026 Best Practices)

## Principle

Accessibility extends beyond screen readers and keyboard nav. Design for how people **think and process** — reduce cognitive load, manage information density, and respect attention limitations.

## Information Density Management

**Incorrect — Wall of text with no structure:**
```tsx
<div className="content">
  <p>{longParagraph1}</p>
  <p>{longParagraph2}</p>
  <p>{longParagraph3}</p>
  <p>{longParagraph4}</p>
</div>
```

**Correct — Chunked content with clear hierarchy:**
```tsx
<article>
  <h2>Getting Started</h2>
  <p className="summary">{briefSummary}</p>

  <section aria-labelledby="step-1">
    <h3 id="step-1">Step 1: Install</h3>
    <p>{shortInstruction}</p>
    <pre><code>{codeExample}</code></pre>
  </section>

  <section aria-labelledby="step-2">
    <h3 id="step-2">Step 2: Configure</h3>
    <p>{shortInstruction}</p>
  </section>
</article>
```

## Notification Patterns

**Incorrect — Multiple simultaneous notifications:**
```tsx
function Notifications({ items }) {
  return items.map(item => (
    <div role="alert" className="toast">{item.message}</div>
  ));
}
```

**Correct — Queued, dismissible, non-overwhelming notifications:**
```tsx
function Notifications({ items }) {
  const [visible, setVisible] = useState(items.slice(0, 1));

  return (
    <div aria-live="polite" aria-relevant="additions">
      {visible.map(item => (
        <div key={item.id} role="status" className="toast">
          <span>{item.message}</span>
          <button onClick={() => dismiss(item.id)} aria-label="Dismiss">
            <CloseIcon aria-hidden="true" />
          </button>
        </div>
      ))}
      {items.length > 1 && (
        <p className="sr-only">{items.length - 1} more notifications</p>
      )}
    </div>
  );
}
```

## Navigation Simplicity

- Limit primary nav to 5-7 items max
- Use consistent layout across all pages
- Provide breadcrumbs for deep navigation
- Always show where the user is (active state)

```tsx
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/docs">Docs</a></li>
    <li aria-current="page">Installation</li>
  </ol>
</nav>
```

## Reading Level and Plain Language

| Guideline | Target |
|-----------|--------|
| Sentence length | Under 25 words |
| Paragraph length | 2-4 sentences |
| Reading level | Grade 8 or lower for general content |
| Jargon | Define on first use or provide glossary |
| Abbreviations | Expand on first use with `<abbr>` |

```tsx
<p>
  Use <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> to
  make your site accessible.
</p>
```

## Cognitive Load Reduction

| Pattern | Implementation |
|---------|---------------|
| Progressive disclosure | Show essential info first, details on demand |
| Consistent layouts | Same navigation, same patterns across pages |
| Clear error recovery | Tell users what went wrong and how to fix it |
| Autosave | Prevent data loss from attention lapses |
| Timeout warnings | Alert before session expiry with extend option |

**Incorrect — All fields on one page:**
```tsx
<form>{/* 30 fields visible at once */}</form>
```

**Correct — Multi-step with progress:**
```tsx
<form aria-label="Account setup">
  <div role="progressbar" aria-valuenow={2} aria-valuemin={1}
    aria-valuemax={4} aria-label="Step 2 of 4" />
  <fieldset>
    <legend>Contact Information</legend>
    {currentStepFields}
  </fieldset>
  <button type="button" onClick={prevStep}>Back</button>
  <button type="button" onClick={nextStep}>Next</button>
</form>
```

## Audit Checklist

- [ ] No walls of text — content chunked with headings
- [ ] Max 1 notification visible at a time, all dismissible
- [ ] Navigation has 7 or fewer primary items
- [ ] Error messages explain how to fix the problem
- [ ] Multi-step processes show progress and allow going back
- [ ] Session timeouts warn users and allow extension
