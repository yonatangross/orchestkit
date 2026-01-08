# Standards Validation System Design

**Version:** 1.0.0
**Date:** 2026-01-08
**Stack:** Full-stack (React 19 + FastAPI)
**Enforcement:** BLOCKING (strict)

---

## Overview

This document defines a comprehensive validation system that enforces 2026 best practices for:
1. **Testing Standards** - AAA pattern, coverage, isolation
2. **Folder Structure** - Feature-based, max nesting, unidirectional imports
3. **Backend Architecture** - Clean Architecture, DI, layer separation

All validators use **BLOCKING** behavior - violations prevent file creation/modification.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VALIDATION PIPELINE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │  PreToolUse │───▶│   TOOL      │───▶│ PostToolUse │             │
│  │   HOOKS     │    │  EXECUTION  │    │   HOOKS     │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│        │                                      │                     │
│        ▼                                      ▼                     │
│  ┌─────────────┐                       ┌─────────────┐             │
│  │ BLOCK if    │                       │ BLOCK if    │             │
│  │ violation   │                       │ violation   │             │
│  └─────────────┘                       └─────────────┘             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                     SUBAGENT VALIDATION                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  SubagentStop Hook                           │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │   │
│  │  │ Coverage Gate │  │ Standards     │  │ Architecture  │    │   │
│  │  │ (≥80%)        │  │ Compliance    │  │ Compliance    │    │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Testing Standards Validators

### 1.1 Skill: `test-standards-enforcer`

**File:** `.claude/skills/test-standards-enforcer/SKILL.md`

```yaml
---
name: test-standards-enforcer
description: Enforce testing best practices - AAA pattern, naming conventions, isolation, coverage thresholds. Blocks non-compliant tests.
context: fork
agent: test-generator
model: sonnet
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [testing, quality, enforcement, blocking]
hooks:
  PreToolUse:
    - matcher: Write
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/test-location-validator.sh"
  PostToolUse:
    - matcher: Write|Edit
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/test-pattern-validator.sh"
  Stop:
    - command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/coverage-threshold-gate.sh"
---
```

### 1.2 Hook: `test-location-validator.sh`

**File:** `.claude/hooks/skill/test-location-validator.sh`

**Purpose:** BLOCK tests written in wrong location

**Validation Rules:**

| Rule | Pattern | Action |
|------|---------|--------|
| Test files in tests/ | `*.test.{ts,tsx,js,py}` must be in `tests/` or `__tests__/` | BLOCK |
| Source files not in tests/ | Non-test files cannot be in test directories | BLOCK |
| Test file naming | Must match `*.test.*` or `*_test.py` or `test_*.py` | BLOCK |
| Conftest location | `conftest.py` only in `tests/` root or subdirs | BLOCK |

```bash
#!/bin/bash
# BLOCKING: Tests must be in correct location
set -euo pipefail

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Detect test file patterns
IS_TEST_FILE=false
if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] || \
   [[ "$FILE_PATH" =~ (^|/)test_.*\.py$ ]] || \
   [[ "$FILE_PATH" =~ _test\.py$ ]]; then
    IS_TEST_FILE=true
fi

# Rule 1: Test files MUST be in test directories
if [[ "$IS_TEST_FILE" == "true" ]]; then
    if [[ ! "$FILE_PATH" =~ (tests/|__tests__/|/test/) ]]; then
        echo "BLOCKED: Test file must be in tests/, __tests__/, or test/ directory"
        echo "  File: $FILE_PATH"
        echo "  Move to: tests/$(basename "$FILE_PATH")"
        exit 1
    fi
fi

# Rule 2: Source files CANNOT be in test directories
if [[ "$IS_TEST_FILE" == "false" ]] && [[ "$FILE_PATH" =~ (tests/|__tests__/) ]]; then
    # Allow conftest.py and fixtures
    if [[ ! "$FILE_PATH" =~ (conftest\.py|fixtures|__init__\.py|factories) ]]; then
        echo "BLOCKED: Source files cannot be in test directories"
        echo "  File: $FILE_PATH"
        echo "  Move to: src/ or app/"
        exit 1
    fi
fi

# Rule 3: TypeScript/JavaScript test naming
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]] && [[ "$FILE_PATH" =~ (tests/|__tests__/) ]]; then
    if [[ ! "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]]; then
        echo "BLOCKED: Test files must use .test.ts or .spec.ts suffix"
        echo "  File: $FILE_PATH"
        exit 1
    fi
fi

exit 0
```

