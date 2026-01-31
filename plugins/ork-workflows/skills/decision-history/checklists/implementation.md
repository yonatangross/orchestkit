# Decision History Implementation Checklist

## Skill Structure (#202)
- [x] Create SKILL.md with user-invocable frontmatter
- [x] Create references/cli-commands.md
- [x] Create references/data-schema.md
- [x] Create references/cc-version-mapping.md
- [x] Create assets/decision-schema.json
- [x] Create scripts/decision-history-cli.py (stub)
- [x] Create checklists/implementation.md

## Metadata Enrichment (#204)
- [x] Add getCCVersion() function
- [x] Add getPluginVersion() function
- [x] Add detectImportance() function
- [x] Add extractBestPractice() function
- [x] Update metadata object with new fields
- [x] Rebuild hooks bundle
- [x] Verify TypeScript compiles

## CHANGELOG Parser (#206) - Future
- [ ] Parse CHANGELOG.md sections
- [ ] Extract version → CC version mapping
- [ ] Extract decisions from each version block
- [ ] Generate decision objects from changelog entries

## Decision Aggregator (#207) - Future
- [ ] Query mem0 for stored decisions
- [ ] Parse active.json for session decisions
- [ ] Call CHANGELOG parser for historical decisions
- [ ] Merge and deduplicate from all sources
- [ ] Return unified decision list

## CLI Dashboard (#208) - Future
- [ ] Implement rich/textual TUI
- [ ] Add ANSI color output
- [ ] Add Unicode box-drawing
- [ ] Implement filtering options
- [ ] Add stats/timeline views

## Mermaid Timeline (#203) - Future
- [ ] Generate Mermaid timeline syntax
- [ ] Group decisions by CC version
- [ ] Export for GitHub docs
