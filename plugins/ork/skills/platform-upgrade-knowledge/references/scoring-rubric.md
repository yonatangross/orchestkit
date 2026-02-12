# Scoring Rubric Reference

Detailed scoring guidelines for the 6 upgrade readiness dimensions used by the `upgrade-assessment` skill. Each dimension is scored 0-10 and weighted to produce an overall readiness score.

---

## Model Compatibility (Weight: 0.25)

Measures how well the codebase handles model transitions: hardcoded model IDs, capability assumptions, context window references, and output token limits.

### Score 9-10: Ready
- No hardcoded model IDs (uses aliases like `sonnet`, `opus`, `haiku`)
- Context window references are parameterized or read from config
- Output token limits are dynamically determined
- No reliance on model-specific behaviors that change between versions
- Capability checks are conditional, not assumed

### Score 7-8: Low Risk
- Few hardcoded model IDs (1-3 instances), easy to update
- Context window assumptions exist but are not load-bearing
- Output limits are conservative and still valid for target model
- Minor documentation references to specific model versions

### Score 5-6: Moderate Risk
- Multiple hardcoded model IDs (4-10 instances)
- Context window calculations depend on specific values
- Output token limits may exceed new model's capacity or underutilize it
- Some logic paths depend on model-specific capabilities

### Score 3-4: High Risk
- Pervasive hardcoded model IDs (10+ instances)
- Core logic assumes specific context window size
- Output limits are tightly coupled to current model
- Capability-dependent code paths with no fallback

### Score 1-2: Critical Risk
- Model ID embedded in build configuration or deployment
- Context window size is a compile-time constant
- Output generation depends on exact token limit
- Removing model-specific code requires architectural changes

### Score 0: Blocked
- Application fundamentally depends on a deprecated model feature
- Cannot function with the target model

---

## Hook Compatibility (Weight: 0.20)

Measures compatibility of hook definitions, handler signatures, lifecycle events, and async patterns with the target CC version.

### Score 9-10: Ready
- All hook types are supported in target CC version
- Handler signatures match expected format
- Async patterns (fire-and-forget) are compatible
- No deprecated hook configuration fields
- Agent-scoped and skill-scoped hooks use current format

### Score 7-8: Low Risk
- All hook types supported, minor signature adjustments needed
- Async patterns work but could use new optimizations
- 1-2 deprecated fields that have backward compatibility
- Hook registration format is current

### Score 5-6: Moderate Risk
- Most hook types supported, 1-2 require migration
- Some handler signatures need updating
- Async dispatcher pattern needs revision
- Several deprecated configuration fields
- hooks.json schema partially outdated

### Score 3-4: High Risk
- Multiple hook types removed or renamed in target version
- Handler signature changes affect core functionality
- Async pattern incompatible with new lifecycle
- hooks.json requires significant restructuring

### Score 1-2: Critical Risk
- Core hook types (PreToolUse, PostToolUse) have breaking changes
- Hook execution model fundamentally different
- Cannot register hooks with current configuration

### Score 0: Blocked
- Hook system completely redesigned; no migration path documented

---

## Skill Coverage (Weight: 0.15)

Measures skill format compliance, content relevance, and coverage of new capabilities introduced by the upgrade.

### Score 9-10: Ready
- All skill frontmatter fields valid for target version
- `context: fork` present on all skills (CC 2.1.0+ requirement)
- No references to removed or renamed skills
- Skills already cover capabilities of target model/CC version
- Token budgets are within target version's skill budget scaling

### Score 7-8: Low Risk
- Frontmatter valid, 1-2 optional fields could be added
- All skill references resolve correctly
- Minor content updates needed for new capabilities
- Token budgets are reasonable for target version

### Score 5-6: Moderate Risk
- Several skills missing required frontmatter fields
- 3-5 skill references point to renamed or restructured skills
- Notable capability gaps (new features not covered)
- Some skills exceed target version's token budget

### Score 3-4: High Risk
- Many skills have invalid frontmatter for target version
- Multiple broken skill references
- Significant capability gaps require new skill creation
- Token budgets incompatible with target version's scaling

### Score 1-2: Critical Risk
- Skill format fundamentally incompatible with target version
- Most skill references broken
- Core skill functionality affected

