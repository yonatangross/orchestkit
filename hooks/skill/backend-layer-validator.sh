#!/bin/bash
# =============================================================================
# backend-layer-validator.sh
# BLOCKING: Enforce layer separation in FastAPI
# =============================================================================
set -euo pipefail

# Get inputs
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
CONTENT="${TOOL_OUTPUT_CONTENT:-}"

[[ -z "$FILE_PATH" ]] && exit 0
[[ -z "$CONTENT" ]] && exit 0

# Only validate Python files
[[ ! "$FILE_PATH" =~ \.py$ ]] && exit 0

ERRORS=()

# =============================================================================
# ROUTER LAYER VIOLATIONS
# =============================================================================
if [[ "$FILE_PATH" =~ /routers/ ]]; then

    # -------------------------------------------------------------------------
    # Rule: No direct database operations in routers
    # -------------------------------------------------------------------------
    # Check for SQLAlchemy session operations
    if echo "$CONTENT" | grep -qE "db\.(add|delete|commit|flush|rollback|refresh|execute|scalar)" 2>/dev/null; then
        ERRORS+=("DATABASE: Direct database operations not allowed in routers")
        ERRORS+=("  Found: db.add/delete/commit/execute/etc.")
        ERRORS+=("  ")
        ERRORS+=("  Move database operations to repository layer")
        ERRORS+=("  Router should call: await service.create_item(data)")
    fi

    # Check for raw SQL or query building
    if echo "$CONTENT" | grep -qE "(select|insert|update|delete)\s*\(" 2>/dev/null; then
        # Exclude imports and comments
        if echo "$CONTENT" | grep -vE "^(from|import|#)" | grep -qE "(select|insert|update|delete)\s*\(" 2>/dev/null; then
            ERRORS+=("DATABASE: SQL query construction not allowed in routers")
            ERRORS+=("  Move queries to repository layer")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: No SQLAlchemy model imports (except for type hints)
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "^from sqlalchemy import" 2>/dev/null; then
        ERRORS+=("IMPORT: SQLAlchemy imports not allowed in routers")
        ERRORS+=("  Routers should only handle HTTP concerns")
        ERRORS+=("  Use Pydantic schemas for request/response typing")
    fi

    # -------------------------------------------------------------------------
    # Rule: Router functions should be thin (delegate to services)
    # -------------------------------------------------------------------------
    # Count lines in route functions (rough heuristic)
    # Look for @router decorators and count until next decorator or end
    ROUTE_FUNCTIONS=$(echo "$CONTENT" | grep -c "@router\." 2>/dev/null || echo "0")
    TOTAL_LINES=$(echo "$CONTENT" | wc -l | tr -d ' ')

    if [[ $ROUTE_FUNCTIONS -gt 0 ]]; then
        # Rough estimate: if file has many lines per route, it's too complex
        LINES_PER_ROUTE=$((TOTAL_LINES / ROUTE_FUNCTIONS))
        if [[ $LINES_PER_ROUTE -gt 40 ]]; then
            ERRORS+=("COMPLEXITY: Router functions too complex (avg ~$LINES_PER_ROUTE lines per route)")
            ERRORS+=("  ")
            ERRORS+=("  Routers should:")
            ERRORS+=("    - Parse request")
            ERRORS+=("    - Call service")
            ERRORS+=("    - Return response")
            ERRORS+=("  ")
            ERRORS+=("  Extract business logic to services/")
        fi
    fi

    # -------------------------------------------------------------------------
    # Rule: No business logic patterns
    # -------------------------------------------------------------------------
    # Check for loops with conditionals (business logic smell)
    if echo "$CONTENT" | grep -qE "for .+ in .+:" 2>/dev/null; then
        # Count nested structures
        NESTED_LOOPS=$(echo "$CONTENT" | grep -cE "^\s{8,}(for|if|while)" 2>/dev/null || echo "0")
        if [[ $NESTED_LOOPS -gt 2 ]]; then
            ERRORS+=("LOGIC: Complex control flow detected in router")
            ERRORS+=("  Nested loops/conditionals suggest business logic")
            ERRORS+=("  Move to service layer")
        fi
    fi
fi

