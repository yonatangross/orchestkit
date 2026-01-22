# Context Pruning Advisor - Scoring Algorithm Design

**Version**: 1.0.0
**Date**: 2026-01-18
**Issue**: #126

## Overview

The Context Pruning Advisor hook analyzes loaded context (skills, files, agent outputs) when context usage exceeds 70% and recommends pruning candidates to free up token budget. This document describes the scoring algorithm used to prioritize what should be pruned.

## Scoring Factors

Each piece of context is scored on three dimensions:

### 1. Recency Score (0-10 points)

**Definition**: How recently was this context accessed or modified?

**Rationale**: Recently accessed context is more likely to be relevant to the current task.

**Scoring Tiers**:
```
Last 5 minutes:    10 points (actively being used)
Last 15 minutes:   8 points  (very recent)
Last 30 minutes:   6 points  (recent)
Last hour:         4 points  (somewhat recent)
Last 2 hours:      2 points  (aging out)
Older than 2 hours: 0 points (stale)
```

**Implementation**: Track last access timestamp for each context item:
- Skills: Last time skill was loaded or referenced
- Files: File modification time (mtime) or last read time
- Agent outputs: Timestamp of agent completion

### 2. Frequency Score (0-10 points)

**Definition**: How often has this context been accessed during the current session?

**Rationale**: Frequently accessed context indicates sustained relevance to the task.

**Scoring Tiers**:
```
10+ accesses:  10 points (heavily used)
7-9 accesses:   8 points (frequently used)
4-6 accesses:   6 points (moderately used)
2-3 accesses:   4 points (occasionally used)
1 access:       2 points (barely used)
0 accesses:     0 points (unused)
```

**Implementation**: Maintain access counter for each context item in session state:
```json
{
  "context_access_log": {
    "skills/api-design-framework": 12,
    "skills/fastapi-advanced": 3,
    "agents/backend-system-architect.md": 1
  }
}
```

### 3. Relevance Score (0-10 points)

**Definition**: How relevant is this context to the current prompt/task?

**Rationale**: Context aligned with current work should be preserved.

**Scoring Tiers**:
```
Direct keyword match:       10 points (prompt contains skill/file name or tags)
Related skills/patterns:     8 points (same domain/category)
Same technology stack:       6 points (e.g., both React-related)
Same architectural layer:    4 points (e.g., both backend)
Generic/infrastructure:      2 points (utilities, common libs)
Unrelated:                   0 points (different domain entirely)
```

**Implementation**: Compare current prompt keywords against:
- Skill tags and descriptions
- File paths and content keywords
- Agent specializations

**Keyword Extraction**:
```bash
# Extract keywords from current prompt (lowercase, remove common words)
prompt_keywords=(api fastapi endpoint authentication)

# Check skill tags for overlap
skill_tags=(api rest fastapi backend)
# Overlap: 3/4 → relevance = 8
```

## Total Score Calculation

```
Total Score = Recency Score + Frequency Score + Relevance Score
Range: 0-30 points
```

### Example Calculations

**Example 1: Recently used, frequently accessed, relevant skill**
- Skill: `skills/api-design-framework`
- Current prompt: "Design a REST API endpoint for user authentication"
- Last accessed: 3 minutes ago → **10 points**
- Access count: 8 times → **8 points**
- Relevance: Direct match ("api", "design") → **10 points**
- **Total: 28 points** ✅ **KEEP**

**Example 2: Old, rarely used, unrelated skill**
- Skill: `skills/radix-primitives`
- Current prompt: "Design a REST API endpoint for user authentication"
- Last accessed: 90 minutes ago → **0 points**
- Access count: 1 time → **2 points**
- Relevance: Unrelated (frontend vs backend) → **0 points**
- **Total: 2 points** ❌ **PRUNE**

**Example 3: Recent but unrelated agent output**
- Agent: `agents/frontend-ui-developer` output
- Current prompt: "Optimize database queries"
- Last accessed: 10 minutes ago → **10 points**
- Access count: 2 times → **4 points**
- Relevance: Unrelated (frontend vs database) → **0 points**
- **Total: 14 points** ⚠️ **BORDERLINE** (context-dependent)

## Pruning Thresholds

| Score Range | Action | Priority |
|-------------|--------|----------|
| 0-8         | **Prune immediately** | High priority candidates |
| 9-15        | **Consider pruning** | If context >80%, prune these |
| 16-22       | **Keep unless critical** | Only prune if context >90% |
| 23-30       | **Always keep** | Active, relevant context |

## Pruning Strategy

### Phase 1: Identify Candidates (Context 70-80%)
```bash
# Sort all context by score (ascending)
# Recommend bottom 25% for pruning
```

### Phase 2: Aggressive Pruning (Context 80-90%)
```bash
# Prune all items with score < 10
# Recommend items with score 10-15 for review
```

### Phase 3: Critical Pruning (Context >90%)
```bash
# Prune all items with score < 16
# Warn user: "Context critical. Manual intervention needed."
```

## Context Item Types

The algorithm tracks these context types:

### Skills
**Location**: Loaded from `skills/*/SKILL.md`
**Size estimate**: 300-800 tokens per skill
**Tracking**:
```json
{
  "type": "skill",
  "path": "skills/api-design-framework",
  "loaded_at": "2026-01-18T10:30:00Z",
  "access_count": 5,
  "estimated_tokens": 650,
  "tags": ["api", "rest", "design"]
}
```

