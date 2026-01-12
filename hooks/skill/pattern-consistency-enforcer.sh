#!/bin/bash
# =============================================================================
# pattern-consistency-enforcer.sh
# BLOCKING: Enforce consistent patterns across all instances
# =============================================================================
set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Get inputs
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

# Load established patterns
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "${CLAUDE_PROJECT_DIR:-.}")
PATTERNS_FILE="$PROJECT_ROOT/.claude/context/knowledge/patterns/established.json"

if [[ ! -f "$PATTERNS_FILE" ]]; then
    # No patterns file, skip validation
    exit 0
fi

ERRORS=()
WARNINGS=()

# =============================================================================
# 1. BACKEND PATTERN CONSISTENCY
# =============================================================================

if [[ "$FILE_PATH" =~ \.py$ ]] && [[ "$FILE_PATH" =~ /backend/ || "$FILE_PATH" =~ /api/ ]]; then
    
    # Check: Clean Architecture layers
    if [[ "$FILE_PATH" =~ /routers/ ]]; then
        # Routers should call services, not repositories
        if echo "$CONTENT" | grep -qE "from.*repositories.*import" 2>/dev/null; then
            ERRORS+=("PATTERN: Router imports repository directly")
            ERRORS+=("  Established pattern: routers -> services -> repositories")
            ERRORS+=("  Import from services/ layer instead")
        fi
    fi
    
    if [[ "$FILE_PATH" =~ /services/ ]]; then
        # Services should not import routers
        if echo "$CONTENT" | grep -qE "from.*routers.*import" 2>/dev/null; then
            ERRORS+=("PATTERN: Service imports router (circular dependency)")
            ERRORS+=("  Established pattern: Services are independent of HTTP layer")
        fi
    fi
    
    # Check: Async SQLAlchemy pattern
    if echo "$CONTENT" | grep -qE "from sqlalchemy import" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "from sqlalchemy.ext.asyncio import" 2>/dev/null; then
            if echo "$CONTENT" | grep -qE "Session|sessionmaker" 2>/dev/null; then
                ERRORS+=("PATTERN: Using sync SQLAlchemy instead of async")
                ERRORS+=("  Established pattern: All DB operations use async/await")
                ERRORS+=("  Import: from sqlalchemy.ext.asyncio import AsyncSession")
            fi
        fi
    fi
    
    # Check: Pydantic v2 validators
    if echo "$CONTENT" | grep -qE "from pydantic import.*BaseModel" 2>/dev/null; then
        # Check for old v1 validator patterns
        if echo "$CONTENT" | grep -qE "@validator\(" 2>/dev/null; then
            ERRORS+=("PATTERN: Using Pydantic v1 @validator decorator")
            ERRORS+=("  Established pattern: Pydantic v2 with @field_validator")
            ERRORS+=("  Update: @field_validator('field_name', mode='after')")
        fi
        
        if echo "$CONTENT" | grep -qE "@root_validator" 2>/dev/null; then
            ERRORS+=("PATTERN: Using Pydantic v1 @root_validator decorator")
            ERRORS+=("  Established pattern: Pydantic v2 with @model_validator")
            ERRORS+=("  Update: @model_validator(mode='after')")
        fi
    fi
    
    # Check: Tenant isolation in queries
    if echo "$CONTENT" | grep -qE "def.*\(.*session.*\)" 2>/dev/null; then
        if echo "$CONTENT" | grep -qE "select\(|query\(" 2>/dev/null; then
            # Check if tenant_id filter is present
            if ! echo "$CONTENT" | grep -qE "tenant_id\s*==|filter.*tenant" 2>/dev/null; then
                WARNINGS+=("PATTERN: Query without tenant_id filter")
                WARNINGS+=("  Established pattern: All queries must filter by tenant_id")
                WARNINGS+=("  Add: .where(Model.tenant_id == tenant_id)")
            fi
        fi
    fi
fi

# =============================================================================
# 2. FRONTEND PATTERN CONSISTENCY
# =============================================================================