# =============================================================================
# SERVICE LAYER VIOLATIONS
# =============================================================================
if [[ "$FILE_PATH" =~ /services/ ]]; then

    # -------------------------------------------------------------------------
    # Rule: No HTTP exception handling (use domain exceptions)
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "HTTPException\s*\(" 2>/dev/null; then
        ERRORS+=("HTTP: HTTPException not allowed in services")
        ERRORS+=("  ")
        ERRORS+=("  Services should raise domain exceptions:")
        ERRORS+=("    raise UserNotFoundError(user_id)")
        ERRORS+=("    raise ValidationError('Invalid email')")
        ERRORS+=("  ")
        ERRORS+=("  Let routers convert to HTTP responses")
    fi

    # -------------------------------------------------------------------------
    # Rule: No FastAPI Request/Response objects
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "from fastapi import.*(Request|Response)" 2>/dev/null || \
       echo "$CONTENT" | grep -qE "from starlette.*(Request|Response)" 2>/dev/null; then
        ERRORS+=("HTTP: Request/Response types not allowed in services")
        ERRORS+=("  ")
        ERRORS+=("  Services should be HTTP-agnostic")
        ERRORS+=("  Pass data via Pydantic models or primitives")
    fi

    # -------------------------------------------------------------------------
    # Rule: No direct response returns
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "(JSONResponse|HTMLResponse|RedirectResponse|FileResponse)\s*\(" 2>/dev/null; then
        ERRORS+=("HTTP: Direct response objects not allowed in services")
        ERRORS+=("  Return data and let routers handle response formatting")
    fi
fi

# =============================================================================
# REPOSITORY LAYER VIOLATIONS
# =============================================================================
if [[ "$FILE_PATH" =~ /repositories/ ]]; then

    # -------------------------------------------------------------------------
    # Rule: No HTTP exceptions in repositories
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "HTTPException" 2>/dev/null; then
        ERRORS+=("HTTP: HTTPException not allowed in repositories")
        ERRORS+=("  ")
        ERRORS+=("  Repositories should:")
        ERRORS+=("    - Return None when not found")
        ERRORS+=("    - Raise domain exceptions for business rules")
        ERRORS+=("  ")
        ERRORS+=("  Let services/routers handle HTTP error mapping")
    fi

    # -------------------------------------------------------------------------
    # Rule: No service layer imports
    # -------------------------------------------------------------------------
    if echo "$CONTENT" | grep -qE "from.*(services|routers).*import" 2>/dev/null; then
        ERRORS+=("IMPORT: Repositories cannot import from services or routers")
        ERRORS+=("  ")
        ERRORS+=("  Repository is the lowest layer in the architecture")
        ERRORS+=("  It should only depend on models, schemas, and core")
    fi

    # -------------------------------------------------------------------------
    # Rule: No business logic in repositories
    # -------------------------------------------------------------------------
    # Check for complex conditionals (business rules)
    COMPLEX_CONDITIONS=$(echo "$CONTENT" | grep -cE "if .+ and .+ (and|or)" 2>/dev/null || echo "0")
    if [[ $COMPLEX_CONDITIONS -gt 2 ]]; then
        ERRORS+=("LOGIC: Complex business conditions in repository")
        ERRORS+=("  ")
        ERRORS+=("  Repositories should handle data access only")
        ERRORS+=("  Move business rules to service layer")
    fi
fi

# =============================================================================
# SCHEMA/MODEL LAYER VIOLATIONS
# =============================================================================
if [[ "$FILE_PATH" =~ /schemas/ ]]; then

    # -------------------------------------------------------------------------
    # Rule: Schemas should not have complex methods
    # -------------------------------------------------------------------------
    METHOD_COUNT=$(echo "$CONTENT" | grep -cE "^\s+def [a-z_]+\(" 2>/dev/null || echo "0")
    if [[ $METHOD_COUNT -gt 5 ]]; then
        ERRORS+=("COMPLEXITY: Too many methods in schema ($METHOD_COUNT)")
        ERRORS+=("  ")
        ERRORS+=("  Pydantic schemas should be data structures")
        ERRORS+=("  Move complex logic to services")
    fi
fi

# =============================================================================
# Report errors and block
# =============================================================================
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Backend layer separation violation"
    echo ""
    echo "File: $FILE_PATH"
    echo ""
    echo "=== Architecture Layers ==="
    echo "  routers/      -> HTTP only (request/response)"
    echo "  services/     -> Business logic"
    echo "  repositories/ -> Data access"
    echo "  schemas/      -> Data structures (Pydantic)"
    echo "  models/       -> ORM models (SQLAlchemy)"
    echo ""
    echo "Violations:"
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Reference: .claude/skills/backend-architecture-enforcer/SKILL.md"
    exit 1
fi

# Output systemMessage for user visibility
# No output - dispatcher handles all JSON output for posttool hooks
# echo '{"systemMessage":"Backend layers validated","continue":true}'
exit 0