### Files (Code)
**Location**: Any file read by Claude
**Size estimate**: Varies widely (50-5000+ tokens)
**Tracking**:
```json
{
  "type": "file",
  "path": "src/api/endpoints.py",
  "loaded_at": "2026-01-18T10:25:00Z",
  "access_count": 3,
  "estimated_tokens": 850,
  "mtime": "2026-01-18T10:20:00Z"
}
```

### Agent Outputs
**Location**: Stored in session state or memory
**Size estimate**: 500-3000 tokens per agent run
**Tracking**:
```json
{
  "type": "agent",
  "agent_id": "backend-system-architect",
  "completed_at": "2026-01-18T10:15:00Z",
  "access_count": 2,
  "estimated_tokens": 1500,
  "topics": ["database", "schema", "postgresql"]
}
```

## Implementation Details

### State File
**Location**: `/tmp/claude-context-tracking-${SESSION_ID}.json`

**Schema**:
```json
{
  "session_id": "abc123",
  "updated_at": "2026-01-18T10:30:00Z",
  "total_context_tokens": 8500,
  "context_budget": 12000,
  "items": [
    {
      "id": "skill:api-design-framework",
      "type": "skill",
      "path": "skills/api-design-framework",
      "loaded_at": "2026-01-18T10:30:00Z",
      "last_accessed": "2026-01-18T10:30:00Z",
      "access_count": 5,
      "estimated_tokens": 650,
      "tags": ["api", "rest", "design"],
      "score": {
        "recency": 10,
        "frequency": 6,
        "relevance": 10,
        "total": 26
      }
    }
  ],
  "pruning_recommendations": [
    {
      "id": "skill:radix-primitives",
      "score": 2,
      "reason": "Unrelated to current task (backend API work)",
      "estimated_savings": 450
    }
  ]
}
```

### Hook Logic Flow

```
1. UserPromptSubmit event triggered
2. Check context usage percentage
   ├─ If < 70%: output_silent_success (no action needed)
   └─ If >= 70%: proceed with analysis

3. Load context tracking state file
   └─ If missing: initialize from loaded skills/files

4. Extract keywords from current user prompt

5. Score each context item:
   ├─ Calculate recency score (time since last access)
   ├─ Calculate frequency score (access count)
   └─ Calculate relevance score (keyword overlap)

6. Sort items by total score (ascending)

7. Identify pruning candidates:
   ├─ Score 0-8: High priority
   ├─ Score 9-15: Medium priority
   └─ Score 16-22: Low priority (only if critical)

8. Build recommendation message:
   ├─ List top 5 pruning candidates
   ├─ Show estimated token savings
   └─ Provide specific guidance on what to prune

9. Inject via additionalContext

10. Update state file with new scores and access times
```

### Edge Cases

**Case 1: First prompt of session**
- No access history available
- Use only relevance scoring
- Default recency = 10 (everything is recent)
- Default frequency = 0 (nothing accessed yet)

**Case 2: Context already at 95%+**
- Skip scoring (too late)
- Immediately recommend compaction via `/ork:context-compression`
- Warn: "Context critical. Use context-compression skill."

**Case 3: All context highly relevant**
- No clear pruning candidates
- Recommend archiving old decisions/patterns
- Suggest manual review of loaded skills

**Case 4: Rapid context growth**
- Detect if context grew >20% in last 5 minutes
- Warn: "Rapid context growth detected. Review recent tool calls."
- Flag potential context leaks (e.g., loading entire directories)

## Performance Considerations

1. **Fast exit path**: If context < 70%, exit immediately with no analysis
2. **Lightweight state**: Store only essential tracking data (no full content)
3. **Token estimation**: Use rough heuristics (chars/4) to avoid expensive calculations
4. **Bounded recommendations**: Limit to top 5-10 candidates to keep message short
5. **Async updates**: Update state file in background (non-blocking)

## Testing Strategy

### Unit Tests
- `test-scoring-recency.sh`: Test recency score calculation
- `test-scoring-frequency.sh`: Test frequency score calculation
- `test-scoring-relevance.sh`: Test keyword matching and relevance scoring
- `test-threshold-logic.sh`: Test pruning threshold decisions

### Integration Tests
- `test-context-tracking-full-flow.sh`: End-to-end test with real context state
- `test-pruning-recommendations.sh`: Verify recommendations match expected candidates

### Edge Case Tests
- `test-first-prompt.sh`: No history available
- `test-critical-context.sh`: Context >95%
- `test-all-relevant.sh`: No clear pruning targets

## Future Enhancements

1. **Machine learning**: Train model to predict context usage patterns
2. **User preferences**: Learn which skills/files user accesses most
3. **Dependency tracking**: Don't prune skills that other loaded skills depend on
4. **Category weighting**: Weight certain categories higher (e.g., security patterns)
5. **Seasonal patterns**: Track time-of-day or day-of-week usage patterns

## References

- Context Budget Monitor: `hooks/posttool/context-budget-monitor.sh`
- Common Helpers: `hooks/_lib/common.sh`
- Hook Output Schema: `.claude/schemas/hook-output.schema.json`
- CC 2.1.9 additionalContext: https://docs.anthropic.com/claude-code/hooks#additionalcontext
