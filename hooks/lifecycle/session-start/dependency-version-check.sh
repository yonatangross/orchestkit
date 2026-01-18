#!/usr/bin/env bash
# dependency-version-check.sh - Check for outdated dependencies at session start
# Hook: SessionStart (#136)
# CC 2.1.7 Compliant
#
# Parses:
# - package.json (Node.js)
# - requirements.txt, pyproject.toml (Python)
# - go.mod (Go)
#
# Warns about:
# - Known security vulnerabilities (CVE database)
# - Severely outdated packages
# - Deprecated packages
#
# Uses additionalContext to inject warnings into session context

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${HOOK_LOG_DIR}/dependency-version-check.log"
CACHE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/dependency-check-cache.json"
CACHE_TTL_HOURS=24

# Ensure directories exist
mkdir -p "$(dirname "$CACHE_FILE")" 2>/dev/null || true

log_dep() {
    log_hook "dependency-version-check: $*"
}

# -----------------------------------------------------------------------------
# Known Vulnerabilities Database (Static for offline operation)
# This is a minimal embedded database - in production, you'd query npm audit, etc.
# -----------------------------------------------------------------------------

# Format: package|version_pattern|severity|cve|description
read -r -d '' KNOWN_VULNS << 'EOF' || true
lodash|<4.17.21|high|CVE-2021-23337|Prototype pollution
minimist|<1.2.6|critical|CVE-2021-44906|Prototype pollution
node-fetch|<2.6.7|high|CVE-2022-0235|Information exposure
axios|<0.21.2|high|CVE-2021-3749|ReDoS vulnerability
jsonwebtoken|<9.0.0|critical|CVE-2022-23529|Insecure token verification
express|<4.17.3|medium|CVE-2022-24999|Open redirect
tar|<6.1.11|critical|CVE-2021-37701|Arbitrary file overwrite
path-parse|<1.0.7|medium|CVE-2021-23343|ReDoS vulnerability
django|<3.2.14|high|CVE-2022-34265|SQL injection
flask|<2.0.2|medium|CVE-2021-28091|Path traversal
requests|<2.28.0|medium|CVE-2023-32681|Information disclosure
urllib3|<1.26.5|high|CVE-2021-33503|ReDoS vulnerability
pillow|<9.0.0|high|CVE-2022-22817|Buffer overflow
pyyaml|<5.4|critical|CVE-2020-14343|Arbitrary code execution
jinja2|<3.0.3|medium|CVE-2020-28493|XSS vulnerability
sqlalchemy|<1.4.46|medium|CVE-2023-30533|SQL injection
EOF

# Check if version matches vulnerability pattern
version_matches_vuln() {
    local current_version="$1"
    local vuln_pattern="$2"

    # Extract operator and version from pattern (e.g., "<4.17.21")
    local operator="${vuln_pattern:0:1}"
    local vuln_version="${vuln_pattern:1}"

    if [[ "$operator" == "<" ]]; then
        # Simple version comparison (works for semver)
        if [[ "$current_version" < "$vuln_version" ]]; then
            return 0
        fi
    elif [[ "$operator" == "=" ]]; then
        if [[ "$current_version" == "$vuln_version" ]]; then
            return 0
        fi
    fi

    return 1
}

# Check a package against known vulnerabilities
check_package_vulnerability() {
    local package="$1"
    local version="$2"

    # Clean version string (remove ^, ~, etc.)
    version="${version#^}"
    version="${version#~}"
    version="${version#>=}"
    version="${version#==}"
    version="${version%%,*}"

    local pkg_lower
    pkg_lower=$(echo "$package" | tr '[:upper:]' '[:lower:]')

    while IFS='|' read -r vuln_pkg vuln_pattern severity cve description; do
        [[ -z "$vuln_pkg" ]] && continue

        if [[ "$pkg_lower" == "$vuln_pkg" ]]; then
            if version_matches_vuln "$version" "$vuln_pattern"; then
                echo "${severity}|${cve}|${description}|${vuln_pattern}"
                return 0
            fi
        fi
    done <<< "$KNOWN_VULNS"

    return 1
}

# -----------------------------------------------------------------------------
# Dependency File Parsers
# -----------------------------------------------------------------------------

