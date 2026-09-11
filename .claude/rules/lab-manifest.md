---
paths:
  - "docs/site/lab-manifest/**"
  - "docs/site/lib/generated/lab-data.ts"
  - "docs/site/public/lab/**"
  - "docs/*/**/*.html"
---

# Lab manifest (one fragment per entry, #4049)

- A playground is published by ONE file: `docs/site/lab-manifest/<slug>.json`.
  Never edit `docs/site/lib/generated/lab-data.ts` or `docs/site/public/lab/`
  by hand; `npm run build` regenerates both from the fragments.
- `docs/site/lab-manifest.json` no longer exists. A rebased branch that still
  edits it fails the build: move the entry into a fragment, delete the file.
- Merge rule for a conflict on `lab-data.ts`: take either side
  (`git checkout --theirs -- docs/site/lib/generated/lab-data.ts`), run
  `npm run build`, commit. Regenerate, never hand-resolve, never trust a count.
  `node docs/site/scripts/lab-manifest.mjs --check` is the set oracle CI runs.
- Full shape and rationale: `docs/site/lab-manifest/README.md`.
