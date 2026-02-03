# Plan: Issue #278 - Improve Auto-Suggest Hook Messages

## Problem Statement

Current auto-suggest messages are technical and not user-friendly:
- Headers like "## Skill Hints" and "## Skill Knowledge Injected" sound robotic
- Raw percentages "(85% match)" require interpretation
- All output goes to `additionalContext` (Claude-only, user never sees it)

## Discovery: Three Output Channels (CC 2.1.9+)

From [official Claude Code hooks documentation](https://code.claude.com/docs/en/hooks):

| Channel | User Sees? | Claude Sees? | How to Use |
|---------|------------|--------------|------------|
| **Plain stdout** | ✅ In transcript | ✅ As context | `console.log()` + exit 0 |
| **`systemMessage`** | ✅ As warning | ❌ | JSON field |
| **`additionalContext`** | ❌ (discrete) | ✅ | JSON field in `hookSpecificOutput` |

Key quote from docs:
> "Plain stdout is shown as hook output in the transcript. The `additionalContext` field is added more discretely."

## Proposed Three-Tier Architecture

### Tier 1: HIGH Confidence (≥90%) - Silent Injection
- **User sees:** Nothing (or brief `systemMessage` notification)
- **Claude sees:** Full compressed skill content
- **Rationale:** High confidence = just do it, don't clutter

### Tier 2: MEDIUM Confidence (70-89%) - User Notification
- **User sees:** Brief `systemMessage` like "💡 Loaded: fastapi-advanced"
- **Claude sees:** Skill summary via `additionalContext`
- **Rationale:** User knows what's happening, Claude gets context

### Tier 3: LOW Confidence (50-69%) - Discrete Hint
- **User sees:** Nothing (or hint in transcript via stdout)
- **Claude sees:** Minimal hint via `additionalContext`
- **Rationale:** Don't distract user with uncertain suggestions

---

## Files to Modify

### 1. `src/hooks/src/prompt/skill-resolver.ts` (Primary)

**Current state:**
- Lines 162-191: Three message builders all return markdown for `additionalContext`
- Line 301: Single output via `outputPromptContext(message)`

**Changes needed:**

#### A. Update constants (lines 40-43)
```typescript
// BEFORE
const TIER_FULL = 80;
const TIER_SUMMARY = 70;
const TIER_HINT = 50;

// AFTER
const TIER_SILENT = 90;    // Silent injection, no user notification
const TIER_NOTIFY = 80;    // Brief systemMessage to user
const TIER_SUGGEST = 70;   // Suggestion in additionalContext
const TIER_HINT = 50;      // Minimal hint
```

#### B. New message builders (replace lines 162-191)

```typescript
/**
 * Build user notification (systemMessage) - brief, friendly
 */
function buildUserNotification(skills: SimpleSkillMatch[]): string {
  if (skills.length === 0) return '';

  const names = skills.slice(0, 2).map(s => s.skill).join(', ');
  return `💡 Loaded: ${names}`;
}

/**
 * Build Claude context (additionalContext) - full content, no percentages
 */
function buildClaudeContext(
  loadedSkills: Array<{ skill: string; content: string }>,
  suggestedSkills: SimpleSkillMatch[]
): string {
  const parts: string[] = [];

  // Full content for loaded skills
  if (loadedSkills.length > 0) {
    parts.push('## Relevant Patterns Loaded\n');
    for (const { skill, content } of loadedSkills) {
      parts.push(`### ${skill}\n\n${content}\n\n---\n`);
    }
  }

  // Suggestions for medium-confidence skills
  if (suggestedSkills.length > 0) {
    parts.push('\n## Also Available\n');
    for (const { skill } of suggestedSkills) {
      const desc = getSkillDescription(skill);
      parts.push(`- **${skill}**${desc ? ` — ${desc}` : ''}`);
    }
    parts.push('\nUse `/ork:<skill>` to load full content.');
  }

  return parts.join('\n');
}

/**
 * Build hint for low-confidence matches (minimal)
 */
