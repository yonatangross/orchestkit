#!/bin/bash
# =============================================================================
# backend-file-naming.sh
# BLOCKING: Backend files must follow naming conventions
# =============================================================================
set -euo pipefail

# Get file path from tool input
FILE_PATH="${TOOL_INPUT_FILE_PATH:-}"
[[ -z "$FILE_PATH" ]] && exit 0

# Only validate Python files in app/
[[ ! "$FILE_PATH" =~ \.py$ ]] && exit 0

# Skip if not in an app/ directory (might be a different project structure)
if [[ ! "$FILE_PATH" =~ /app/ ]] && [[ ! "$FILE_PATH" =~ /backend/ ]]; then
    exit 0
fi

FILENAME=$(basename "$FILE_PATH")
DIRNAME=$(dirname "$FILE_PATH")
ERRORS=()

# Skip __init__.py files
[[ "$FILENAME" == "__init__.py" ]] && exit 0

# =============================================================================
# Router naming conventions
# =============================================================================
if [[ "$DIRNAME" =~ /routers$ ]] || [[ "$DIRNAME" =~ /routers/ ]]; then
    # Allow: router_*.py, routes_*.py, api_*.py, deps.py, dependencies.py, utils.py
    if [[ ! "$FILENAME" =~ ^(router_|routes_|api_).*\.py$ ]] && \
       [[ ! "$FILENAME" =~ ^(deps|dependencies|utils|helpers|base)\.py$ ]]; then
        ERRORS+=("ROUTER NAMING: Files in routers/ must be prefixed")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  ")
        ERRORS+=("  Expected patterns:")
        ERRORS+=("    - router_users.py")
        ERRORS+=("    - routes_auth.py")
        ERRORS+=("    - api_v1.py")
        ERRORS+=("    - deps.py (for dependencies)")
    fi
fi

# =============================================================================
# Service naming conventions
# =============================================================================
if [[ "$DIRNAME" =~ /services$ ]] || [[ "$DIRNAME" =~ /services/ ]]; then
    # Allow: *_service.py, base.py, utils.py
    if [[ ! "$FILENAME" =~ _service\.py$ ]] && \
       [[ ! "$FILENAME" =~ ^(base|utils|helpers|abstract)\.py$ ]]; then
        ERRORS+=("SERVICE NAMING: Files in services/ must end with _service.py")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  ")
        ERRORS+=("  Expected patterns:")
        ERRORS+=("    - user_service.py")
        ERRORS+=("    - auth_service.py")
        ERRORS+=("    - email_service.py")
    fi
fi

# =============================================================================
# Repository naming conventions
# =============================================================================
if [[ "$DIRNAME" =~ /repositories$ ]] || [[ "$DIRNAME" =~ /repositories/ ]]; then
    # Allow: *_repository.py, *_repo.py, base.py
    if [[ ! "$FILENAME" =~ _(repository|repo)\.py$ ]] && \
       [[ ! "$FILENAME" =~ ^(base|abstract|utils)\.py$ ]]; then
        ERRORS+=("REPOSITORY NAMING: Files in repositories/ must end with _repository.py or _repo.py")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  ")
        ERRORS+=("  Expected patterns:")
        ERRORS+=("    - user_repository.py")
        ERRORS+=("    - user_repo.py")
        ERRORS+=("    - base.py (for base class)")
    fi
fi

# =============================================================================
# Schema naming conventions
# =============================================================================
if [[ "$DIRNAME" =~ /schemas$ ]] || [[ "$DIRNAME" =~ /schemas/ ]]; then
    # Allow: *_schema.py, *_dto.py, *_request.py, *_response.py, base.py
    if [[ ! "$FILENAME" =~ _(schema|dto|request|response)\.py$ ]] && \
       [[ ! "$FILENAME" =~ ^(base|common|shared|utils)\.py$ ]]; then
        ERRORS+=("SCHEMA NAMING: Files in schemas/ must use proper suffix")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  ")
        ERRORS+=("  Expected patterns:")
        ERRORS+=("    - user_schema.py")
        ERRORS+=("    - auth_dto.py")
        ERRORS+=("    - user_request.py")
        ERRORS+=("    - user_response.py")
    fi
fi

# =============================================================================
# Model naming conventions
# =============================================================================
if [[ "$DIRNAME" =~ /models$ ]] || [[ "$DIRNAME" =~ /models/ ]]; then
    # Allow: *_model.py, *_entity.py, *_orm.py, base.py
    if [[ ! "$FILENAME" =~ _(model|entity|orm)\.py$ ]] && \
       [[ ! "$FILENAME" =~ ^(base|abstract|mixins)\.py$ ]]; then
        ERRORS+=("MODEL NAMING: Files in models/ must use proper suffix")
        ERRORS+=("  Got: $FILENAME")
        ERRORS+=("  ")
        ERRORS+=("  Expected patterns:")
        ERRORS+=("    - user_model.py")
        ERRORS+=("    - order_entity.py")
        ERRORS+=("    - product_orm.py")
        ERRORS+=("    - base.py (for SQLAlchemy base)")
    fi
fi

# =============================================================================
# Core/config naming conventions
# =============================================================================
if [[ "$DIRNAME" =~ /core$ ]] || [[ "$DIRNAME" =~ /core/ ]]; then
    # Allow common core file names
    VALID_CORE_NAMES="config|settings|security|database|db|deps|dependencies|exceptions|logging|middleware|events|lifespan"
    if [[ ! "$FILENAME" =~ ^($VALID_CORE_NAMES)\.py$ ]]; then
        # Warn but don't block for core - it's more flexible
        echo "INFO: Uncommon file name in core/: $FILENAME"
        echo "  Common names: config.py, security.py, database.py, deps.py"
    fi
fi

# =============================================================================
# General Python naming conventions
# =============================================================================
# Check for PascalCase file names (should be snake_case)
if [[ "$FILENAME" =~ ^[A-Z][a-zA-Z]+\.py$ ]]; then
    ERRORS+=("NAMING CONVENTION: Python files should use snake_case, not PascalCase")
    ERRORS+=("  Got: $FILENAME")
    ERRORS+=("  ")
    ERRORS+=("  Convert to: $(echo "$FILENAME" | sed 's/\([A-Z]\)/_\L\1/g' | sed 's/^_//')")
fi

# =============================================================================
# Report errors and block
# =============================================================================
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "BLOCKED: Backend file naming violation"
    echo ""
    echo "File: $FILE_PATH"
    echo ""
    for error in "${ERRORS[@]}"; do
        echo "  $error"
    done
    echo ""
    echo "Reference: .claude/skills/backend-architecture-enforcer/SKILL.md"
    exit 1
fi

# Output systemMessage for user visibility
echo '{"systemMessage":"Backend naming checked","continue":true}'
exit 0
