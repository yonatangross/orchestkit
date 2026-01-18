#!/bin/bash
# =============================================================================
# di-pattern-enforcer.sh
# BLOCKING: Enforce dependency injection patterns in FastAPI
# =============================================================================
set -euo pipefail

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Get inputs
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && { output_silent_success; exit 0; }
[[ -z "$CONTENT" ]] && { output_silent_success; exit 0; }

# Only validate Python files in routers/
[[ ! "$FILE_PATH" =~ /routers/.*\.py$ ]] && { output_silent_success; exit 0; }

# Skip deps.py and dependencies.py (these define the DI functions)
FILENAME=$(basename "$FILE_PATH")
if [[ "$FILENAME" =~ ^(deps|dependencies|__init__)\.py$ ]]; then
    output_silent_success
    exit 0
fi

ERRORS=()

# =============================================================================
# Rule: No direct service/repository instantiation
# =============================================================================

# Check for direct instantiation patterns: = SomeService()
if echo "$CONTENT" | grep -qE "=\s*[A-Z][a-zA-Z]*Service\s*\(\s*\)" 2>/dev/null; then
    MATCH=$(echo "$CONTENT" | grep -oE "[A-Z][a-zA-Z]*Service\s*\(\s*\)" | head -1)
    ERRORS+=("INSTANTIATION: Direct service instantiation not allowed")
    ERRORS+=("  Found: $MATCH")
    ERRORS+=("  ")
    ERRORS+=("  Use dependency injection:")
    ERRORS+=("    service: MyService = Depends(get_my_service)")
fi

if echo "$CONTENT" | grep -qE "=\s*[A-Z][a-zA-Z]*(Repository|Repo)\s*\(\s*\)" 2>/dev/null; then
    MATCH=$(echo "$CONTENT" | grep -oE "[A-Z][a-zA-Z]*(Repository|Repo)\s*\(\s*\)" | head -1)
    ERRORS+=("INSTANTIATION: Direct repository instantiation not allowed")
    ERRORS+=("  Found: $MATCH")
    ERRORS+=("  ")
    ERRORS+=("  Use dependency injection:")
    ERRORS+=("    repo: MyRepository = Depends(get_my_repository)")
fi

# =============================================================================
# Rule: No global service/repository instances
# =============================================================================

# Check for module-level instantiation (not inside a function)
# Pattern: starts at beginning of line (no indentation) and creates instance
if echo "$CONTENT" | grep -qE "^[a-z_]+\s*=\s*[A-Z][a-zA-Z]*(Service|Repository|Repo)\s*\(" 2>/dev/null; then
    MATCH=$(echo "$CONTENT" | grep -oE "^[a-z_]+\s*=\s*[A-Z][a-zA-Z]*(Service|Repository|Repo)" | head -1)
    ERRORS+=("GLOBAL: Global service/repository instance not allowed")
    ERRORS+=("  Found: $MATCH")
    ERRORS+=("  ")
    ERRORS+=("  Global instances cause:")
    ERRORS+=("    - Shared state between requests")
    ERRORS+=("    - Difficult testing")
    ERRORS+=("    - Connection pool issues")
    ERRORS+=("  ")
    ERRORS+=("  Use Depends() for request-scoped instances")
fi

# =============================================================================
# Rule: Database session must use Depends()
# =============================================================================

# Check for typed Session parameter without Depends
# Look for function params like: db: Session or db: AsyncSession without = Depends
FUNC_SIGNATURES=$(echo "$CONTENT" | grep -E "(async )?def [a-z_]+\s*\(" 2>/dev/null || true)

if [[ -n "$FUNC_SIGNATURES" ]]; then
    # Check if any function has Session type without Depends
    if echo "$CONTENT" | grep -qE ":\s*(Async)?Session[^=]*\)" 2>/dev/null; then
        # Verify it's not using Depends
        if ! echo "$CONTENT" | grep -qE ":\s*(Async)?Session\s*=\s*Depends" 2>/dev/null; then
            ERRORS+=("DI: Database session must use Depends()")
            ERRORS+=("  ")
            ERRORS+=("  BAD:  async def get_users(db: AsyncSession):")
            ERRORS+=("  GOOD: async def get_users(db: AsyncSession = Depends(get_db)):")
        fi
    fi