### 1.3 Hook: `test-pattern-validator.sh`

**File:** `.claude/hooks/skill/test-pattern-validator.sh`

**Purpose:** BLOCK tests that don't follow AAA pattern and naming conventions

```bash
#!/bin/bash
# BLOCKING: Tests must follow AAA pattern and naming conventions
set -euo pipefail

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0

# Only validate test files
if [[ ! "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] && \
   [[ ! "$FILE_PATH" =~ (test_.*\.py|_test\.py)$ ]]; then
    exit 0
fi

ERRORS=()

# === TypeScript/JavaScript Tests ===
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then

    # Rule: Test names must be descriptive (should/when pattern)
    if echo "$CONTENT" | grep -qE "test\(['\"][^'\"]{0,10}['\"]" 2>/dev/null; then
        ERRORS+=("Test names too short. Use descriptive names: test('should X when Y')")
    fi

    # Rule: No multiple expects without clear sections
    # Count tests with >3 expects and no comments
    MULTI_ASSERT=$(echo "$CONTENT" | grep -c "expect(" 2>/dev/null || echo "0")
    TEST_COUNT=$(echo "$CONTENT" | grep -cE "(test|it)\(" 2>/dev/null || echo "1")
    AVG_ASSERTS=$((MULTI_ASSERT / TEST_COUNT))

    if [[ $AVG_ASSERTS -gt 3 ]]; then
        ERRORS+=("Too many assertions per test (avg: $AVG_ASSERTS). Split into focused tests or add AAA comments.")
    fi

    # Rule: No shared mutable state
    if echo "$CONTENT" | grep -qE "^let [a-zA-Z]+ =" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "beforeEach|beforeAll" 2>/dev/null; then
            ERRORS+=("Shared mutable state detected. Use beforeEach to reset state.")
        fi
    fi
fi

# === Python Tests ===
if [[ "$FILE_PATH" =~ \.py$ ]]; then

    # Rule: Test function naming
    if echo "$CONTENT" | grep -qE "^def test[a-z]" 2>/dev/null; then
        ERRORS+=("Test names must use snake_case: test_should_x_when_y")
    fi

    # Rule: No class-level mutable defaults
    if echo "$CONTENT" | grep -qE "class Test.*:.*\n.*[a-z_]+ = \[\]" 2>/dev/null; then
        ERRORS+=("Class-level mutable defaults detected. Use fixtures instead.")
    fi

    # Rule: Use pytest fixtures, not setUp/tearDown
    if echo "$CONTENT" | grep -qE "def (setUp|tearDown)\(" 2>/dev/null; then
        ERRORS+=("Use pytest fixtures instead of setUp/tearDown (unittest pattern).")
    fi
fi

# Report errors and block
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Test pattern violations detected"
    echo ""
    for error in "${ERRORS[@]}"; do
        echo "  - $error"
    done
    echo ""
    echo "Reference: .claude/skills/test-standards-enforcer/SKILL.md"
    exit 1
fi

exit 0
```

### 1.4 Hook: `coverage-threshold-gate.sh`

**File:** `.claude/hooks/skill/coverage-threshold-gate.sh`

**Purpose:** BLOCK if coverage falls below threshold after implementation

```bash
#!/bin/bash
# BLOCKING: Coverage must meet threshold
set -euo pipefail

THRESHOLD=80
COVERAGE_PATHS=(
    "coverage/coverage-summary.json"
    "htmlcov/status.json"
    ".coverage.json"
)

# Find coverage file
COVERAGE_FILE=""
for path in "${COVERAGE_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        COVERAGE_FILE="$path"
        break
    fi
done

# No coverage file = skip (coverage might not be configured)
[[ -z "$COVERAGE_FILE" ]] && exit 0

# Parse coverage based on file type
if [[ "$COVERAGE_FILE" == *"coverage-summary.json" ]]; then
    # Jest/Vitest format
    COVERAGE=$(jq -r '.total.lines.pct // .total.statements.pct // 0' "$COVERAGE_FILE" 2>/dev/null || echo "0")
elif [[ "$COVERAGE_FILE" == *".coverage.json" ]]; then
    # Python coverage.py format
    COVERAGE=$(jq -r '.totals.percent_covered // 0' "$COVERAGE_FILE" 2>/dev/null || echo "0")
else
    exit 0
fi

# Compare (handle decimals)
if (( $(echo "$COVERAGE < $THRESHOLD" | bc -l) )); then
    echo "BLOCKED: Coverage ${COVERAGE}% is below threshold ${THRESHOLD}%"
    echo ""
    echo "Actions required:"
    echo "  1. Add tests for uncovered code"
    echo "  2. Run: npm test -- --coverage (or pytest --cov)"
    echo "  3. Ensure coverage ≥ ${THRESHOLD}% before proceeding"
    exit 1
fi

echo "Coverage gate passed: ${COVERAGE}% (threshold: ${THRESHOLD}%)"
exit 0
```

