#!/bin/bash
# =============================================================================
# structure-location-validator.sh
# BLOCKING: Files must be in correct architectural locations
# =============================================================================
set -euo pipefail

# Get file path from tool input
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

ERRORS=()

# =============================================================================
# Rule: Max nesting depth (4 levels from src/ or app/)
# =============================================================================
MAX_DEPTH=4

if [[ "$FILE_PATH" =~ (src/|app/) ]]; then
    # Extract path after src/ or app/
    if [[ "$FILE_PATH" =~ src/ ]]; then
        RELATIVE_PATH="${FILE_PATH#*src/}"
    else
        RELATIVE_PATH="${FILE_PATH#*app/}"
    fi

    # Count directory levels
    DEPTH=$(echo "$RELATIVE_PATH" | tr '/' '\n' | grep -c . 2>/dev/null || echo "0")

    if [[ $DEPTH -gt $MAX_DEPTH ]]; then
        ERRORS+=("NESTING: Max depth exceeded - $DEPTH levels (max: $MAX_DEPTH)")
        ERRORS+=("  File: $FILE_PATH")
        ERRORS+=("  ")
        ERRORS+=("  Suggestion: Flatten the directory structure")
        ERRORS+=("  Deep nesting makes code harder to navigate and import")
    fi
fi

# =============================================================================
# Rule: No barrel files (index.ts that only re-export)
# =============================================================================
FILENAME=$(basename "$FILE_PATH")

if [[ "$FILENAME" == "index.ts" ]] || [[ "$FILENAME" == "index.tsx" ]] || [[ "$FILENAME" == "index.js" ]]; then
    # Allow in app/ directory (Next.js pages) and certain utility folders
    if [[ ! "$FILE_PATH" =~ /app/ ]] && [[ ! "$FILE_PATH" =~ /(node_modules|dist|build)/ ]]; then
        ERRORS+=("BARREL: Barrel files (index.ts) are discouraged")
        ERRORS+=("  File: $FILE_PATH")
        ERRORS+=("  ")
        ERRORS+=("  Why? Barrel files cause issues:")
        ERRORS+=("    - Break tree-shaking (entire module imported)")
        ERRORS+=("    - Create circular dependency risks")
        ERRORS+=("    - Slow down build times")
        ERRORS+=("  ")
        ERRORS+=("  Instead: Import directly from source files")
        ERRORS+=("    BAD:  import { Button } from '@/components'")
        ERRORS+=("    GOOD: import { Button } from '@/components/Button'")
    fi
fi

# =============================================================================
# React/TypeScript Structure Rules
# =============================================================================
if [[ "$FILE_PATH" =~ \.(tsx|ts|jsx|js)$ ]]; then

    # -------------------------------------------------------------------------
    # Rule: React components (PascalCase) must be in components/ or features/
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ ^[A-Z][a-zA-Z0-9]*\.(tsx|jsx)$ ]]; then
        # Skip if already in allowed directories
        if [[ ! "$FILE_PATH" =~ (components/|features/|app/|pages/) ]]; then
            ERRORS+=("COMPONENT: React components must be in components/, features/, or app/")
            ERRORS+=("  File: $FILE_PATH")
            ERRORS+=("  ")
            ERRORS+=("  Move to one of:")
            ERRORS+=("    - src/components/$FILENAME")
            ERRORS+=("    - src/features/<feature>/components/$FILENAME")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: Custom hooks (useX) must be in hooks/ directory
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ ^use[A-Z][a-zA-Z0-9]*\.(ts|tsx)$ ]]; then
        if [[ ! "$FILE_PATH" =~ (hooks/|/hooks/) ]]; then
            ERRORS+=("HOOK: Custom hooks must be in hooks/ directory")
            ERRORS+=("  File: $FILE_PATH")
            ERRORS+=("  ")
            ERRORS+=("  Move to one of:")
            ERRORS+=("    - src/hooks/$FILENAME")
            ERRORS+=("    - src/features/<feature>/hooks/$FILENAME")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: Services must be in services/ directory
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ (Service|Client|Api)\.(ts|js)$ ]]; then
        if [[ ! "$FILE_PATH" =~ (services/|/services/|lib/) ]]; then
            ERRORS+=("SERVICE: Service/API client files should be in services/ or lib/")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: Types should be in types/ or colocated with feature
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ ^types\.(ts|d\.ts)$ ]] || [[ "$FILENAME" =~ \.types\.ts$ ]]; then
        if [[ ! "$FILE_PATH" =~ (types/|/types/|features/) ]]; then
            ERRORS+=("TYPES: Type definitions should be in types/ or colocated with feature")
            ERRORS+=("  File: $FILE_PATH")
        fi
    fi
fi

# =============================================================================
# FastAPI/Python Structure Rules
# =============================================================================
if [[ "$FILE_PATH" =~ \.py$ ]]; then
    DIRNAME=$(dirname "$FILE_PATH")

    # -------------------------------------------------------------------------
    # Rule: Router files must be in routers/
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ ^(router_|routes_|api_).*\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ routers$ ]] && [[ ! "$DIRNAME" =~ /routers$ ]]; then
            ERRORS+=("ROUTER: Router files must be in routers/ directory")
            ERRORS+=("  File: $FILE_PATH")
            ERRORS+=("  Move to: app/routers/$FILENAME")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: Service files must be in services/
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ _service\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ services$ ]] && [[ ! "$DIRNAME" =~ /services$ ]]; then
            ERRORS+=("SERVICE: Service files must be in services/ directory")
            ERRORS+=("  File: $FILE_PATH")
            ERRORS+=("  Move to: app/services/$FILENAME")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: Repository files must be in repositories/
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ _(repository|repo)\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ repositories$ ]] && [[ ! "$DIRNAME" =~ /repositories$ ]]; then
            ERRORS+=("REPOSITORY: Repository files must be in repositories/ directory")
            ERRORS+=("  File: $FILE_PATH")
            ERRORS+=("  Move to: app/repositories/$FILENAME")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: Schema files must be in schemas/
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ _(schema|dto)\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ schemas$ ]] && [[ ! "$DIRNAME" =~ /schemas$ ]]; then
            ERRORS+=("SCHEMA: Schema/DTO files must be in schemas/ directory")
            ERRORS+=("  File: $FILE_PATH")
            ERRORS+=("  Move to: app/schemas/$FILENAME")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: SQLAlchemy models must be in models/
    # -------------------------------------------------------------------------
    if [[ "$FILENAME" =~ _(model|entity|orm)\.py$ ]]; then
        if [[ ! "$DIRNAME" =~ models$ ]] && [[ ! "$DIRNAME" =~ /models$ ]]; then
            ERRORS+=("MODEL: Database model files must be in models/ directory")
            ERRORS+=("  File: $FILE_PATH")
            ERRORS+=("  Move to: app/models/$FILENAME")
        fi
    fi
fi

# =============================================================================
# Report errors and block
# =============================================================================
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

# Output systemMessage for user visibility
echo '{"systemMessage":"Structure validated","continue":true}'
exit 0
