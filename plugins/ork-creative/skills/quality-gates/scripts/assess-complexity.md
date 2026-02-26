---
name: assess-complexity
description: Assess task complexity with auto-analyzed codebase context. Use when evaluating task difficulty before starting work.
user-invocable: true
argument-hint: [file-or-directory]
---

Assess complexity for: $ARGUMENTS

## Codebase Context (Auto-Analyzed)

- **Current Directory**: !`pwd`
- **Project Root**: !`basename $(git rev-parse --show-toplevel 2>/dev/null) || echo "Unknown"`
- **Total Files**: !`find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Total LOC**: !`find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0"`
- **Test Files**: !`find . -type f \( -name "*test*.py" -o -name "*test*.ts" -o -name "*.spec.*" \) 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Recent Changes**: !`git log --oneline --since="1 week ago" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`

## Your Task

Analyze complexity for target: **$ARGUMENTS**

Use the following commands to gather metrics:
- Files: `find "$ARGUMENTS" -type f | wc -l`
- Lines of code: `find "$ARGUMENTS" -type f -name "*.py" -o -name "*.ts" | xargs wc -l`
- Test files: `find "$ARGUMENTS" -name "*test*" | wc -l`
- Recent changes: `git log --oneline --since="1 week ago" -- "$ARGUMENTS"`

## Complexity Assessment

### Task: $ARGUMENTS

**Date:** !`date +%Y-%m-%d`
**Assessor:** Quality Gates Agent

---

## Assessment Criteria

Score each criterion, then sum for total complexity assessment:

### 1. Lines of Code Estimate

- [ ] **< 50 lines** = 1 point
- [ ] **50-200 lines** = 2 points
- [ ] **200-500 lines** = 3 points
- [ ] **500-1500 lines** = 4 points
- [ ] **1500+ lines** = 5 points

**Estimated LOC**: [Run: `find "$ARGUMENTS" -type f -name "*.py" -o -name "*.ts" | xargs wc -l`]
**Score:** _____ / 5

---

### 2. Time Estimate

- [ ] **< 30 minutes** = 1 point
- [ ] **30 minutes - 2 hours** = 2 points
- [ ] **2-8 hours** = 3 points
- [ ] **8-24 hours (1-3 days)** = 4 points
- [ ] **24+ hours (3+ days)** = 5 points

**Score:** _____ / 5

---

### 3. Number of Files

- [ ] **1 file** = 1 point
- [ ] **2-3 files** = 2 points
- [ ] **4-10 files** = 3 points
- [ ] **11-25 files** = 4 points
- [ ] **26+ files** = 5 points

**Files Affected**: [Run: `find "$ARGUMENTS" -type f | wc -l`]
**Score:** _____ / 5

---

### 4. Dependencies Count

- [ ] **0 dependencies** = 1 point
- [ ] **1 dependency** = 2 points
- [ ] **2-3 dependencies** = 3 points
- [ ] **4-6 dependencies** = 4 points
- [ ] **7+ dependencies** = 5 points

**Imports Found**: [Run: `grep -r "import\|from" "$ARGUMENTS" | wc -l`]
**Score:** _____ / 5

---

### 5. Unknowns/Uncertainty

- [ ] **No unknowns** - Everything clear = 1 point
- [ ] **Minimal unknowns** - 1-2 minor questions = 2 points
- [ ] **Some unknowns** - Several questions, researchable = 3 points
- [ ] **Significant unknowns** - Many questions, requires exploration = 4 points
- [ ] **Many unknowns** - Unclear scope, needs prototyping = 5 points

**Score:** _____ / 5

---

### 6. Cross-Cutting Concerns

- [ ] **Isolated change** - Single module = 1 point
- [ ] **Minor integration** - 2-3 modules = 2 points
- [ ] **Multiple integrations** - 4-5 modules = 3 points
- [ ] **Cross-cutting** - Affects many modules = 4 points
- [ ] **Architectural** - System-wide impact = 5 points

**Score:** _____ / 5

---

### 7. Risk Level

- [ ] **No risk** - Trivial change = 1 point
- [ ] **Low risk** - Well-understood pattern = 2 points
- [ ] **Medium risk** - Some complexity, testable = 3 points
- [ ] **High risk** - Complex logic, many edge cases = 4 points
- [ ] **Very high risk** - Mission-critical, high stakes = 5 points

**Score:** _____ / 5

---

## Total Complexity Score

**Sum of all scores:** _____ / 35

### Complexity Level Assignment

Calculate average score: **Total ÷ 7 = _____**

**Final Complexity Level:**

- [ ] **Level 1 (Trivial)** - Average 1.0-1.4
- [ ] **Level 2 (Simple)** - Average 1.5-2.4
- [ ] **Level 3 (Moderate)** - Average 2.5-3.4
- [ ] **Level 4 (Complex)** - Average 3.5-4.4
- [ ] **Level 5 (Very Complex)** - Average 4.5-5.0

**Assigned Level:** _____

---

## Decision

**Complexity Level:** [1-5]

**Can Proceed Directly:** ✅ Yes (Level 1-3) / ❌ No (Level 4-5, needs breakdown)

**Next Action:**
- **If Level 1-3:** Proceed with gate check
- **If Level 4-5:** Break down into subtasks, then reassess