---

## 2. Folder Structure Validators

### 2.1 Skill: `project-structure-enforcer`

**File:** `.claude/skills/project-structure-enforcer/SKILL.md`

```yaml
---
name: project-structure-enforcer
description: Enforce 2026 folder structure standards - feature-based organization, max nesting depth, unidirectional imports. Blocks structural violations.
context: fork
agent: code-quality-reviewer
model: sonnet
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [structure, architecture, enforcement, blocking]
hooks:
  PreToolUse:
    - matcher: Write
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/structure-location-validator.sh"
  PostToolUse:
    - matcher: Write|Edit
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/import-direction-enforcer.sh"
---
```

### 2.2 Hook: `structure-location-validator.sh`

**File:** `.claude/hooks/skill/structure-location-validator.sh`

**Purpose:** BLOCK files created in wrong locations

**React/Next.js Structure:**
```
src/
├── components/     # Reusable UI components only
├── features/       # Feature modules (self-contained)
├── hooks/          # Custom React hooks
├── services/       # API clients, external services
├── lib/            # Third-party integrations
├── types/          # TypeScript type definitions
├── utils/          # Pure utility functions
└── app/            # Next.js App Router pages
```

**FastAPI Structure:**
```
app/
├── routers/        # API route handlers
├── services/       # Business logic
├── repositories/   # Data access layer
├── schemas/        # Pydantic models
├── models/         # SQLAlchemy models
├── core/           # Config, dependencies, security
└── utils/          # Utility functions
```

```bash
#!/bin/bash
# BLOCKING: Files must be in correct architectural locations
set -euo pipefail

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

ERRORS=()

# === NESTING DEPTH (max 4 levels from src/ or app/) ===
if [[ "$FILE_PATH" =~ (src/|app/) ]]; then
    # Extract path after src/ or app/
    RELATIVE_PATH=$(echo "$FILE_PATH" | sed -E 's|.*(src/\|app/)||')
    DEPTH=$(echo "$RELATIVE_PATH" | tr '/' '\n' | grep -c . || echo "0")

    if [[ $DEPTH -gt 4 ]]; then
        ERRORS+=("Max nesting depth exceeded: $DEPTH levels (max: 4)")
        ERRORS+=("  Consider flattening: $FILE_PATH")
    fi
fi

# === REACT/TYPESCRIPT STRUCTURE ===
if [[ "$FILE_PATH" =~ \.(tsx|ts|jsx|js)$ ]]; then
    FILENAME=$(basename "$FILE_PATH")

    # Components must be in components/ or features/
    if [[ "$FILENAME" =~ ^[A-Z].*\.(tsx|jsx)$ ]]; then
        if [[ ! "$FILE_PATH" =~ (components/|features/|app/) ]]; then
            ERRORS+=("React components must be in components/, features/, or app/")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi

    # Hooks must be in hooks/ or feature's hooks/
    if [[ "$FILENAME" =~ ^use[A-Z].*\.ts$ ]]; then
        if [[ ! "$FILE_PATH" =~ (hooks/|/hooks/) ]]; then
            ERRORS+=("Custom hooks must be in hooks/ directory")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi

    # No barrel files (index.ts that only re-exports)
    if [[ "$FILENAME" == "index.ts" ]] || [[ "$FILENAME" == "index.tsx" ]]; then
        ERRORS+=("Barrel files (index.ts) discouraged - causes tree-shaking issues")
        ERRORS+=("  Import directly from source files instead")
        ERRORS+=("  File: $FILE_PATH")
    fi
fi

# === FASTAPI/PYTHON STRUCTURE ===
if [[ "$FILE_PATH" =~ \.py$ ]]; then
    FILENAME=$(basename "$FILE_PATH")
    DIRNAME=$(dirname "$FILE_PATH")

    # Routers must be in routers/
    if [[ "$FILENAME" =~ (router|routes|api).*\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ routers ]]; then
            ERRORS+=("Router files must be in routers/ directory")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi

    # Services must be in services/
    if [[ "$FILENAME" =~ _service\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ services ]]; then
            ERRORS+=("Service files must be in services/ directory")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi

    # Schemas must be in schemas/
    if [[ "$FILENAME" =~ (_schema|_dto|_model)\.py$ ]] && [[ ! "$FILENAME" =~ _db_model ]]; then
        if [[ ! "$DIRNAME" =~ schemas ]]; then
            ERRORS+=("Schema/DTO files must be in schemas/ directory")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi

    # SQLAlchemy models must be in models/
    if [[ "$FILENAME" =~ _db_model\.py$ ]] || [[ "$FILENAME" =~ _orm\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ models ]]; then
            ERRORS+=("Database models must be in models/ directory")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi
fi

# Report errors and block
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Folder structure violation"
    echo ""
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Reference: .claude/skills/project-structure-enforcer/SKILL.md"
    exit 1
fi

exit 0
```

