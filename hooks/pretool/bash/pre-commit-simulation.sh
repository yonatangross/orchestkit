#!/bin/bash
set -euo pipefail
# Pre-commit Simulation Hook
# Simulates pre-commit checks before actual commit
# Detects project type and runs appropriate linters/formatters
# CC 2.1.9: Injects check results via additionalContext (WARN, not BLOCK)
# Version: 1.0.0

INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process git commit commands
if [[ ! "$COMMAND" =~ ^git\ commit ]]; then
  output_silent_success
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Get staged files for targeted checks
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")

if [[ -z "$STAGED_FILES" ]]; then
  output_silent_success
  exit 0
fi

# Detect project type(s) based on config files
ISSUES=""
CHECKS_RUN=""

# ===== Python Project Detection =====
if [[ -f "pyproject.toml" ]] || [[ -f "setup.py" ]] || [[ -f "requirements.txt" ]]; then
  PYTHON_FILES=$(echo "$STAGED_FILES" | grep -E '\.py$' || true)

  if [[ -n "$PYTHON_FILES" ]]; then
    CHECKS_RUN="${CHECKS_RUN}Python, "

    # Check if ruff is available
    if command -v ruff &>/dev/null; then
      RUFF_OUTPUT=$(ruff check $PYTHON_FILES 2>&1 || true)
      if [[ -n "$RUFF_OUTPUT" ]] && [[ ! "$RUFF_OUTPUT" =~ ^All\ checks\ passed ]]; then
        ISSUE_COUNT=$(echo "$RUFF_OUTPUT" | grep -cE '^[^:]+:[0-9]+:' || echo "0")
        if [[ "$ISSUE_COUNT" -gt 0 ]]; then
          ISSUES="${ISSUES}### Ruff Linting ($ISSUE_COUNT issues)\n\`\`\`\n${RUFF_OUTPUT:0:500}\n\`\`\`\n\n"
        fi
      fi
    fi

    # Check if mypy is available (quick type check)
    if command -v mypy &>/dev/null && [[ -f "pyproject.toml" ]]; then
      MYPY_OUTPUT=$(mypy --no-error-summary $PYTHON_FILES 2>&1 || true)
      if [[ -n "$MYPY_OUTPUT" ]] && [[ ! "$MYPY_OUTPUT" =~ ^Success ]]; then
        ISSUE_COUNT=$(echo "$MYPY_OUTPUT" | grep -cE '^[^:]+:[0-9]+:' || echo "0")
        if [[ "$ISSUE_COUNT" -gt 0 ]]; then
          ISSUES="${ISSUES}### MyPy Type Errors ($ISSUE_COUNT issues)\n\`\`\`\n${MYPY_OUTPUT:0:500}\n\`\`\`\n\n"
        fi
      fi
    fi
  fi
fi

# ===== Node.js/TypeScript Project Detection =====
if [[ -f "package.json" ]]; then
  JS_TS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(js|jsx|ts|tsx)$' || true)

  if [[ -n "$JS_TS_FILES" ]]; then
    CHECKS_RUN="${CHECKS_RUN}JavaScript/TypeScript, "

    # Check if eslint is available
    if command -v npx &>/dev/null && [[ -f "node_modules/.bin/eslint" ]] || [[ -f ".eslintrc.js" ]] || [[ -f ".eslintrc.json" ]] || [[ -f "eslint.config.js" ]]; then
      ESLINT_OUTPUT=$(npx eslint --format compact $JS_TS_FILES 2>&1 || true)
      if [[ -n "$ESLINT_OUTPUT" ]] && [[ ! "$ESLINT_OUTPUT" =~ ^$ ]]; then
        ISSUE_COUNT=$(echo "$ESLINT_OUTPUT" | grep -cE ':[0-9]+:[0-9]+:' || echo "0")
        if [[ "$ISSUE_COUNT" -gt 0 ]]; then
          ISSUES="${ISSUES}### ESLint Issues ($ISSUE_COUNT issues)\n\`\`\`\n${ESLINT_OUTPUT:0:500}\n\`\`\`\n\n"
        fi
      fi
    fi

    # TypeScript check (if tsconfig exists)
    if [[ -f "tsconfig.json" ]] && command -v npx &>/dev/null; then
      TS_FILES=$(echo "$JS_TS_FILES" | grep -E '\.tsx?$' || true)
      if [[ -n "$TS_FILES" ]]; then
        TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
        if [[ -n "$TSC_OUTPUT" ]] && [[ ! "$TSC_OUTPUT" =~ ^$ ]]; then
          ISSUE_COUNT=$(echo "$TSC_OUTPUT" | grep -cE 'error TS[0-9]+' || echo "0")
          if [[ "$ISSUE_COUNT" -gt 0 ]]; then
            ISSUES="${ISSUES}### TypeScript Errors ($ISSUE_COUNT issues)\n\`\`\`\n${TSC_OUTPUT:0:500}\n\`\`\`\n\n"
          fi
        fi
      fi
    fi
  fi
