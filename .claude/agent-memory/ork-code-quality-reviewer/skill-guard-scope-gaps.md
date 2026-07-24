---
name: skill-guard-scope-gaps
description: test-multi-agent-safety.sh only scans src/skills/*/SKILL.md — references/rules files are unguarded for subagent_type correctness
metadata:
  type: project
---

`tests/skills/test-multi-agent-safety.sh` Test 3 (bare-vs-ork: subagent_type rule, inverted in #2374) extracts `subagent_type="..."` ONLY from `$SKILLS_DIR/*/SKILL.md` — NOT `references/*.md`, `rules/*.md`, or `CONTRIBUTING-SKILLS.md`.

**Why it matters:** Post-#2374 (which claimed a "repo-wide" sweep), 29 files under src/skills/*/references|rules + CONTRIBUTING-SKILLS.md still carried bare ork agent names (`subagent_type="backend-system-architect"` etc., ~90 occurrences) that fail at dispatch per #2371's live smoke. The guard passes while broken examples persist.

**How to apply:** When reviewing any "swept all X" claim for skill examples, re-grep with `--include='*.md' -r src/skills/` (all depths), not just SKILL.md. Flag guard-scope vs sweep-scope mismatch explicitly.
