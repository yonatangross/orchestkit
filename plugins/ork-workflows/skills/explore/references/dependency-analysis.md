# Dependency Analysis

Identify coupling hotspots and dependency patterns in codebases.

## Fan-In / Fan-Out Metrics

| Metric | Definition | Implication |
|--------|------------|-------------|
| **Fan-In** | Files that import this module | High = many dependents, changes risky |
| **Fan-Out** | Modules this file imports | High = many dependencies, fragile |
| **Instability** | Fan-Out / (Fan-In + Fan-Out) | 0 = stable, 1 = unstable |

**Ideal Patterns:**
- Core utilities: High fan-in, low fan-out (stable)
- Feature modules: Low fan-in, moderate fan-out
- Entry points: Low fan-in, high fan-out

---

## Hotspot Identification

### High-Risk Indicators

| Pattern | Risk | Action |
|---------|------|--------|
| Fan-in > 10 | Blast radius large | Add interface/abstraction |
| Fan-out > 8 | Too many dependencies | Extract facades |
| Instability = 1, Fan-in > 5 | Unstable core | Stabilize or decouple |

### Coupling Score Formula

```
coupling_score = min(10, (fan_in + fan_out) / 3)
```

- 0-3: Low coupling (healthy)
- 4-6: Moderate coupling (monitor)
- 7-10: High coupling (refactor)

---

## Circular Dependency Detection

**Signs of Circular Dependencies:**
1. Import errors at runtime
2. Mysterious `None` values
3. Files that always change together
4. Cannot extract to separate package

**Detection Approach:**
```
A imports B
B imports C
C imports A  <- CIRCULAR
```

**Resolution Strategies:**
1. Extract shared interface
2. Dependency inversion (depend on abstractions)
3. Merge tightly coupled modules
4. Event-driven decoupling

---

## Change Impact Analysis

**Questions to Answer:**
1. If I modify this file, what breaks?
2. Which files always change together?
3. What is the blast radius of a refactor?

**Measuring Impact:**
- **Direct Impact**: Files importing the changed module
- **Transitive Impact**: Files importing those files
- **Co-Change Frequency**: Git history of files changed together

**High Impact Indicators:**
- > 5 direct dependents
- > 20 transitive dependents
- > 80% co-change frequency with another file
