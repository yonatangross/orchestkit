# Research Reference (#1181)

Architecture analysis of millionco/expect and related tools.

## millionco/expect

[GitHub: millionco/expect](https://github.com/millionco/expect) — AI-powered browser testing tool.

### Key Architecture Decisions

1. **Diff-first**: Uses git diff to determine test scope — doesn't test unchanged code
2. **ARIA over pixels**: Accessibility tree snapshots for semantic UI diffing
3. **Natural language steps**: Test plans written in plain English, executed by AI
4. **Fingerprint gating**: SHA-256 hash of file state — zero-cost skip when unchanged
5. **Failure taxonomy**: 6 categories (app-bug, env-issue, auth-blocked, missing-test-data, selector-drift, agent-misread)

### What We Adopted

| Feature | millionco/expect | /ork:expect |
|---------|-----------------|-------------|
| Diff scanning | 3-level (direct/imported/routed) | Same, plus `changes` target mode |
| Fingerprinting | SHA-256 of HEAD+staged+unstaged | Same |
| Status protocol | STEP_START/STEP_DONE/etc. | Same format |
| Failure categories | 6 types | Same 6 types |
| ARIA snapshots | Line-based diffing | Same |
| Saved flows | YAML format | Markdown+YAML for human readability |
| Config | .expect/config.yaml | Same convention |

### What We Added

| Feature | /ork:expect Only |
|---------|-----------------|
| Scope strategy | Test depth varies by target (commit=narrow, branch=thorough) |
| Coverage context | Cross-ref changed files with existing test files |
| rrweb recording | DOM event replay (not in millionco/expect) |
| Anti-rabbit-hole | Max retry limits, stall detection |
| Agent Teams | Can use mesh orchestration for parallel analysis |
| MCP integration | Memory graph persistence of findings |
| fal.ai integration | Could generate test thumbnails/reports via fal MCP |

## Related Tools

| Tool | Approach | Difference |
|------|----------|------------|
| Playwright | Code-first E2E tests | Manual test authoring, no AI |
| Cypress | Code-first E2E tests | Same as Playwright |
| agent-browser | AI browser automation | Generic — expect adds diff-awareness |
| Meticulous | Visual regression | Pixel-based, not semantic |
| Chromatic | Storybook visual testing | Component-level, not page-level |
| testmon | Python test selection | Unit test scope, not browser |
