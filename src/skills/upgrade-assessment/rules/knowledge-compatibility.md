---
title: Platform Compatibility Knowledge
impact: HIGH
impactDescription: "Missing compatibility checks cause silent failures — model ID changes, removed APIs, and format changes break at runtime"
tags: upgrade, compatibility, migration, breaking-changes, model, cc-version
---

## Platform Compatibility Knowledge

Track compatibility across three independent upgrade axes: Claude model, Claude Code version, and OrchestKit version.

### Model ID Breaking Pattern

Model ID format changed from `claude-{version}-{variant}` to `claude-{variant}-{version}` starting with Claude 4:

| From | To | Key Changes |
|------|----|-------------|
| `claude-3-5-sonnet-20241022` | `claude-sonnet-4-20250514` | ID format change, +extended thinking |
| `claude-sonnet-4-20250514` | `claude-sonnet-4-5-20250916` | +1M context |
| `claude-opus-4-20250514` | `claude-opus-4-6-20260115` | +1M context, +128K output, +files API |

### Common Breaking Changes

| Change | Detection Pattern | Severity |
|--------|-------------------|----------|
| Hardcoded model ID | `grep "claude-.*-\d"` | CRITICAL |
| Context window assumption | `grep "200000\|200_000"` | WARNING |
| Output token assumption | `grep "max_tokens.*4096\|8192"` | WARNING |
| Removed hook type | hooks.json references | CRITICAL |
| Changed hook signature | Hook handler functions | CRITICAL |
| New required frontmatter | Skill/agent YAML | WARNING |
| Deprecated config field | `.claude/settings.json` | WARNING |

### Migration Effort Estimation

| Category | Low (< 1 hour) | Medium (1-4 hours) | High (4+ hours) |
|----------|----------------|--------------------|-----------------|
| Model refs | Find-and-replace IDs | Update conditional logic | Rewrite capability code |
| Hooks | Update registration | Migrate handler signatures | Rewrite hook logic |
| Skills | Add missing frontmatter | Restructure content | Create new skills |
| Agents | Update model field | Update tool/skill refs | Rewrite directives |

### Effort Formula

```
total_hours = sum(
  count[CRITICAL] * 2.0 +
  count[WARNING]  * 0.5 +
  count[INFO]     * 0.1
)
```

### Key Rules

- **Scan first, upgrade second** — run codebase scan before making any changes
- Hardcoded model IDs are **always CRITICAL** — use aliases where possible
- Context window and output limits change across models — **never hardcode**
- Hook type and format changes can **silently break** — test all hooks after upgrade
- Use the **detection patterns** above as a pre-upgrade checklist
- Track each axis **independently** — model, CC version, and OrchestKit can upgrade separately

**Incorrect — Hardcoded model ID breaks when upgrading to new Claude version:**
```typescript
const response = await anthropic.messages.create({
  model: "claude-opus-4-20250514",  // Breaks when 4.6 becomes default
  max_tokens: 4096,
});
```

**Correct — Model alias and variable config survives upgrades:**
```typescript
const response = await anthropic.messages.create({
  model: process.env.CLAUDE_MODEL || "claude-opus-latest",
  max_tokens: settings.maxOutputTokens,
});
```
