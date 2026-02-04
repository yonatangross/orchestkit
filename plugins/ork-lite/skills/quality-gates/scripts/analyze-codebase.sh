#!/bin/bash
# Codebase Complexity Analyzer
# Analyzes codebase metrics for complexity assessment
# Usage: ./analyze-codebase.sh [path] [--json]

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

TARGET="${1:-.}"
OUTPUT_FORMAT="${2:-text}"  # text or --json

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

count_files() {
  local path="$1"
  local extensions=("py" "ts" "tsx" "js" "jsx" "go" "rs" "java" "rb")
  local total=0

  for ext in "${extensions[@]}"; do
    count=$(find "$path" -type f -name "*.$ext" 2>/dev/null | wc -l | tr -d ' ')
    total=$((total + count))
  done

  echo "$total"
}

count_loc() {
  local path="$1"
  local total=0

  # Count lines for common languages
  if command -v wc >/dev/null; then
    total=$(find "$path" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
  fi

  echo "${total:-0}"
}

count_test_files() {
  local path="$1"
  find "$path" -type f \( -name "*test*.py" -o -name "*test*.ts" -o -name "*.spec.*" -o -name "*_test.go" \) 2>/dev/null | wc -l | tr -d ' '
}

count_dependencies() {
  local path="$1"
  local deps=0

  # Python: pyproject.toml or requirements.txt
  if [[ -f "$path/pyproject.toml" ]]; then
    deps=$(grep -c "^[a-zA-Z]" "$path/pyproject.toml" 2>/dev/null | head -1 || echo "0")
  elif [[ -f "$path/requirements.txt" ]]; then
    deps=$(grep -cv "^#\|^$" "$path/requirements.txt" 2>/dev/null || echo "0")
  fi

  # Node: package.json
  if [[ -f "$path/package.json" ]]; then
    node_deps=$(grep -c "\":" "$path/package.json" 2>/dev/null || echo "0")
    deps=$((deps + node_deps / 2))  # Rough estimate
  fi

  echo "$deps"
}

get_git_stats() {
  local path="$1"

  if ! git -C "$path" rev-parse --git-dir >/dev/null 2>&1; then
    echo "0 0 0"
    return
  fi

  local commits_week=$(git -C "$path" log --oneline --since="1 week ago" 2>/dev/null | wc -l | tr -d ' ' || echo "0")
  local contributors=$(git -C "$path" log --format='%ae' --since="1 month ago" 2>/dev/null | sort -u | wc -l | tr -d ' ' || echo "0")
  local branches=$(git -C "$path" branch -r 2>/dev/null | wc -l | tr -d ' ' || echo "0")

  echo "$commits_week $contributors $branches"
}

detect_frameworks() {
  local path="$1"
  local frameworks=()

  # Python frameworks
  [[ -f "$path/pyproject.toml" ]] && grep -q "fastapi" "$path/pyproject.toml" 2>/dev/null && frameworks+=("FastAPI")
  [[ -f "$path/pyproject.toml" ]] && grep -q "django" "$path/pyproject.toml" 2>/dev/null && frameworks+=("Django")
  [[ -f "$path/pyproject.toml" ]] && grep -q "flask" "$path/pyproject.toml" 2>/dev/null && frameworks+=("Flask")
  [[ -f "$path/pyproject.toml" ]] && grep -q "sqlalchemy" "$path/pyproject.toml" 2>/dev/null && frameworks+=("SQLAlchemy")

  # JavaScript/TypeScript frameworks
  [[ -f "$path/package.json" ]] && grep -q "\"react\"" "$path/package.json" 2>/dev/null && frameworks+=("React")
  [[ -f "$path/package.json" ]] && grep -q "\"next\"" "$path/package.json" 2>/dev/null && frameworks+=("Next.js")
  [[ -f "$path/package.json" ]] && grep -q "\"vue\"" "$path/package.json" 2>/dev/null && frameworks+=("Vue")
  [[ -f "$path/package.json" ]] && grep -q "\"express\"" "$path/package.json" 2>/dev/null && frameworks+=("Express")

  # Database
  [[ -f "$path/docker-compose.yml" ]] && grep -q "postgres" "$path/docker-compose.yml" 2>/dev/null && frameworks+=("PostgreSQL")
  [[ -f "$path/docker-compose.yml" ]] && grep -q "redis" "$path/docker-compose.yml" 2>/dev/null && frameworks+=("Redis")

  echo "${frameworks[*]:-None detected}"
}

calculate_complexity_score() {
  local files="$1"
  local loc="$2"
  local test_files="$3"
  local deps="$4"

  local score=0

  # Files score (1-5)
  if [[ $files -lt 10 ]]; then score=$((score + 1))
  elif [[ $files -lt 50 ]]; then score=$((score + 2))
  elif [[ $files -lt 200 ]]; then score=$((score + 3))
  elif [[ $files -lt 500 ]]; then score=$((score + 4))
  else score=$((score + 5))
  fi

  # LOC score (1-5)
  if [[ $loc -lt 500 ]]; then score=$((score + 1))
  elif [[ $loc -lt 5000 ]]; then score=$((score + 2))
  elif [[ $loc -lt 20000 ]]; then score=$((score + 3))
  elif [[ $loc -lt 100000 ]]; then score=$((score + 4))
  else score=$((score + 5))
  fi

  # Dependencies score (1-5)
  if [[ $deps -lt 5 ]]; then score=$((score + 1))
  elif [[ $deps -lt 20 ]]; then score=$((score + 2))
  elif [[ $deps -lt 50 ]]; then score=$((score + 3))
  elif [[ $deps -lt 100 ]]; then score=$((score + 4))
  else score=$((score + 5))
  fi

  # Test coverage penalty/bonus
  if [[ $test_files -gt 0 ]]; then
    local test_ratio=$((test_files * 100 / (files + 1)))
    if [[ $test_ratio -gt 30 ]]; then
      score=$((score - 1))  # Good test coverage reduces complexity
    fi
  else
    score=$((score + 1))  # No tests increases complexity
  fi

  echo "$score"
}

# =============================================================================
# MAIN ANALYSIS
# =============================================================================

# Resolve path
if [[ ! -e "$TARGET" ]]; then
  echo "Error: Path '$TARGET' does not exist" >&2
  exit 1
fi

TARGET=$(cd "$TARGET" && pwd)

# Collect metrics
files=$(count_files "$TARGET")
loc=$(count_loc "$TARGET")
test_files=$(count_test_files "$TARGET")
deps=$(count_dependencies "$TARGET")
read -r commits_week contributors branches <<< "$(get_git_stats "$TARGET")"
frameworks=$(detect_frameworks "$TARGET")
complexity=$(calculate_complexity_score "$files" "$loc" "$test_files" "$deps")

# Determine complexity level
complexity_level="Unknown"
if [[ $complexity -lt 5 ]]; then complexity_level="Trivial"
elif [[ $complexity -lt 8 ]]; then complexity_level="Simple"
elif [[ $complexity -lt 12 ]]; then complexity_level="Moderate"
elif [[ $complexity -lt 16 ]]; then complexity_level="Complex"
else complexity_level="Very Complex"
fi

# =============================================================================
# OUTPUT
# =============================================================================

if [[ "$OUTPUT_FORMAT" == "--json" ]]; then
  cat << EOF
{
  "path": "$TARGET",
  "metrics": {
    "total_files": $files,
    "lines_of_code": $loc,
    "test_files": $test_files,
    "dependencies": $deps
  },
  "git": {
    "commits_this_week": $commits_week,
    "active_contributors": $contributors,
    "branches": $branches
  },
  "frameworks": "$frameworks",
  "complexity": {
    "score": $complexity,
    "level": "$complexity_level",
    "max_score": 20
  }
}
EOF
else
  cat << EOF
================================================================================
                         CODEBASE COMPLEXITY ANALYSIS
================================================================================

Target: $TARGET

METRICS
-------
Total Source Files:     $files
Lines of Code:          $loc
Test Files:             $test_files
Dependencies:           $deps

GIT ACTIVITY
------------
Commits (this week):    $commits_week
Active Contributors:    $contributors
Remote Branches:        $branches

DETECTED FRAMEWORKS
-------------------
$frameworks

COMPLEXITY ASSESSMENT
---------------------
Score:                  $complexity / 20
Level:                  $complexity_level

SCORING BREAKDOWN:
- Files (1-5):          $(if [[ $files -lt 10 ]]; then echo 1; elif [[ $files -lt 50 ]]; then echo 2; elif [[ $files -lt 200 ]]; then echo 3; elif [[ $files -lt 500 ]]; then echo 4; else echo 5; fi)
- LOC (1-5):            $(if [[ $loc -lt 500 ]]; then echo 1; elif [[ $loc -lt 5000 ]]; then echo 2; elif [[ $loc -lt 20000 ]]; then echo 3; elif [[ $loc -lt 100000 ]]; then echo 4; else echo 5; fi)
- Dependencies (1-5):   $(if [[ $deps -lt 5 ]]; then echo 1; elif [[ $deps -lt 20 ]]; then echo 2; elif [[ $deps -lt 50 ]]; then echo 3; elif [[ $deps -lt 100 ]]; then echo 4; else echo 5; fi)
- Test Coverage Adj:    $(if [[ $test_files -gt 0 ]]; then ratio=$((test_files * 100 / (files + 1))); if [[ $ratio -gt 30 ]]; then echo "-1 (good coverage)"; else echo "0"; fi; else echo "+1 (no tests)"; fi)

RECOMMENDATIONS
---------------
EOF

  if [[ $complexity -lt 8 ]]; then
    echo "- This codebase is relatively simple. Proceed with implementation."
  elif [[ $complexity -lt 12 ]]; then
    echo "- Moderate complexity. Consider breaking down into subtasks."
    echo "- Review existing patterns before making changes."
  else
    echo "- High complexity. Strongly recommend thorough planning."
    echo "- Break down into smaller, testable increments."
    echo "- Consider pair programming or code review checkpoints."
  fi

  if [[ $test_files -eq 0 ]]; then
    echo "- WARNING: No test files detected. Add tests before making changes."
  fi

  echo ""
  echo "================================================================================
"
fi