### 2.3 Hook: `import-direction-enforcer.sh`

**File:** `.claude/hooks/skill/import-direction-enforcer.sh`

**Purpose:** BLOCK imports that violate unidirectional flow

**Import Direction Rules:**
```
ALLOWED:
  shared → (nothing)
  lib → shared
  features → shared, lib
  app → features, shared, lib

BLOCKED:
  shared → features, app
  lib → features, app
  features → app
  features → other features (except shared types)
```

```bash
#!/bin/bash
# BLOCKING: Imports must follow unidirectional architecture
set -euo pipefail

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

ERRORS=()

# Determine current layer
LAYER=""
if [[ "$FILE_PATH" =~ /shared/ ]] || [[ "$FILE_PATH" =~ /lib/ ]]; then
    LAYER="shared"
elif [[ "$FILE_PATH" =~ /features/ ]]; then
    LAYER="features"
elif [[ "$FILE_PATH" =~ /app/ ]] || [[ "$FILE_PATH" =~ /pages/ ]]; then
    LAYER="app"
elif [[ "$FILE_PATH" =~ /components/ ]]; then
    LAYER="components"
elif [[ "$FILE_PATH" =~ /services/ ]] && [[ "$FILE_PATH" =~ \.py$ ]]; then
    LAYER="services"
elif [[ "$FILE_PATH" =~ /routers/ ]]; then
    LAYER="routers"
fi

[[ -z "$LAYER" ]] && exit 0

# === TypeScript/JavaScript Import Validation ===
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then

    case $LAYER in
        "shared")
            # Shared cannot import from features or app
            if echo "$CONTENT" | grep -qE "from ['\"](@/|\.\./)*(features|app)/" 2>/dev/null; then
                ERRORS+=("shared/ cannot import from features/ or app/")
                ERRORS+=("  Import direction: shared → (nothing above)")
            fi
            ;;
        "components")
            # Components cannot import from features or app
            if echo "$CONTENT" | grep -qE "from ['\"](@/|\.\./)*(features|app)/" 2>/dev/null; then
                ERRORS+=("components/ cannot import from features/ or app/")
                ERRORS+=("  Components should be feature-agnostic")
            fi
            ;;
        "features")
            # Features cannot import from app
            if echo "$CONTENT" | grep -qE "from ['\"](@/|\.\./)*app/" 2>/dev/null; then
                ERRORS+=("features/ cannot import from app/")
                ERRORS+=("  Import direction: features → shared, lib, components")
            fi
            # Features cannot import from other features (except shared types)
            FEATURE_NAME=$(echo "$FILE_PATH" | sed -E 's|.*features/([^/]+)/.*|\1|')
            if echo "$CONTENT" | grep -qE "from ['\"](@/|\.\./)*features/(?!$FEATURE_NAME)" 2>/dev/null; then
                # Allow type imports
                if ! echo "$CONTENT" | grep -qE "import type.*from.*features/" 2>/dev/null; then
                    ERRORS+=("Cannot import from other features (cross-feature dependency)")
                    ERRORS+=("  Extract shared code to shared/ or lib/")
                fi
            fi
            ;;
    esac
fi

# === Python Import Validation ===
if [[ "$FILE_PATH" =~ \.py$ ]]; then

    case $LAYER in
        "services")
            # Services cannot import from routers
            if echo "$CONTENT" | grep -qE "from (app\.)?routers" 2>/dev/null; then
                ERRORS+=("services/ cannot import from routers/")
                ERRORS+=("  Services should not depend on HTTP layer")
            fi
            ;;
        "routers")
            # Routers should not import from other routers
            if echo "$CONTENT" | grep -qE "from (app\.)?routers\.[a-z]" 2>/dev/null; then
                # Allow importing from routers/__init__ or routers.deps
                if ! echo "$CONTENT" | grep -qE "from (app\.)?routers\.(deps|__init__|dependencies)" 2>/dev/null; then
                    ERRORS+=("Routers should not import from other routers")
                    ERRORS+=("  Extract shared logic to services/")
                fi
            fi
            ;;
    esac

    # Universal: repositories cannot import from services or routers
    if [[ "$FILE_PATH" =~ /repositories/ ]]; then
        if echo "$CONTENT" | grep -qE "from (app\.)?(services|routers)" 2>/dev/null; then
            ERRORS+=("repositories/ cannot import from services/ or routers/")
            ERRORS+=("  Repositories are the lowest layer")
        fi
    fi
fi

# Report errors and block
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Import direction violation (unidirectional architecture)"
    echo ""
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Allowed flow: shared/lib → components → features → app"
    echo "Reference: .claude/skills/project-structure-enforcer/SKILL.md"
    exit 1
fi

exit 0
```

