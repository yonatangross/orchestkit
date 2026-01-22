---
description: OrchestKit health diagnostics - validates configuration and reports issues
allowed-tools: Bash, Read, Glob, Grep
---

# OrchestKit Health Diagnostics

Load and follow the skill instructions from the `skills/doctor/SKILL.md` file.

Execute the `/ork:doctor` workflow to:
1. Analyze permission rules (detect unreachable rules)
2. Validate hook health (executability, references)
3. Check schema compliance (plugin.json, SKILL.md files, context)
4. Verify coordination system health (locks, registry)
5. Monitor context budget usage
6. Generate comprehensive health report

## Arguments
- No arguments: Run full diagnostics
