---
name: ork-debt-extension-drift
description: ork-debt feature has (or will have) two extension lists that drift; root-cause fix is a single DEBT_SCAN_EXTENSIONS constant in the shared parser lib
metadata:
  type: project
---

ork-debt capture (debt-marker-tracker) and surfacer (debt-surfacer) each hardcode the scanned file-extension list in different formats (regex alternation vs grep --include string array), so they drift. Surfacer omitted kts/hpp/bash/zsh/sql → markers in those files captured-but-never-surfaced.

**Why:** Two literal lists in two formats with no shared source = guaranteed drift over time; a verify panel caught it as a non-blocking finding.

**How to apply:** Root-cause fix = ONE `export const DEBT_SCAN_EXTENSIONS: readonly string[]` in `src/hooks/src/lib/debt-markers.ts` (sorted, deduped). Tracker builds `CODE_EXT_RE` from it via `new RegExp(\`\\.(${DEBT_SCAN_EXTENSIONS.join("|")})$\`)`; surfacer builds grep `--include=*.{ext}` flags via `.map(e => \`--include=*.${e}\`)`. Both consume the constant — they can never drift again. NOTE 2026-06-15: the debt files did not yet exist in the tree when this was designed; verify file/symbol presence before implementing.