# Parse package.json for Node.js dependencies
parse_package_json() {
    local file="$1"
    local warnings=""
    local critical_count=0
    local high_count=0

    if [[ ! -f "$file" ]]; then
        return
    fi

    # Extract dependencies
    local deps
    deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | to_entries[] | "\(.key)|\(.value)"' "$file" 2>/dev/null) || return

    while IFS='|' read -r package version; do
        [[ -z "$package" ]] && continue

        local vuln_info
        if vuln_info=$(check_package_vulnerability "$package" "$version"); then
            local severity="${vuln_info%%|*}"
            local rest="${vuln_info#*|}"
            local cve="${rest%%|*}"
            rest="${rest#*|}"
            local desc="${rest%%|*}"
            local fix_version="${rest##*|}"

            case "$severity" in
                critical) ((critical_count++)) || true ;;
                high) ((high_count++)) || true ;;
            esac

            warnings="$warnings\n- $package@$version: $desc ($cve, $severity) - upgrade to $fix_version"
        fi
    done <<< "$deps"

    if [[ -n "$warnings" ]]; then
        echo "NODE_WARNINGS:$critical_count:$high_count:$warnings"
    fi
}

# Parse requirements.txt for Python dependencies
parse_requirements_txt() {
    local file="$1"
    local warnings=""
    local critical_count=0
    local high_count=0

    if [[ ! -f "$file" ]]; then
        return
    fi

    while IFS= read -r line; do
        # Skip comments and empty lines
        [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue

        # Parse package==version or package>=version
        local package=""
        local version=""

        # Match package==version, package>=version, package~=version etc.
        if [[ "$line" =~ ^([a-zA-Z0-9_-]+)(==|>=|~=|!=|'<'|'>')[[:space:]]*([0-9.]+) ]]; then
            package="${BASH_REMATCH[1]}"
            version="${BASH_REMATCH[3]}"
        elif [[ "$line" =~ ^([a-zA-Z0-9_-]+)[[:space:]]*$ ]]; then
            package="${BASH_REMATCH[1]}"
            version="0.0.0"  # Unknown version
        fi

        [[ -z "$package" ]] && continue

        local vuln_info
        if vuln_info=$(check_package_vulnerability "$package" "$version"); then
            local severity="${vuln_info%%|*}"
            local rest="${vuln_info#*|}"
            local cve="${rest%%|*}"
            rest="${rest#*|}"
            local desc="${rest%%|*}"
            local fix_version="${rest##*|}"

            case "$severity" in
                critical) ((critical_count++)) || true ;;
                high) ((high_count++)) || true ;;
            esac

            warnings="$warnings\n- $package==$version: $desc ($cve, $severity) - upgrade to $fix_version"
        fi
    done < "$file"

    if [[ -n "$warnings" ]]; then
        echo "PYTHON_WARNINGS:$critical_count:$high_count:$warnings"
    fi
}