if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]] && [[ "$FILE_PATH" =~ /frontend/ || "$FILE_PATH" =~ /src/ ]]; then
    
    # Check: React 19 function components (not React.FC)
    if echo "$CONTENT" | grep -qE "React\.FC<" 2>/dev/null; then
        ERRORS+=("PATTERN: Using React.FC instead of explicit Props type")
        ERRORS+=("  Established pattern: function Component(props: Props): React.ReactNode")
        ERRORS+=("  Remove React.FC, use explicit function declaration")
    fi
    
    # Check: Zod validation for API responses
    if echo "$CONTENT" | grep -qE "fetch\(|axios\." 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "from 'zod'|from \"zod\"" 2>/dev/null; then
            ERRORS+=("PATTERN: API call without Zod validation")
            ERRORS+=("  Established pattern: All API responses validated with Zod")
            ERRORS+=("  Import: import { z } from 'zod'")
            ERRORS+=("  Validate: const data = ResponseSchema.parse(await response.json())")
        fi
    fi
    
    # Check: React 19 APIs for forms
    if echo "$CONTENT" | grep -qE "<form" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "useFormStatus|useActionState|useOptimistic" 2>/dev/null; then
            WARNINGS+=("PATTERN: Form without React 19 form hooks")
            WARNINGS+=("  Established pattern: Use useFormStatus for pending state")
            WARNINGS+=("  Consider: useOptimistic for optimistic updates")
        fi
    fi
    
    # Check: Exhaustive type checking
    if echo "$CONTENT" | grep -qE "switch\s*\(" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "assertNever|exhaustiveCheck" 2>/dev/null; then
            WARNINGS+=("PATTERN: Switch without exhaustive checking")
            WARNINGS+=("  Established pattern: Use assertNever in default case")
            WARNINGS+=("  Add: default: return assertNever(value)")
        fi
    fi
    
    # Check: Date formatting pattern
    if echo "$CONTENT" | grep -qE "new Date.*toLocaleDateString|toLocaleString" 2>/dev/null; then
        ERRORS+=("PATTERN: Direct date formatting instead of centralized utility")
        ERRORS+=("  Established pattern: Use @/lib/dates helpers")
        ERRORS+=("  Import: import { formatDate, formatDateShort } from '@/lib/dates'")
    fi
    
    # Check: Skeleton loading states (not spinners)
    if echo "$CONTENT" | grep -qiE "Spinner|Loading\.\.\.|isLoading &&" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "Skeleton|animate-pulse" 2>/dev/null; then
            WARNINGS+=("PATTERN: Using spinner instead of skeleton loading")
            WARNINGS+=("  Established pattern: Skeleton components for content loading")
            WARNINGS+=("  Use: <CardSkeleton /> with animate-pulse")
        fi
    fi
    
    # Check: Feature-based structure (not type-based)
    if [[ "$FILE_PATH" =~ /components/buttons/ || "$FILE_PATH" =~ /components/forms/ ]]; then
        if [[ ! "$FILE_PATH" =~ /shared/ && ! "$FILE_PATH" =~ /ui/ ]]; then
            WARNINGS+=("PATTERN: Type-based folder structure detected")
            WARNINGS+=("  Established pattern: Feature-based structure")
            WARNINGS+=("  Move to: src/features/{feature-name}/components/")
            WARNINGS+=("  Unless: This is a shared UI component")
        fi
    fi
fi

# =============================================================================
# 3. TESTING PATTERN CONSISTENCY
# =============================================================================

if [[ "$FILE_PATH" =~ \.(test|spec)\.(ts|tsx|js|jsx)$ ]] || [[ "$FILE_PATH" =~ test_.*\.py$ ]]; then
    
    # Check: AAA pattern presence
    if ! echo "$CONTENT" | grep -qiE "// Arrange|// Act|// Assert|# Arrange|# Act|# Assert" 2>/dev/null; then
        WARNINGS+=("PATTERN: AAA pattern comments missing")
        WARNINGS+=("  Established pattern: Structure tests with Arrange-Act-Assert")
        WARNINGS+=("  Add comments for clarity in complex tests")
    fi
    
    # Check: MSW for API mocking (TypeScript)
    if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
        if echo "$CONTENT" | grep -qE "jest\.mock.*fetch|global\.fetch" 2>/dev/null; then
            ERRORS+=("PATTERN: Using jest.mock for fetch instead of MSW")
            ERRORS+=("  Established pattern: Use MSW for API mocking")
            ERRORS+=("  Import: import { http, HttpResponse } from 'msw'")
        fi
    fi
    
    # Check: Pytest fixtures (Python)
    if [[ "$FILE_PATH" =~ \.py$ ]]; then
        if echo "$CONTENT" | grep -qE "class Test.*setUp" 2>/dev/null; then
            ERRORS+=("PATTERN: Using unittest setUp instead of pytest fixtures")
            ERRORS+=("  Established pattern: Use pytest fixtures")
            ERRORS+=("  Convert: @pytest.fixture\\ndef setup_data():")
        fi
    fi