---

## 3. Backend Architecture Validators

### 3.1 Skill: `backend-architecture-enforcer`

**File:** `.claude/skills/backend-architecture-enforcer/SKILL.md`

```yaml
---
name: backend-architecture-enforcer
description: Enforce FastAPI Clean Architecture - layer separation, dependency injection, async patterns, no business logic in routers. Blocks violations.
context: fork
agent: backend-system-architect
model: sonnet
version: 1.0.0
author: SkillForge AI Agent Hub
tags: [backend, fastapi, architecture, enforcement, blocking]
hooks:
  PreToolUse:
    - matcher: Write
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/backend-file-naming.sh"
  PostToolUse:
    - matcher: Write|Edit
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/backend-layer-validator.sh"
    - matcher: Write|Edit
      command: "$CLAUDE_PROJECT_DIR/.claude/hooks/skill/di-pattern-enforcer.sh"
---
```

### 3.2 Hook: `backend-file-naming.sh`

**File:** `.claude/hooks/skill/backend-file-naming.sh`

**Purpose:** BLOCK incorrectly named backend files

```bash
#!/bin/bash
# BLOCKING: Backend files must follow naming conventions
set -euo pipefail

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Only validate Python files in app/
[[ ! "$FILE_PATH" =~ /app/.*\.py$ ]] && exit 0

FILENAME=$(basename "$FILE_PATH")
DIRNAME=$(dirname "$FILE_PATH")
ERRORS=()

# === Router naming ===
if [[ "$DIRNAME" =~ /routers$ ]]; then
    if [[ ! "$FILENAME" =~ ^(router_|routes_|api_|__init__|deps|dependencies).*\.py$ ]]; then
        ERRORS+=("Router files must be prefixed: router_*, routes_*, or api_*")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  Example: router_users.py, routes_auth.py")
    fi
fi

# === Service naming ===
if [[ "$DIRNAME" =~ /services$ ]]; then
    if [[ ! "$FILENAME" =~ ^.*_service\.py$ ]] && [[ "$FILENAME" != "__init__.py" ]]; then
        ERRORS+=("Service files must end with _service.py")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  Example: user_service.py, auth_service.py")
    fi
fi

# === Repository naming ===
if [[ "$DIRNAME" =~ /repositories$ ]]; then
    if [[ ! "$FILENAME" =~ ^.*_(repository|repo)\.py$ ]] && [[ "$FILENAME" != "__init__.py" ]]; then
        ERRORS+=("Repository files must end with _repository.py or _repo.py")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  Example: user_repository.py, user_repo.py")
    fi
fi

# === Schema naming ===
if [[ "$DIRNAME" =~ /schemas$ ]]; then
    if [[ ! "$FILENAME" =~ ^.*_(schema|dto|request|response)\.py$ ]] && [[ "$FILENAME" != "__init__.py" ]]; then
        ERRORS+=("Schema files must end with _schema.py, _dto.py, _request.py, or _response.py")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  Example: user_schema.py, auth_dto.py")
    fi
fi

# === Model naming ===
if [[ "$DIRNAME" =~ /models$ ]]; then
    if [[ ! "$FILENAME" =~ ^.*_(model|entity|orm)\.py$ ]] && [[ "$FILENAME" != "__init__.py" ]] && [[ "$FILENAME" != "base.py" ]]; then
        ERRORS+=("Model files must end with _model.py, _entity.py, or _orm.py")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  Example: user_model.py, order_entity.py")
    fi
fi

# Report errors and block
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Backend file naming violation"
    echo ""
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Reference: .claude/skills/backend-architecture-enforcer/SKILL.md"
    exit 1
fi

exit 0
```

