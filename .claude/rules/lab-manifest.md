---
paths:
  - "docs/site/lab-manifest/**"
  - "docs/site/public/lab/**"
  - "docs/*/**/*.html"
---

# Lab manifest (one fragment per entry, #4049)

- A playground is published by ONE file: `docs/site/lab-manifest/<slug>.json`.
  Never edit `docs/site/public/lab/` by hand, and never commit
  `docs/site/lib/generated/lab-data.ts`: it is gitignored (#4185) and
  regenerated at build, dev and test time (docs/site prebuild/predev/pretest,
  root build phase 7) from the fragments.
- `docs/site/lab-manifest.json` no longer exists. A rebased branch that still
  edits it fails the build: move the entry into a fragment, delete the file.
- There is no merge rule for `lab-data.ts` anymore, because it is not in git:
  a rebase or merge cannot conflict on it. If
  `node docs/site/scripts/lab-manifest.mjs --check` reports it absent or
  stale, run the generator; never hand-edit it.
- Full shape and rationale: `docs/site/lab-manifest/README.md`.