### Score 0: Blocked
- Skill format completely changed; bulk migration required

---

## Agent Readiness (Weight: 0.15)

Measures agent definition compatibility: model fields, tool references, skill bindings, and directive content.

### Score 9-10: Ready
- All agent `model:` fields use valid aliases for target version
- All `tools:` references are available in target CC version
- All `skills:` references resolve to existing skills
- Agent directives are model-agnostic
- Agent-scoped hooks are compatible

### Score 7-8: Low Risk
- Model fields valid, 1-2 agents could use upgraded model
- All tools available, minor capability improvements possible
- Skill references valid, could add new relevant skills
- Directives mostly model-agnostic

### Score 5-6: Moderate Risk
- Several agents reference deprecated model aliases
- 1-3 tools removed or renamed in target CC version
- Some skill references need updating
- Directives reference model-specific behaviors

### Score 3-4: High Risk
- Many agents use invalid model references
- Multiple tools unavailable in target version
- Skill references significantly outdated
- Directives assume specific model capabilities

### Score 1-2: Critical Risk
- Agent format incompatible with target CC version
- Core tools removed
- Cannot spawn agents with current definitions

### Score 0: Blocked
- Agent system completely redesigned

---

## Memory Architecture (Weight: 0.10)

Measures compatibility of the memory system: graph memory and CC native MEMORY.md integration.

### Score 9-10: Ready
- Graph memory functions with target version
- Storage formats unchanged or backward-compatible
- Auto-write to MEMORY.md works with target CC version
- Queue files (graph-queue.jsonl) compatible
- Session persistence unaffected

### Score 7-8: Low Risk
- Graph memory functional, minor format adjustments
- MEMORY.md auto-write compatible with minor path changes
- Queue processing works with target version
- No data loss risk during upgrade

### Score 5-6: Moderate Risk
- Graph memory needs migration
- Storage format changed, migration script needed
- MEMORY.md location or format changed
- Queue processing requires updates

### Score 3-4: High Risk
- Graph memory needs significant migration
- Storage format breaking change
- Risk of data loss without careful migration
- Queue system redesigned

### Score 1-2: Critical Risk
- Memory system fundamentally different in target version
- No backward compatibility for stored data
- Manual data migration required

### Score 0: Blocked
- Memory system removed or completely replaced

---

## CI/CD Pipeline (Weight: 0.15)

Measures compatibility of test suites, build system, deployment configuration, and automation pipelines.

### Score 9-10: Ready
- All tests pass with target version configuration
- Build system (`npm run build`) compatible
- CI workflows reference correct versions
- Security tests validate against target version's requirements
- No version-pinned dependencies that conflict

### Score 7-8: Low Risk
- Tests pass with minor assertion updates
- Build system works with trivial configuration changes
- CI workflows need version bump in 1-2 places
- Security tests compatible

### Score 5-6: Moderate Risk
- Several tests need updating for changed behavior
- Build system requires configuration changes
- CI workflows need multiple updates
- Some security test assumptions outdated

### Score 3-4: High Risk
- Many tests fail with target version
- Build system requires significant changes
- CI pipeline needs restructuring
- Security tests need rewrite for new threat model

### Score 1-2: Critical Risk
- Test suite incompatible with target version
- Build system broken
- CI pipeline cannot execute

### Score 0: Blocked
- No viable path to run tests or build with target version

---

## Overall Score Calculation

```
overall = (model * 0.25) + (hooks * 0.20) + (skills * 0.15)
        + (agents * 0.15) + (memory * 0.10) + (cicd * 0.15)
```

### Readiness Labels

| Overall Score | Label | Recommended Action |
|---------------|-------|-------------------|
| 9.0 - 10.0 | Ready | Proceed with upgrade immediately |
| 7.0 - 8.9 | Low Risk | Proceed after addressing minor items |
| 5.0 - 6.9 | Moderate Risk | Plan a dedicated migration sprint |
| 3.0 - 4.9 | High Risk | Thorough analysis and phased migration required |
| 1.0 - 2.9 | Critical Risk | Major rework needed; consider delaying |
| 0.0 - 0.9 | Blocked | Cannot upgrade without fundamental changes |