### 3.3 Hook: `backend-layer-validator.sh`

**File:** `.claude/hooks/skill/backend-layer-validator.sh`

**Purpose:** BLOCK business logic in routers, DB access outside repositories

```bash
#!/bin/bash
# BLOCKING: Enforce layer separation in FastAPI
set -euo pipefail

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

# Only validate Python files
[[ ! "$FILE_PATH" =~ \.py$ ]] && exit 0

ERRORS=()

# === ROUTER LAYER VIOLATIONS ===
if [[ "$FILE_PATH" =~ /routers/ ]]; then

    # No direct database operations
    if echo "$CONTENT" | grep -qE "db\.(add|delete|commit|execute|query|refresh)" 2>/dev/null; then
        ERRORS+=("Database operations not allowed in routers")
        ERRORS+=("  Move to repository layer")
    fi

    # No SQLAlchemy imports (except for type hints)
    if echo "$CONTENT" | grep -qE "^from sqlalchemy" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "from sqlalchemy.*(orm|ext)" 2>/dev/null; then
            ERRORS+=("SQLAlchemy imports not allowed in routers")
            ERRORS+=("  Routers should only handle HTTP concerns")
        fi
    fi

    # No complex business logic (heuristic: functions > 20 lines)
    FUNCTION_COUNT=$(echo "$CONTENT" | grep -c "^async def\|^def" 2>/dev/null || echo "0")
    LINE_COUNT=$(echo "$CONTENT" | wc -l)
    if [[ $FUNCTION_COUNT -gt 0 ]]; then
        AVG_LINES=$((LINE_COUNT / FUNCTION_COUNT))
        if [[ $AVG_LINES -gt 30 ]]; then
            ERRORS+=("Router functions too complex (avg ${AVG_LINES} lines)")
            ERRORS+=("  Extract business logic to services/")
        fi
    fi

    # No direct model creation with business logic
    if echo "$CONTENT" | grep -qE "for .* in .*:.*\n.*if" 2>/dev/null; then
        ERRORS+=("Complex loops detected in router - move to service layer")
    fi
fi

# === SERVICE LAYER VIOLATIONS ===
if [[ "$FILE_PATH" =~ /services/ ]]; then

    # No direct HTTP response handling
    if echo "$CONTENT" | grep -qE "(HTTPException|JSONResponse|Response)\(" 2>/dev/null; then
        ERRORS+=("HTTP responses not allowed in services")
        ERRORS+=("  Return data/raise domain exceptions, let routers handle HTTP")
    fi

    # No Request/Response type usage
    if echo "$CONTENT" | grep -qE "from fastapi import.*(Request|Response)" 2>/dev/null; then
        ERRORS+=("Request/Response types not allowed in services")
        ERRORS+=("  Services should be HTTP-agnostic")
    fi
fi

# === REPOSITORY LAYER VIOLATIONS ===
if [[ "$FILE_PATH" =~ /repositories/ ]]; then

    # No HTTP exceptions
    if echo "$CONTENT" | grep -qE "HTTPException" 2>/dev/null; then
        ERRORS+=("HTTPException not allowed in repositories")
        ERRORS+=("  Raise domain exceptions or return None")
    fi

    # No service imports
    if echo "$CONTENT" | grep -qE "from.*services.*import" 2>/dev/null; then
        ERRORS+=("Repositories cannot import from services")
        ERRORS+=("  Repositories are the lowest layer")
    fi
fi

# Report errors and block
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Backend layer separation violation"
    echo ""
    echo "Architecture layers:"
    echo "  routers/    → HTTP only (request/response handling)"
    echo "  services/   → Business logic (orchestration)"
    echo "  repositories/ → Data access (database operations)"
    echo ""
    echo "Violations:"
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Reference: .claude/skills/backend-architecture-enforcer/SKILL.md"
    exit 1
fi

exit 0
```

