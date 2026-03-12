---
title: Verify detected stack matches actual project files before applying presets
impact: HIGH
impactDescription: "Applying skills for a framework that isn't actually used wastes token budget and confuses future recommendations"
tags: stack-detection, validation, phase-2, presets
---

## Stack Detection Validation

After Phase 1 scan and Phase 2 classification, validate that detected frameworks have corroborating evidence in actual project files before recommending skills or applying presets.

## Problem

Glob probes can produce false positives. A `next.config.js` file left over from a deleted experiment causes Next.js skills to be recommended for a pure Express project. A `docker-compose.yml` with only a database service triggers full Docker/K8s skill recommendations.

**Incorrect -- trust Glob results without validation:**
```python
# Phase 2: Classify scan results directly
scan = glob_results  # {"next.config.js": True, "package.json": True}

stack = []
if scan.get("next.config.js"):
    stack.append("Next.js")  # No check if Next.js is an actual dependency
    recommend_skills(["react-server-components-framework", "vite-advanced"])
```

**Correct -- cross-reference with dependency manifests:**
```python
# Phase 2: Validate detection against dependency files
scan = glob_results  # {"next.config.js": True, "package.json": True}
package_json = Read("package.json")
deps = {**package_json.get("dependencies", {}), **package_json.get("devDependencies", {})}

stack = []
if scan.get("next.config.js") and "next" in deps:
    stack.append({"name": "Next.js", "version": deps["next"], "confidence": "high"})
elif scan.get("next.config.js"):
    stack.append({"name": "Next.js", "version": "unknown", "confidence": "low"})
    # Flag for user confirmation before recommending skills
    flag_for_confirmation("Next.js detected via config file but not in package.json dependencies")
```

**Key rules:**
- Cross-reference config file detection with dependency manifests (package.json, pyproject.toml, go.mod, Cargo.toml)
- Assign confidence levels: `high` (in deps + config), `medium` (deps only), `low` (config only)
- Present low-confidence detections to user for confirmation before applying preset skills
- Never silently apply a preset based on a single file match without dependency corroboration
- When `--rescan` is used, re-validate all previously detected stack items against current state
- For monorepo projects, scan each workspace root independently -- a framework in `packages/web/` should not trigger recommendations for `packages/api/`
- Display the confidence level next to each detected item in the Phase 2 stack profile output
- If zero high-confidence items are detected, prompt the user to manually specify their stack before proceeding to Phase 4