fi

# ===== Rust Project Detection =====
if [[ -f "Cargo.toml" ]]; then
  RUST_FILES=$(echo "$STAGED_FILES" | grep -E '\.rs$' || true)

  if [[ -n "$RUST_FILES" ]]; then
    CHECKS_RUN="${CHECKS_RUN}Rust, "

    # Check with cargo clippy
    if command -v cargo &>/dev/null; then
      CLIPPY_OUTPUT=$(cargo clippy --message-format=short 2>&1 || true)
      if [[ -n "$CLIPPY_OUTPUT" ]]; then
        ISSUE_COUNT=$(echo "$CLIPPY_OUTPUT" | grep -cE '^(warning|error)\[' || echo "0")
        if [[ "$ISSUE_COUNT" -gt 0 ]]; then
          ISSUES="${ISSUES}### Cargo Clippy ($ISSUE_COUNT issues)\n\`\`\`\n${CLIPPY_OUTPUT:0:500}\n\`\`\`\n\n"
        fi
      fi
    fi
  fi
fi

# ===== Go Project Detection =====
if [[ -f "go.mod" ]]; then
  GO_FILES=$(echo "$STAGED_FILES" | grep -E '\.go$' || true)

  if [[ -n "$GO_FILES" ]]; then
    CHECKS_RUN="${CHECKS_RUN}Go, "

    # Check with go vet
    if command -v go &>/dev/null; then
      VET_OUTPUT=$(go vet ./... 2>&1 || true)
      if [[ -n "$VET_OUTPUT" ]]; then
        ISSUE_COUNT=$(echo "$VET_OUTPUT" | grep -cE '^.*\.go:[0-9]+' || echo "0")
        if [[ "$ISSUE_COUNT" -gt 0 ]]; then
          ISSUES="${ISSUES}### Go Vet ($ISSUE_COUNT issues)\n\`\`\`\n${VET_OUTPUT:0:500}\n\`\`\`\n\n"
        fi
      fi
    fi

    # Check with golangci-lint if available
    if command -v golangci-lint &>/dev/null; then
      LINT_OUTPUT=$(golangci-lint run --out-format=line-number 2>&1 || true)
      if [[ -n "$LINT_OUTPUT" ]]; then
        ISSUE_COUNT=$(echo "$LINT_OUTPUT" | grep -cE '^.*\.go:[0-9]+' || echo "0")
        if [[ "$ISSUE_COUNT" -gt 0 ]]; then
          ISSUES="${ISSUES}### GolangCI-Lint ($ISSUE_COUNT issues)\n\`\`\`\n${LINT_OUTPUT:0:500}\n\`\`\`\n\n"
        fi
      fi
    fi
  fi
fi

# ===== Shell Script Detection =====
SHELL_FILES=$(echo "$STAGED_FILES" | grep -E '\.(sh|bash)$' || true)
if [[ -n "$SHELL_FILES" ]]; then
  CHECKS_RUN="${CHECKS_RUN}Shell, "

  # Check with shellcheck if available
  if command -v shellcheck &>/dev/null; then
    SHELLCHECK_OUTPUT=$(shellcheck --format=gcc $SHELL_FILES 2>&1 || true)
    if [[ -n "$SHELLCHECK_OUTPUT" ]]; then
      ISSUE_COUNT=$(echo "$SHELLCHECK_OUTPUT" | grep -cE ':[0-9]+:[0-9]+:' || echo "0")
      if [[ "$ISSUE_COUNT" -gt 0 ]]; then
        ISSUES="${ISSUES}### ShellCheck ($ISSUE_COUNT issues)\n\`\`\`\n${SHELLCHECK_OUTPUT:0:500}\n\`\`\`\n\n"
      fi
    fi
  fi
fi

# Remove trailing comma from CHECKS_RUN
CHECKS_RUN="${CHECKS_RUN%, }"

# If no relevant files or no checks, allow silently
if [[ -z "$CHECKS_RUN" ]]; then
  output_silent_success
  exit 0
fi

# Build context message
if [[ -z "$ISSUES" ]]; then
  # All checks passed
  CONTEXT="## Pre-commit Checks Passed

**Checks run**: $CHECKS_RUN

All linting and type checks passed for staged files."

  log_permission_feedback "allow" "Pre-commit simulation passed ($CHECKS_RUN)"
  output_allow_with_context "$CONTEXT"
  exit 0
fi

# Issues found - WARN (don't block, but inform)
CONTEXT="## Pre-commit Issues Detected

**Checks run**: $CHECKS_RUN

The following issues were found in staged files. Consider fixing before commit:

$(echo -e "$ISSUES")

---
**Note**: This is a warning, not a blocker. You may proceed with the commit, but fixing these issues is recommended."

log_permission_feedback "allow" "Pre-commit simulation found issues ($CHECKS_RUN)"
output_allow_with_context "$CONTEXT"
exit 0