fi

# =============================================================================
# 4. AI INTEGRATION PATTERN CONSISTENCY
# =============================================================================

if [[ "$FILE_PATH" =~ /llm/ || "$FILE_PATH" =~ /ai/ || "$FILE_PATH" =~ /agent/ ]]; then
    
    # Check: IDs flow around LLM
    if echo "$CONTENT" | grep -qE "prompt.*\{.*id.*\}|f\".*\{.*\.id\}.*\"" 2>/dev/null; then
        ERRORS+=("PATTERN: Database IDs in LLM prompts")
        ERRORS+=("  Established pattern: IDs flow around LLM, not through it")
        ERRORS+=("  Pass IDs via metadata, join results after LLM processing")
    fi
    
    # Check: Provider factory pattern
    if echo "$CONTENT" | grep -qE "import.*openai|from openai" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "get_llm_provider|get_embedding_provider" 2>/dev/null; then
            WARNINGS+=("PATTERN: Direct OpenAI import instead of provider factory")
            WARNINGS+=("  Established pattern: Use get_llm_provider() for Ollama/OpenAI switching")
            WARNINGS+=("  Import: from core.providers import get_llm_provider")
        fi
    fi
    
    # Check: Async timeout protection
    if echo "$CONTENT" | grep -qE "await.*openai|await.*anthropic|await.*llm" 2>/dev/null; then
        if ! echo "$CONTENT" | grep -qE "asyncio\.timeout|asyncio\.wait_for|Promise\.race" 2>/dev/null; then
            ERRORS+=("PATTERN: LLM call without timeout protection")
            ERRORS+=("  Established pattern: Wrap all LLM calls with timeout")
            ERRORS+=("  Python: async with asyncio.timeout(30):")
            ERRORS+=("  TypeScript: await Promise.race([call, timeout])")
        fi
    fi
fi

# =============================================================================
# 5. CROSS-INSTANCE PATTERN REGISTRY CHECK
# =============================================================================

# Check for pattern violations that might exist in other worktrees
if git worktree list >/dev/null 2>&1; then
    WORKTREES=$(git worktree list --porcelain 2>/dev/null | grep "^worktree " | awk '{print $2}' || true)
    
    if [[ -n "$WORKTREES" ]]; then
        # Get this file's layer (router/service/repository/component)
        FILE_LAYER="unknown"
        
        if [[ "$FILE_PATH" =~ /routers/ ]]; then FILE_LAYER="router"
        elif [[ "$FILE_PATH" =~ /services/ ]]; then FILE_LAYER="service"
        elif [[ "$FILE_PATH" =~ /repositories/ ]]; then FILE_LAYER="repository"
        elif [[ "$FILE_PATH" =~ /components/ ]]; then FILE_LAYER="component"
        elif [[ "$FILE_PATH" =~ /hooks/ ]]; then FILE_LAYER="hook"
        fi
        
        # Check if other worktrees have similar files using different patterns
        REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
        if [[ -n "$REPO_ROOT" && "$FILE_LAYER" != "unknown" ]]; then
            # This is a complex check - just warn about potential conflicts
            WARNINGS+=("MULTI-INSTANCE: Other worktrees may have similar $FILE_LAYER files")
            WARNINGS+=("  Review patterns in other branches before merging")
        fi
    fi
fi

# =============================================================================
# 6. REPORT FINDINGS
# =============================================================================

# Block on critical pattern violations
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "❌ BLOCKED: Pattern consistency violations detected" >&2
    echo "" >&2
    echo "File: $FILE_PATH" >&2
    echo "" >&2
    echo "Critical Pattern Violations:" >&2
    for error in "${ERRORS[@]}"; do
        echo "  $error" >&2
    done
    echo "" >&2
    echo "Reference: .claude/context/knowledge/patterns/established.json" >&2
    echo "Fix violations to match established patterns before committing" >&2
    exit 1
fi

# Warn about pattern drift
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo "⚠️  WARNING: Pattern consistency issues detected" >&2
    echo "" >&2
    echo "File: $FILE_PATH" >&2
    echo "" >&2
    for warning in "${WARNINGS[@]}"; do
        echo "  $warning" >&2
    done
    echo "" >&2
    echo "Review warnings to ensure consistency across codebase" >&2
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Patterns enforced","continue":true}'
exit 0
