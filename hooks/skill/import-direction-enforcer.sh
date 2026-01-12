#!/bin/bash
# =============================================================================
# import-direction-enforcer.sh
# BLOCKING: Imports must follow unidirectional architecture
# =============================================================================
set -euo pipefail

# Get inputs
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

ERRORS=()

# =============================================================================
# Determine current layer
# =============================================================================
LAYER=""

# TypeScript/JavaScript layers
if [[ "$FILE_PATH" =~ /shared/ ]]; then
    LAYER="shared"
elif [[ "$FILE_PATH" =~ /lib/ ]]; then
    LAYER="lib"
elif [[ "$FILE_PATH" =~ /utils/ ]]; then
    LAYER="utils"
elif [[ "$FILE_PATH" =~ /components/ ]] && [[ ! "$FILE_PATH" =~ /features/ ]]; then
    LAYER="components"
elif [[ "$FILE_PATH" =~ /hooks/ ]] && [[ ! "$FILE_PATH" =~ /features/ ]]; then
    LAYER="hooks"
elif [[ "$FILE_PATH" =~ /features/ ]]; then
    LAYER="features"
elif [[ "$FILE_PATH" =~ /app/ ]] || [[ "$FILE_PATH" =~ /pages/ ]]; then
    LAYER="app"
fi

# Python layers
if [[ "$FILE_PATH" =~ /repositories/ ]]; then
    LAYER="repositories"
elif [[ "$FILE_PATH" =~ /services/ ]] && [[ "$FILE_PATH" =~ \.py$ ]]; then
    LAYER="services"
elif [[ "$FILE_PATH" =~ /routers/ ]]; then
    LAYER="routers"
fi

# Skip if not in a recognized layer
[[ -z "$LAYER" ]] && exit 0

# =============================================================================
# TypeScript/JavaScript Import Rules
# =============================================================================
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then

    # Import direction: shared/lib/utils -> components/hooks -> features -> app
    #
    # BLOCKED:
    #   shared -> features, app
    #   lib -> features, app
    #   components -> features, app
    #   features -> app
    #   features -> other features (except type imports)

    case $LAYER in
        "shared"|"lib"|"utils")
            # Cannot import from features or app
            if echo "$CONTENT" | grep -qE "from ['\"](@/|\.\./)*(features|app)/" 2>/dev/null; then
                ERRORS+=("$LAYER/ cannot import from features/ or app/")
                ERRORS+=("  Import direction: $LAYER -> (nothing above)")
                ERRORS+=("  ")
                ERRORS+=("  $LAYER is a base layer - it should have no upward dependencies")
            fi
            ;;

        "components"|"hooks")
            # Cannot import from features or app
            if echo "$CONTENT" | grep -qE "from ['\"](@/|\.\./)*(features|app)/" 2>/dev/null; then
                ERRORS+=("$LAYER/ cannot import from features/ or app/")
                ERRORS+=("  Import direction: $LAYER -> shared, lib, utils")
                ERRORS+=("  ")
                ERRORS+=("  $LAYER should be feature-agnostic and reusable")
            fi
            ;;

        "features")
            # Cannot import from app
            if echo "$CONTENT" | grep -qE "from ['\"](@/|\.\./)*app/" 2>/dev/null; then
                ERRORS+=("features/ cannot import from app/")
                ERRORS+=("  Import direction: features -> shared, lib, components, hooks")
            fi

            # Cannot import from other features (except type imports)
            FEATURE_NAME=""
            if [[ "$FILE_PATH" =~ features/([^/]+)/ ]]; then
                FEATURE_NAME="${BASH_REMATCH[1]}"
            fi

            if [[ -n "$FEATURE_NAME" ]]; then
                # Check for cross-feature imports
                CROSS_FEATURE_IMPORTS=$(echo "$CONTENT" | grep -oE "from ['\"](@/|\.\./)*features/[^'\"]+['\"]" 2>/dev/null || true)

                if [[ -n "$CROSS_FEATURE_IMPORTS" ]]; then
                    # Filter out imports from the same feature
                    OTHER_FEATURE_IMPORTS=$(echo "$CROSS_FEATURE_IMPORTS" | grep -v "features/$FEATURE_NAME" || true)

                    if [[ -n "$OTHER_FEATURE_IMPORTS" ]]; then
                        # Allow type-only imports
                        TYPE_ONLY=$(echo "$CONTENT" | grep -E "import type.*from.*features/" 2>/dev/null || true)

                        if [[ -z "$TYPE_ONLY" ]] || [[ $(echo "$OTHER_FEATURE_IMPORTS" | wc -l) -gt $(echo "$TYPE_ONLY" | wc -l) ]]; then
                            ERRORS+=("Cross-feature import detected (feature: $FEATURE_NAME)")
                            ERRORS+=("  Found: $OTHER_FEATURE_IMPORTS")
                            ERRORS+=("  ")
                            ERRORS+=("  Options:")
                            ERRORS+=("    1. Extract shared code to shared/ or lib/")
                            ERRORS+=("    2. Use type-only imports: import type { X } from '...'")
                            ERRORS+=("  ")
                            ERRORS+=("  Cross-feature dependencies create tight coupling")
                        fi
                    fi
                fi
            fi
            ;;
    esac
