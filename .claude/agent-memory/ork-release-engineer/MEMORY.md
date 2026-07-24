# Release Engineer Memory

## Milestones Created

### Milestone #58: Langfuse v3 Skill Rewrite (2026-02-08)
- 18 issues: #419-#436
- 4 P0 critical (bug): #419-#422 — SDK v2->v3 migration breaks
- 3 P1 high (enhancement): #423-#425 — Agent Graphs, observation types, MCP Server
- 6 P2 medium (enhancement): #426-#431 — Experiment Runner, Score Analytics, Dataset Versioning, Corrected Outputs, Self-hosting, Framework integrations
- 5 P3 low (enhancement/docs): #432-#436 — Webhooks, NL Filtering, Spend Alerts, Metrics API, ClickHouse acquisition

## Labels in Use
- `ai-ml` — exists, used for ML/AI skills
- `bug`, `enhancement`, `documentation` — standard labels, all exist
- `priority:high`, `priority:medium`, `priority:low`, `priority:critical` — priority labels exist (NOT `high-priority`/`medium-priority`)

## Existing Milestones (as of 2026-02-08)
- #48-#51: CI phases (Stop the Bleeding through Self-Healing)
- #54: Coordination 2.0
- #55: Video Pipeline v2 (Kling)
- #56: Documentation Site (Fumadocs)
- #57: Cross-Tool Compatibility
- #58: Langfuse v3 Skill Rewrite
- #63: Anti-Over-Engineering Framework

### Milestone #63: Anti-Over-Engineering Framework (2026-02-12)
- 6 issues: #528-#533
- 4 priority:high (enhancement): #528-#531 — Context discovery, scope-appropriate-architecture skill, context-aware enforcer, YAGNI gate
- 2 priority:medium (enhancement): #532-#533 — "When NOT to use" sections, interview mode for implement skill

## Patterns
- Use `gh api repos/:owner/:repo/milestones` for milestone CRUD (not `gh` subcommands)
- Issues can be assigned to milestones by name with `--milestone` flag on `gh issue create`
- All 18 issues created in parallel for speed — no dependencies between issue creation calls

## Release-Please & Pre-Release Support

See `prerelease-support.md` for research summary.

**Key findings:**
- Release-Please DOES support alpha/beta/RC pre-releases
- Extra-files with `x-release-please-version` markers work correctly with pre-release versions
- OrchestKit uses hybrid approach: manual `prerelease.yml` (branches) + release-please for stable (`main`)
- No changes needed to `.release-please-config.json` unless integrating pre-release automation

**Configuration examples:** See `release-please-configs.md`

Current OrchestKit setup (branch-based pre-release):
- ✅ Simple, proven, no changes needed
- ✅ Manual control over pre-release timing
- ⚠️ Pre-release changelogs not auto-generated

## Release-Notes Player v2 Design (2026-06-18)

See `release_notes_player_v2_design.md` for full specification.

**Summary:** Single-file HTML player extended with category lanes (FEATURES|FIXES|BREAKING|ADOPTION), auto-generation from CHANGELOG.md via TypeScript generator script, adoption tracking (requiredCC field), vanilla JS search/filter. Maintains cool-glass visual standard (§10 pass). Scales 5→50+ items without UI collapse.

**Key decisions:**
- Lanes group items by feature area (fable5, hooks, projects-v2, memory, other); color-coded with HSL category tokens
- Auto-gen script: `npx tsx scripts/generate-release-notes.ts VERSION` parses CHANGELOG, infers category/severity via keyword heuristics, outputs RELEASE.items[] JSON into template
- Adoption.requiredCC field links OrchestKit to CC version matrix; status ∈ {auto, required, pending, manual, n/a}
- Filter buttons + search box (vanilla JS) + severity badges on impact cards
- Phase 1 (MVP): ~400-line HTML template + 140-line generator script
- Phase 2 (future): multi-version timeline scrubber, before/after micro-demos

**Deliverables:** Phase 1 ships in v8.49.0 (next regular release); GitHub Action for post-release auto-gen in 2026-07 release