fi

# =============================================================================
# Rule: Route handlers should use Depends for typed dependencies
# =============================================================================

# Check for route decorators
if echo "$CONTENT" | grep -qE "@router\.(get|post|put|patch|delete)" 2>/dev/null; then

    # Check if any route function has typed Service/Repo params without Depends
    # This is a heuristic - looking for type annotations that should be injected

    # Pattern: param_name: SomeService (without = Depends)
    if echo "$CONTENT" | grep -qE ":\s*[A-Z][a-zA-Z]*(Service|Repository|Repo)[^=)]*\)" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE ":\s*[A-Z][a-zA-Z]*(Service|Repository|Repo)\s*=\s*Depends" 2>/dev/null; then
            ERRORS+=("DI: Service/Repository parameters must use Depends()")
            ERRORS+=("  ")
            ERRORS+=("  BAD:  async def create_user(user_service: UserService):")
            ERRORS+=("  GOOD: async def create_user(user_service: UserService = Depends(get_user_service)):")
        fi
    fi
fi

# =============================================================================
# Rule: No sync DB calls in async functions
# =============================================================================

# Check if file has async functions
if echo "$CONTENT" | grep -qE "async def" 2>/dev/null; then

    # Look for sync session methods (query, add, commit without await)
    # These would block the event loop

    # Check for db.query() - sync SQLAlchemy 1.x pattern
    if echo "$CONTENT" | grep -qE "db\.query\(" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "await.*db\.query\(" 2>/dev/null; then
            ERRORS+=("ASYNC: Sync database call in async function")
            ERRORS+=("  Found: db.query() (sync pattern)")
            ERRORS+=("  ")
            ERRORS+=("  Use async SQLAlchemy 2.0 patterns:")
            ERRORS+=("    result = await db.execute(select(User))")
            ERRORS+=("    users = result.scalars().all()")
        fi
    fi

    # Check for session methods that should be awaited
    SYNC_PATTERNS="db\.(add|delete|commit|flush|rollback|refresh)\("

    if echo "$CONTENT" | grep -qE "$SYNC_PATTERNS" 2>/dev/null; then
        # In async context, these need await (AsyncSession)
        # Check if we're using AsyncSession
        if echo "$CONTENT" | grep -qE "AsyncSession" 2>/dev/null; then
            # Verify await is used
            if echo "$CONTENT" | grep -vE "await" | grep -qE "$SYNC_PATTERNS" 2>/dev/null; then
                ERRORS+=("ASYNC: Missing await for async database operation")
                ERRORS+=("  ")
                ERRORS+=("  With AsyncSession, use await:")
                ERRORS+=("    await db.commit()")
                ERRORS+=("    await db.refresh(user)")
            fi
        fi
    fi
fi

# =============================================================================
# Report errors and block
# =============================================================================
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Dependency injection violation" >&2
    echo "" >&2
    echo "File: $FILE_PATH" >&2
    echo "" >&2
    echo "=== Correct Pattern ===" >&2
    echo "" >&2
    echo "  # In deps.py" >&2
    echo "  def get_user_service(" >&2
    echo "      repo: UserRepository = Depends(get_user_repository)" >&2
    echo "  ) -> UserService:" >&2
    echo "      return UserService(repo)" >&2
    echo "" >&2
    echo "  # In router" >&2
    echo "  @router.post('/users')" >&2
    echo "  async def create_user(" >&2
    echo "      data: UserCreate," >&2
    echo "      service: UserService = Depends(get_user_service)" >&2
    echo "  ):" >&2
    echo "      return await service.create(data)" >&2
    echo "" >&2
    echo "Violations:" >&2
    for error in "${ERRORS[@]}"; do
        echo "  $error" >&2
    done
    echo "" >&2
    echo "Reference: skills/backend-architecture-enforcer/SKILL.md" >&2

    # Output proper CC 2.1.7 JSON with context
    CTX="Dependency injection violation in $FILE_PATH. See stderr for details."
    output_with_context "$CTX"
    exit 1
fi

# Success - output proper CC 2.1.7 JSON
output_silent_success
exit 0