fi

# =============================================================================
# Python Import Rules
# =============================================================================
if [[ "$FILE_PATH" =~ \.py$ ]]; then

    # Import direction: models/schemas -> repositories -> services -> routers
    #
    # BLOCKED:
    #   repositories -> services, routers
    #   services -> routers

    case $LAYER in
        "repositories")
            # Cannot import from services or routers
            if echo "$CONTENT" | grep -qE "from (app\.)?(services|routers)" 2>/dev/null; then
                ERRORS+=("repositories/ cannot import from services/ or routers/")
                ERRORS+=("  Import direction: repositories -> models, schemas, core")
                ERRORS+=("  ")
                ERRORS+=("  Repositories are the data access layer - lowest in the hierarchy")
            fi
            ;;

        "services")
            # Cannot import from routers
            if echo "$CONTENT" | grep -qE "from (app\.)?routers\.[a-z]" 2>/dev/null; then
                # Allow importing from routers.deps
                if ! echo "$CONTENT" | grep -qE "from (app\.)?routers\.(deps|dependencies)" 2>/dev/null; then
                    ERRORS+=("services/ cannot import from routers/")
                    ERRORS+=("  Import direction: services -> repositories, models, schemas, core")
                    ERRORS+=("  ")
                    ERRORS+=("  Services should be HTTP-agnostic")
                fi
            fi
            ;;

        "routers")
            # Routers should not import from other routers (except deps)
            if echo "$CONTENT" | grep -qE "from (app\.)?routers\.[a-z]" 2>/dev/null; then
                # Allow importing from routers.deps, routers.dependencies
                ROUTER_IMPORTS=$(echo "$CONTENT" | grep -E "from (app\.)?routers\." 2>/dev/null || true)
                NON_DEPS_IMPORTS=$(echo "$ROUTER_IMPORTS" | grep -vE "(deps|dependencies|__init__|utils)" || true)

                if [[ -n "$NON_DEPS_IMPORTS" ]]; then
                    ERRORS+=("Routers should not import from other routers")
                    ERRORS+=("  Found: $NON_DEPS_IMPORTS")
                    ERRORS+=("  ")
                    ERRORS+=("  Extract shared logic to services/ or routers/deps.py")
                fi
            fi
            ;;
    esac
fi

# =============================================================================
# Report errors and block
# =============================================================================
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Import direction violation (unidirectional architecture)"
    echo ""
    echo "File: $FILE_PATH"
    echo "Layer: $LAYER"
    echo ""
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "=== Architecture Diagram ==="
    echo ""
    echo "  TypeScript/React:"
    echo "    shared/lib/utils -> components/hooks -> features -> app"
    echo ""
    echo "  Python/FastAPI:"
    echo "    models/schemas -> repositories -> services -> routers"
    echo ""
    echo "Reference: .claude/skills/project-structure-enforcer/SKILL.md"
    exit 1
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Import direction enforced","continue":true}'
exit 0