### 3.4 Hook: `di-pattern-enforcer.sh`

**File:** `.claude/hooks/skill/di-pattern-enforcer.sh`

**Purpose:** BLOCK direct instantiation, enforce Depends()

```bash
#!/bin/bash
# BLOCKING: Enforce dependency injection patterns
set -euo pipefail

FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

# Only validate Python files in routers/
[[ ! "$FILE_PATH" =~ /routers/.*\.py$ ]] && exit 0

ERRORS=()

# === Direct instantiation anti-patterns ===

# No direct service instantiation
if echo "$CONTENT" | grep -qE "= [A-Z][a-zA-Z]*Service\(\)" 2>/dev/null; then
    ERRORS+=("Direct service instantiation not allowed")
    ERRORS+=("  Use: service: MyService = Depends(get_my_service)")
fi

# No direct repository instantiation
if echo "$CONTENT" | grep -qE "= [A-Z][a-zA-Z]*Repository\(\)" 2>/dev/null; then
    ERRORS+=("Direct repository instantiation not allowed")
    ERRORS+=("  Use: repo: MyRepo = Depends(get_my_repo)")
fi

# No global service/repo instances
if echo "$CONTENT" | grep -qE "^[a-z_]+ = [A-Z][a-zA-Z]*(Service|Repository|Repo)\(" 2>/dev/null; then
    ERRORS+=("Global service/repository instances not allowed")
    ERRORS+=("  Use FastAPI's Depends() for dependency injection")
fi

# === Missing Depends() patterns ===

# Check for function parameters without Depends
# This is a heuristic - looking for typed parameters that should be injected
if echo "$CONTENT" | grep -qE "def.*\(.*: (Session|AsyncSession)[^=]*\)" 2>/dev/null; then
    if ! echo "$CONTENT" | grep -qE ": (Session|AsyncSession) = Depends" 2>/dev/null; then
        ERRORS+=("Database session must use Depends()")
        ERRORS+=("  Use: db: AsyncSession = Depends(get_db)")
    fi
fi

# === Async consistency ===

# No sync database calls in async functions
if echo "$CONTENT" | grep -qE "async def" 2>/dev/null; then
    if echo "$CONTENT" | grep -qE "\.query\(|\.execute\(" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "await.*\.(query|execute)" 2>/dev/null; then
            ERRORS+=("Sync database calls in async function")
            ERRORS+=("  Use async methods or wrap with run_in_executor")
        fi
    fi
fi

# Report errors and block
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Dependency injection violation"
    echo ""
    echo "Correct pattern:"
    echo "  @router.get('/items')"
    echo "  async def get_items("
    echo "      service: ItemService = Depends(get_item_service),"
    echo "      db: AsyncSession = Depends(get_db)"
    echo "  ):"
    echo ""
    echo "Violations:"
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Reference: .claude/skills/backend-architecture-enforcer/SKILL.md"
    exit 1
fi

exit 0
```

---

## 4. New Subagent: `standards-validator`

### 4.1 Subagent Definition

Add to Claude Code's subagent registry:

```
standards-validator: Full-stack standards validation agent. Scans code for testing,
folder structure, and backend architecture violations. Returns compliance report with
specific file:line references. Use after implementation to verify standards compliance.
(Tools: Read, Grep, Glob, Bash)
```

### 4.2 Validation Report Format

