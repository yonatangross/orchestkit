---
title: Analytics Data Privacy
impact: CRITICAL
impactDescription: "Logging raw project paths, usernames, or file contents in analytics files leaks PII — always hash identifiers and strip sensitive fields"
tags: privacy, hashing, pid, pii, local-only
---

## Analytics Data Privacy

All analytics data must be local-only and privacy-safe. Never log PII or reversible identifiers.

**Incorrect — logging raw paths and usernames:**
```typescript
// WRONG: raw project path is PII
appendAnalytics('agent-usage.jsonl', {
  project: process.env.CLAUDE_PROJECT_DIR,  // /Users/john/secret-project
  user: os.userInfo().username,              // john
  file: input.file_path,                     // /Users/john/secret-project/auth.ts
});
```

**Correct — hashed identifiers, no PII:**
```typescript
// RIGHT: irreversible 12-char hash, no PII
appendAnalytics('agent-usage.jsonl', {
  ts: new Date().toISOString(),
  pid: hashProject(process.env.CLAUDE_PROJECT_DIR || ''),  // "a3f8b2c1d4e5"
  agent: agentType,       // "code-quality-reviewer" (not PII)
  model: modelName,       // "claude-opus-4-6" (not PII)
  duration_ms: durationMs,
  success: true,
});
```

**Key rules:**
- Use `hashProject()` (12-char SHA256 truncation) for project identifiers — irreversible
- Never log file paths, usernames, environment variables, or file contents
- Agent names, skill names, and hook names are safe to log (not PII)
- All data stays in `~/.claude/analytics/` — never transmitted externally
- The `team` field uses team names (user-chosen), not paths
