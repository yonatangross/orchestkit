# ARIA Snapshot Diffing

Semantic UI change detection using ARIA tree snapshots instead of pixel-based visual regression.

## Why ARIA Over Screenshots

| Approach | Pros | Cons |
|----------|------|------|
| Screenshot diff | Catches visual regressions | Brittle (font rendering, anti-aliasing, viewport), large files |
| ARIA snapshot | Semantic, tiny diffs, framework-agnostic | Misses purely visual changes (colors, spacing) |

ARIA diffing catches **structural and semantic** changes — missing labels, changed hierarchy, removed interactive elements — which are the changes most likely to break user experience.

## Snapshot Format

```json
{
  "page": "/login",
  "timestamp": "2026-03-26T16:30:00Z",
  "tree": {
    "role": "main",
    "name": "Login",
    "children": [
      {
        "role": "heading",
        "name": "Sign In",
        "level": 1
      },
      {
        "role": "form",
        "name": "Login form",
        "children": [
          { "role": "textbox", "name": "Email" },
          { "role": "textbox", "name": "Password" },
          { "role": "button", "name": "Sign In" }
        ]
      }
    ]
  }
}
```

## Capturing Snapshots

Via agent-browser:
```
Navigate to /login
Run: document.querySelector('main').computedRole  // or use axe-core
Extract ARIA tree as JSON
Save to .expect/snapshots/login.json
```

## Diffing Algorithm

1. Load previous snapshot from `.expect/snapshots/{page-slug}.json`
2. Capture current ARIA tree
3. Compute structural diff:
   - Added nodes (new elements)
   - Removed nodes (deleted elements)
   - Changed names/roles (label changes)
   - Reordered children (layout changes)
4. Score the diff as a percentage of total nodes changed
5. Flag if above `diff_threshold` (default 10%)

## Diff Output

```
ARIA Diff: /login
  + Added: textbox "Confirm Password" (new field)
  - Removed: link "Forgot Password?" (was in form)
  ~ Changed: button "Sign In" → "Log In" (label changed)

Change score: 15% (threshold: 10%) — FLAGGED
```
