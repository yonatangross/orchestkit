#!/bin/bash
set -euo pipefail

# CC 2.1.6 Nested Skills Migration Script
# Reorganizes 91 flat skills into 10 category-based nested structures
# Pattern: skills/<category>/.claude/skills/<skill-name>/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/skills"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Tracking
MOVED_COUNT=0
FAILED_COUNT=0
SKIPPED_COUNT=0

create_category_structure() {
  local category="$1"
  local target_dir="$SKILLS_DIR/$category/.claude/skills"

  if [[ ! -d "$target_dir" ]]; then
    mkdir -p "$target_dir"
    log_info "Created category: $category/.claude/skills/"
  fi
}

move_skill() {
  local skill="$1"
  local category="$2"
  local source="$SKILLS_DIR/$skill"
  local target="$SKILLS_DIR/$category/.claude/skills/$skill"

  # Skip if source doesn't exist
  if [[ ! -d "$source" ]]; then
    log_warning "Skill not found: $skill (skipping)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    return 0
  fi

  # Skip if already moved
  if [[ -d "$target" ]]; then
    log_warning "Skill already exists at target: $skill (skipping)"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    return 0
  fi

  # Move the skill directory
  mv "$source" "$target"

  if [[ $? -eq 0 ]]; then
    log_success "Moved: $skill -> $category/.claude/skills/$skill"
    MOVED_COUNT=$((MOVED_COUNT + 1))
  else
    log_error "Failed to move: $skill"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    return 1
  fi
}

move_category_skills() {
  local category="$1"
  shift
  local skills="$@"

  log_info "Processing category: $category"
  create_category_structure "$category"

  for skill in $skills; do
    if [[ -n "$skill" ]]; then
      move_skill "$skill" "$category"
    fi
  done
  echo ""
}

update_schema_paths() {
  log_info "Updating \$schema paths in capabilities.json files..."

  # Find all capabilities.json files in new locations and update schema paths
  find "$SKILLS_DIR" -path "*/.claude/skills/*/capabilities.json" -type f -print0 | while IFS= read -r -d '' file; do
    if grep -q '"\$schema"' "$file" 2>/dev/null; then
      # macOS compatible sed (use '' for in-place without backup on macOS)
      if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' 's|"\.\./\.\./\.claude/schemas/|"../../../../../.claude/schemas/|g' "$file" 2>/dev/null || true
        sed -i '' 's|"\.\./\.\./schemas/|"../../../../../.claude/schemas/|g' "$file" 2>/dev/null || true
      else
        sed -i 's|"\.\./\.\./\.claude/schemas/|"../../../../../.claude/schemas/|g' "$file" 2>/dev/null || true
        sed -i 's|"\.\./\.\./schemas/|"../../../../../.claude/schemas/|g' "$file" 2>/dev/null || true
      fi
    fi
  done

  log_success "Schema paths updated"
}

print_summary() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "                    MIGRATION SUMMARY"
  echo "═══════════════════════════════════════════════════════════════"
  echo -e "  ${GREEN}Moved:${NC}   $MOVED_COUNT skills"
  echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED_COUNT skills"
  echo -e "  ${RED}Failed:${NC}  $FAILED_COUNT skills"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Category structure:"
  for category in ai-llm langgraph backend frontend testing security devops workflows quality context; do
    local count=$(ls -1 "$SKILLS_DIR/$category/.claude/skills/" 2>/dev/null | wc -l | tr -d ' ')
    echo "  $category: $count skills"
  done
  echo ""
}

verify_migration() {
  log_info "Verifying migration..."

  local total_skills=$(find "$SKILLS_DIR" -name "capabilities.json" -type f | wc -l | tr -d ' ')
  local categories=$(ls -1d "$SKILLS_DIR"/*/.claude/skills 2>/dev/null | wc -l | tr -d ' ')

  echo ""
  echo "Verification:"
  echo "  Total skills found: $total_skills"
  echo "  Categories created: $categories"

  if [[ "$total_skills" -ge 85 ]] && [[ "$categories" -eq 10 ]]; then
    log_success "Migration verified successfully!"
    return 0
  else
    log_warning "Migration may be incomplete. Please check manually."
    return 1
  fi
}

# Main execution
main() {
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║     CC 2.1.6 Nested Skills Migration                         ║"
  echo "║     Reorganizing skills into category-based structure        ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  echo ""

  # Check if already migrated
  if [[ -d "$SKILLS_DIR/ai-llm/.claude/skills" ]] && [[ -d "$SKILLS_DIR/backend/.claude/skills" ]]; then
    log_warning "Migration appears to have already been run."
    log_info "If you want to re-run, please restore skills/ to flat structure first."
    exit 0
  fi

  log_info "Starting migration from: $SKILLS_DIR"
  echo ""

  # AI/LLM category (19 skills)
  move_category_skills "ai-llm" \
    rag-retrieval embeddings function-calling agent-loops multi-agent-orchestration \
    ollama-local llm-streaming llm-evaluation llm-testing llm-safety-patterns \
    prompt-caching semantic-caching cache-cost-tracking langfuse-observability \
    hyde-retrieval query-decomposition reranking-patterns contextual-retrieval mem0-memory

  # LangGraph category (7 skills)
  move_category_skills "langgraph" \
    langgraph-state langgraph-routing langgraph-parallel langgraph-checkpoints \
    langgraph-human-in-loop langgraph-supervisor langgraph-functional

  # Backend category (15 skills)
  move_category_skills "backend" \
    api-design-framework api-versioning fastapi-advanced clean-architecture \
    backend-architecture-enforcer database-schema-designer background-jobs \
    caching-strategies rate-limiting error-handling-rfc9457 resilience-patterns \
    streaming-api-patterns type-safety-validation pgvector-search mcp-server-building

  # Frontend category (6 skills)
  move_category_skills "frontend" \
    react-server-components-framework design-system-starter motion-animation-patterns \
    i18n-date-patterns performance-optimization edge-computing-patterns

  # Testing category (9 skills)
  move_category_skills "testing" \
    unit-testing integration-testing e2e-testing webapp-testing performance-testing \
    msw-mocking vcr-http-recording test-data-management test-standards-enforcer

  # Security category (5 skills)
  move_category_skills "security" \
    owasp-top-10 security-scanning auth-patterns input-validation defense-in-depth

  # DevOps category (4 skills)
  move_category_skills "devops" \
    observability-monitoring devops-deployment github-cli run-tests

  # Workflows category (12 skills)
  move_category_skills "workflows" \
    commit create-pr review-pr implement explore verify fix-issue configure \
    doctor errors add-golden browser-content-capture

  # Quality category (8 skills)
  move_category_skills "quality" \
    quality-gates evidence-verification code-review-playbook project-structure-enforcer \
    golden-dataset-management golden-dataset-validation golden-dataset-curation \
    architecture-decision-record

  # Context category (6 skills)
  move_category_skills "context" \
    context-compression context-engineering brainstorming ascii-visualizer \
    system-design-interrogation worktree-coordination

  # Update schema paths
  update_schema_paths

  # Print summary
  print_summary

  # Verify
  verify_migration

  echo ""
  log_info "Next steps:"
  echo "  1. Update plugin.json with new skill paths"
  echo "  2. Update CLAUDE.md documentation"
  echo "  3. Run: ./tests/skills/structure/test-capabilities-json.sh"
  echo ""
}

# Run main function
main "$@"