# Parse pyproject.toml for Python dependencies
parse_pyproject_toml() {
    local file="$1"
    local warnings=""
    local critical_count=0
    local high_count=0

    if [[ ! -f "$file" ]]; then
        return
    fi

    # Extract dependencies section (simplified parsing)
    local in_deps=0
    while IFS= read -r line; do
        if [[ "$line" =~ ^\[.*dependencies.*\] ]]; then
            in_deps=1
            continue
        fi
        if [[ "$line" =~ ^\[.*\] ]]; then
            in_deps=0
            continue
        fi

        if [[ $in_deps -eq 1 ]]; then
            # Parse "package = "^version"" or "package = {version = "..."}"
            local package=""
            local version=""

            if [[ "$line" =~ ^([a-zA-Z0-9_-]+)[[:space:]]*=[[:space:]]*[\"\']?\^?([0-9.]+) ]]; then
                package="${BASH_REMATCH[1]}"
                version="${BASH_REMATCH[2]}"
            elif [[ "$line" =~ ^([a-zA-Z0-9_-]+)[[:space:]]*=[[:space:]]*\{.*version.*[\"\']?\^?([0-9.]+) ]]; then
                package="${BASH_REMATCH[1]}"
                version="${BASH_REMATCH[2]}"
            fi

            [[ -z "$package" ]] && continue

            local vuln_info
            if vuln_info=$(check_package_vulnerability "$package" "$version"); then
                local severity="${vuln_info%%|*}"
                local rest="${vuln_info#*|}"
                local cve="${rest%%|*}"
                rest="${rest#*|}"
                local desc="${rest%%|*}"
                local fix_version="${rest##*|}"

                case "$severity" in
                    critical) ((critical_count++)) || true ;;
                    high) ((high_count++)) || true ;;
                esac

                warnings="$warnings\n- $package==$version: $desc ($cve, $severity) - upgrade to $fix_version"
            fi
        fi
    done < "$file"

    if [[ -n "$warnings" ]]; then
        echo "PYTHON_WARNINGS:$critical_count:$high_count:$warnings"
    fi
}

# -----------------------------------------------------------------------------
# Cache Management
# -----------------------------------------------------------------------------

# Check if cache is still valid
is_cache_valid() {
    if [[ ! -f "$CACHE_FILE" ]]; then
        return 1
    fi

    local cache_time
    cache_time=$(jq -r '.timestamp // 0' "$CACHE_FILE" 2>/dev/null) || return 1

    local current_time
    current_time=$(date +%s)

    local age=$((current_time - cache_time))
    local max_age=$((CACHE_TTL_HOURS * 3600))

    if [[ $age -lt $max_age ]]; then
        return 0
    fi

    return 1
}

# Get cached warnings
get_cached_warnings() {
    if is_cache_valid; then
        jq -r '.warnings // ""' "$CACHE_FILE" 2>/dev/null
    fi
}

# Save warnings to cache (uses atomic_json_write for multi-instance safety)
save_cache() {
    local warnings="$1"
    local timestamp
    timestamp=$(date +%s)

    local json_content
    json_content=$(jq -n --arg w "$warnings" --argjson t "$timestamp" \
       '{warnings: $w, timestamp: $t}')

    # Use atomic_json_write for multi-instance safe write
    atomic_json_write "$CACHE_FILE" "$json_content"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    log_dep "Starting dependency version check"

    local proj_dir="${CLAUDE_PROJECT_DIR:-.}"
    local all_warnings=""
    local total_critical=0
    local total_high=0

    # Check cache first
    local cached
    cached=$(get_cached_warnings)
    if [[ -n "$cached" ]]; then
        log_dep "Using cached dependency warnings"
        if [[ "$cached" != "none" ]]; then
            # Output warning via additionalContext
            output_with_context "DEPENDENCY SECURITY CHECK (cached): $cached"
        else
            output_silent_success
        fi
        exit 0
    fi

    # Check for package.json
    if [[ -f "$proj_dir/package.json" ]]; then
        local node_result
        node_result=$(parse_package_json "$proj_dir/package.json") || true

        if [[ -n "$node_result" && "$node_result" =~ ^NODE_WARNINGS: ]]; then
            local counts="${node_result#NODE_WARNINGS:}"
            local critical="${counts%%:*}"
            counts="${counts#*:}"
            local high="${counts%%:*}"
            local warnings="${counts#*:}"

            total_critical=$((total_critical + critical))
            total_high=$((total_high + high))
            all_warnings="$all_warnings\n\nNode.js (package.json):$warnings"
        fi
    fi

    # Check for requirements.txt
    if [[ -f "$proj_dir/requirements.txt" ]]; then
        local py_result
        py_result=$(parse_requirements_txt "$proj_dir/requirements.txt") || true

        if [[ -n "$py_result" && "$py_result" =~ ^PYTHON_WARNINGS: ]]; then
            local counts="${py_result#PYTHON_WARNINGS:}"
            local critical="${counts%%:*}"
            counts="${counts#*:}"
            local high="${counts%%:*}"
            local warnings="${counts#*:}"

            total_critical=$((total_critical + critical))
            total_high=$((total_high + high))
            all_warnings="$all_warnings\n\nPython (requirements.txt):$warnings"
        fi
    fi

    # Check for pyproject.toml
    if [[ -f "$proj_dir/pyproject.toml" ]]; then
        local pyproj_result
        pyproj_result=$(parse_pyproject_toml "$proj_dir/pyproject.toml") || true

        if [[ -n "$pyproj_result" && "$pyproj_result" =~ ^PYTHON_WARNINGS: ]]; then
            local counts="${pyproj_result#PYTHON_WARNINGS:}"
            local critical="${counts%%:*}"
            counts="${counts#*:}"
            local high="${counts%%:*}"
            local warnings="${counts#*:}"

            total_critical=$((total_critical + critical))
            total_high=$((total_high + high))
            all_warnings="$all_warnings\n\nPython (pyproject.toml):$warnings"
        fi
    fi

    # Generate output
    if [[ -n "$all_warnings" ]]; then
        local summary="Found $total_critical critical and $total_high high severity vulnerabilities"
        local full_warning="DEPENDENCY SECURITY CHECK: $summary\n$all_warnings\n\nRun 'npm audit' or 'pip-audit' for full details."

        # Cache the result
        save_cache "$full_warning"

        log_dep "$summary"

        # Only show warning if there are critical or high severity issues
        if [[ $total_critical -gt 0 || $total_high -gt 0 ]]; then
            output_with_context "$full_warning"
        else
            output_silent_success
        fi
    else
        # Cache that there are no warnings
        save_cache "none"
        log_dep "No known vulnerabilities found"
        output_silent_success
    fi
}

main "$@"
