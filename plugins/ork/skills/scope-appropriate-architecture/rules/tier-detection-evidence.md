---
title: Tier detection must cite evidence from the actual codebase, not assumptions
impact: HIGH
impactDescription: "Wrong tier detection cascades into every architecture decision — over-engineering a prototype or under-engineering an enterprise app"
tags: [architecture, tier-detection, evidence, scope, yagni]
---

# Tier Detection Must Cite Evidence

## Why

The 6-tier system constrains all downstream architecture decisions. If tier detection is wrong, every recommendation is wrong: a hackathon gets CQRS, an enterprise app gets `console.log`. Tier must be derived from codebase evidence, not guesses.

## Rule

When detecting project tier:
1. Scan for at least 3 signals from different categories
2. Each signal must reference a specific file or metric
3. If signals conflict, cite the conflict and ask the user
4. Never default to a tier without evidence

## Incorrect — assume tier without evidence

```markdown
## Architecture Recommendation

This looks like a startup MVP, so I recommend:
- MVC monolith
- Managed Postgres
- Clerk for auth
- Basic CI with GitHub Actions
```

**Problems:**
- "Looks like" is not evidence
- No files were checked
- No metrics were gathered
- If this is actually a Tier 5 enterprise app, every recommendation is wrong

## Correct — cite evidence for tier detection

```markdown
## Tier Detection: Tier 3 (Startup/MVP)

**Evidence (4 signals):**

| Signal | Source | Tier Indicated |
|--------|--------|----------------|
| 12 source files, no monorepo structure | `find src -name "*.ts" \| wc -l` = 12 | Tier 2-3 |
| GitHub Actions present, single workflow | `.github/workflows/ci.yml` exists | Tier 3+ |
| 8 direct dependencies | `package.json` dependencies count | Tier 2-3 |
| No Kubernetes, no Terraform | `find . -name "*.tf" -o -name "*.yaml" \| grep -l "kind: Deployment"` = empty | Not Tier 4-5 |

**Confidence:** HIGH (4/4 signals agree on Tier 2-3, CI presence upgrades to Tier 3)

**Recommendation:** Tier 3 (Startup/MVP) constraints apply.
```

## Signal Categories

Scan at least one signal from each category:

```bash
# Category 1: Scale indicators
find src -name "*.ts" -o -name "*.py" | wc -l          # File count
wc -l src/**/*.ts 2>/dev/null | tail -1                 # Total LOC

# Category 2: Infrastructure signals
ls .github/workflows/ 2>/dev/null                       # CI presence
ls docker-compose* Dockerfile 2>/dev/null               # Container presence
find . -name "*.tf" -o -name "helmfile*" 2>/dev/null    # K8s/Terraform

# Category 3: Dependency complexity
cat package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('dependencies',{})))"
ls CONTRIBUTING.md CODE_OF_CONDUCT.md 2>/dev/null        # OSS indicators

# Category 4: Documentation signals
grep -ril "take-home\|assignment\|interview" README* 2>/dev/null
grep -ril "enterprise\|compliance\|SOC2" README* docs/ 2>/dev/null
```

## Conflict Resolution

When signals disagree:

```markdown
## Tier Detection: CONFLICTING SIGNALS

| Signal | Tier Indicated |
|--------|----------------|
| 5 files, 200 LOC | Tier 1-2 |
| Kubernetes manifests present | Tier 4-5 |
| No tests | Tier 1-2 |

**Conflict:** Codebase size suggests prototype, but K8s manifests
suggest enterprise. Asking user to clarify project intent.
```

Do not average or guess — ask the user when signals conflict by more than 1 tier.