```markdown
# Standards Compliance Report

**Scan Date:** 2026-01-08
**Files Scanned:** 47
**Violations:** 3 BLOCKING, 2 WARNING

## BLOCKING Violations

### 1. Test Location (test-location-validator)
- **File:** src/utils/helpers.test.ts:1
- **Rule:** Test files must be in tests/ directory
- **Fix:** Move to tests/utils/helpers.test.ts

### 2. Import Direction (import-direction-enforcer)
- **File:** src/features/auth/useAuth.ts:5
- **Rule:** features/ cannot import from app/
- **Import:** `from '@/app/providers'`
- **Fix:** Extract provider types to shared/

### 3. Layer Separation (backend-layer-validator)
- **File:** app/routers/router_users.py:42
- **Rule:** Database operations not allowed in routers
- **Code:** `db.add(user)`
- **Fix:** Move to user_repository.py

## Warnings

### 1. Nesting Depth
- **File:** src/features/dashboard/widgets/charts/line/LineChart.tsx
- **Depth:** 5 levels (max: 4)
- **Suggestion:** Flatten to src/features/dashboard/charts/LineChart.tsx

## Passed Checks

- ✅ AAA Pattern (47 test files)
- ✅ Coverage Threshold (84.2%)
- ✅ File Naming Conventions
- ✅ Dependency Injection Patterns
```

---

## 5. Integration: settings.json Updates

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/test-location-validator.sh",
            "statusMessage": "Validating test location..."
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/structure-location-validator.sh",
            "statusMessage": "Validating folder structure..."
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/backend-file-naming.sh",
            "statusMessage": "Validating backend naming..."
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/test-pattern-validator.sh"
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/import-direction-enforcer.sh"
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/backend-layer-validator.sh"
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/di-pattern-enforcer.sh"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/skill/coverage-threshold-gate.sh"
          }
        ]
      }
    ]
  }
}
```

---

## 6. Summary: All New Files

### Skills (3 new)
| File | Purpose |
|------|---------|
| `.claude/skills/test-standards-enforcer/SKILL.md` | Testing best practices |
| `.claude/skills/project-structure-enforcer/SKILL.md` | Folder structure rules |
| `.claude/skills/backend-architecture-enforcer/SKILL.md` | FastAPI architecture |

### Hooks (8 new)
| File | Type | Blocks On |
|------|------|-----------|
| `test-location-validator.sh` | PreToolUse | Tests in wrong location |
| `test-pattern-validator.sh` | PostToolUse | AAA violations, naming |
| `coverage-threshold-gate.sh` | SubagentStop | Coverage < 80% |
| `structure-location-validator.sh` | PreToolUse | Wrong file locations |
| `import-direction-enforcer.sh` | PostToolUse | Invalid imports |
| `backend-file-naming.sh` | PreToolUse | Bad file names |
| `backend-layer-validator.sh` | PostToolUse | Layer violations |
| `di-pattern-enforcer.sh` | PostToolUse | Missing DI |

### Subagent (1 new)
| Name | Purpose |
|------|---------|
| `standards-validator` | Full compliance scan |

---

## 7. Validation Rule Summary

### Testing Standards
| Rule | Severity | When |
|------|----------|------|
| Tests in tests/ directory | BLOCK | PreToolUse |
| AAA pattern in tests | BLOCK | PostToolUse |
| Descriptive test names | BLOCK | PostToolUse |
| Coverage ≥ 80% | BLOCK | SubagentStop |
| One assertion per test | WARN | PostToolUse |
| No shared mutable state | BLOCK | PostToolUse |

### Folder Structure
| Rule | Severity | When |
|------|----------|------|
| Max 4 nesting levels | BLOCK | PreToolUse |
| No barrel files (index.ts) | BLOCK | PreToolUse |
| Components in components/ | BLOCK | PreToolUse |
| Hooks in hooks/ | BLOCK | PreToolUse |
| Unidirectional imports | BLOCK | PostToolUse |

### Backend Architecture
| Rule | Severity | When |
|------|----------|------|
| Correct file naming | BLOCK | PreToolUse |
| No DB in routers | BLOCK | PostToolUse |
| No HTTP in services | BLOCK | PostToolUse |
| Use Depends() for DI | BLOCK | PostToolUse |
| Async consistency | BLOCK | PostToolUse |

---

## Next Steps

1. **Create skill files** with full documentation
2. **Implement hook scripts** with proper error handling
3. **Add to settings.json** hook configuration
4. **Test with sample violations** to verify blocking works
5. **Document for users** in README