function buildHintContext(skills: SimpleSkillMatch[]): string {
  if (skills.length === 0) return '';
  const names = skills.map(s => s.skill).join(', ');
  return `Related skills available: ${names}. Use /ork:<skill> if needed.`;
}
```

#### C. Update main resolver logic (replace lines 239-301)

```typescript
export function skillResolver(input: HookInput): HookResult {
  // ... existing classification logic (lines 209-238) ...

  // Partition into NEW tiers
  const silentTier = allSkills.filter(s => s.confidence >= TIER_SILENT);
  const notifyTier = allSkills.filter(s => s.confidence >= TIER_NOTIFY && s.confidence < TIER_SILENT);
  const suggestTier = allSkills.filter(s => s.confidence >= TIER_SUGGEST && s.confidence < TIER_NOTIFY);
  const hintTier = allSkills.filter(s => s.confidence >= TIER_HINT && s.confidence < TIER_SUGGEST);

  // Load full content for high-confidence skills
  const loadedSkills: Array<{ skill: string; content: string }> = [];
  const skillsToLoad = [...silentTier, ...notifyTier].slice(0, MAX_FULL_INJECT);

  if (config.enableSkillInjection) {
    for (const match of skillsToLoad) {
      if (isSkillInjected(match.skill)) continue;
      const content = loadCompressedSkillContent(match.skill, MAX_INJECTION_TOKENS);
      if (content) {
        loadedSkills.push({ skill: match.skill, content });
        trackInjectedSkill(match.skill);
      }
    }
  }

  // Build outputs for each channel
  const claudeContext = buildClaudeContext(loadedSkills, suggestTier);
  const hintContext = buildHintContext(hintTier);
  const fullContext = [claudeContext, hintContext].filter(Boolean).join('\n\n');

  // Determine user notification
  const hasNotifySkills = notifyTier.length > 0 || (silentTier.length > 0 && loadedSkills.length > 0);
  const userMessage = hasNotifySkills ? buildUserNotification(loadedSkills.map(s => ({ skill: s.skill, confidence: 90 }))) : '';

  // Return with appropriate channels
  if (!fullContext && !userMessage) {
    return outputSilentSuccess();
  }

  // NEW: Use both systemMessage AND additionalContext
  return {
    continue: true,
    suppressOutput: true,
    ...(userMessage && { systemMessage: userMessage }),
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: fullContext || undefined,
    },
  };
}
```

### 2. `src/hooks/src/lib/common.ts` (Optional helper)

Add a new output helper that combines both channels:

```typescript
/**
 * Output with user notification + Claude context (CC 2.1.9+)
 * @param userMessage - Brief message shown to user (systemMessage)
 * @param claudeContext - Full context for Claude (additionalContext)
 */
export function outputWithNotification(
  userMessage: string | undefined,
  claudeContext: string | undefined
): HookResult {
  return {
    continue: true,
    suppressOutput: true,
    ...(userMessage && { systemMessage: userMessage }),
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      ...(claudeContext && { additionalContext: claudeContext }),
    },
  };
}
```

---

## Message Format Changes

### Before (Technical)
```markdown
## Skill Knowledge Injected

Auto-loaded based on your prompt:

### fastapi-advanced (85% match)

[content]

---

## Relevant Skills

### api-design-framework (75% match)
REST API design patterns...
- Endpoint Design
- Versioning
Use `/ork:api-design-framework` to load full content.

## Skill Hints

- **auth-patterns** — Use `/ork:auth-patterns` to load
```

### After (User-Friendly)

**User sees (systemMessage):**
```
💡 Loaded: fastapi-advanced
```

**Claude sees (additionalContext):**
```markdown
## Relevant Patterns Loaded

### fastapi-advanced

[content without "85% match"]

---

## Also Available

- **api-design-framework** — REST API design patterns
- **auth-patterns** — Authentication and authorization patterns

Use `/ork:<skill>` to load full content.
```

---

## Confidence Tier Behavior Summary

| Confidence | User Notification | Claude Context | Behavior |
|------------|-------------------|----------------|----------|
| ≥90% | None (silent) | Full content | Trust the system |
| 80-89% | "💡 Loaded: X" | Full content | Acknowledge loading |
| 70-79% | None | Summary + bullets | Available if needed |
| 50-69% | None | "Related: X, Y" | Minimal hint |
| <50% | None | None | Don't suggest |

---

## Test Plan

1. **Unit tests** - Update `src/hooks/src/__tests__/prompt/skill-resolver.test.ts`
   - Test each confidence tier produces correct output channels
   - Test `systemMessage` only appears for 80-89% tier
   - Test no raw percentages in output

2. **Integration test** - Manual testing
   - Submit prompts matching skills at different confidence levels
   - Verify user sees appropriate notifications
   - Verify Claude responses reflect loaded skills

3. **Build verification**
   ```bash
   cd src/hooks && npm run build
   npm run test:hooks
   ```

---

## Acceptance Criteria (from Issue #278)

- [x] Identified correct files (skill-resolver.ts, not agent-auto-suggest.ts)
- [ ] Remove raw percentage display from user-facing messages
- [ ] Use natural language tiers ("Loaded", "Available", "Related")
- [ ] Add `systemMessage` for user notifications (80-89% tier)
- [ ] Keep `additionalContext` for Claude context (all tiers)
- [ ] Friendlier headers ("Relevant Patterns" vs "Skill Knowledge Injected")
- [ ] Build passes: `cd src/hooks && npm run build`
- [ ] Tests pass: `npm run test:hooks`

---

## Implementation Order

1. Add new constants for tier thresholds
2. Create new message builder functions
3. Update main `skillResolver()` logic
4. Add `outputWithNotification()` helper to common.ts
5. Update/add unit tests
6. Build and verify

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `systemMessage` too noisy | Only use for 80-89% tier, not silent tier |
| Breaking existing behavior | Keep `additionalContext` as primary channel |
| Test failures | Update test expectations for new format |

---

## References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Issue #278](https://github.com/yonatangross/orchestkit/issues/278)
- [UX Research: Confidence-Based Messaging](https://medium.com/design-bootcamp/designing-a-confidence-based-feedback-ui-f5eba0420c8c)
